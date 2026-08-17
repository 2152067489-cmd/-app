/**
 * routes.js - API 路由
 *
 * 公开网站版本：所有用户数据接口均需 JWT 鉴权，注册接口有 IP 限流。
 */
const express = require('express');
const router = express.Router();

const { register, login, authMiddleware } = require('./auth');
const { getCoins, getSignStats, signin, makeupSign, getCalendarData, getBeijingDateStr } = require('./user');
const { createOrder, getOrderStatus, handleNotify, devMarkSuccess } = require('./pay');
const { stmts } = require('./db');
const config = require('./config');

// ============================================================
// 注册 IP 限流（防止恶意注册）
// 内存实现，单机够用；分布式部署可换 Redis
// ============================================================
const registerHits = new Map(); // ip -> [timestamp,...]

function registerRateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const windowMs = config.rateLimit.registerWindowMs;
  const max = config.rateLimit.registerMax;

  let hits = registerHits.get(ip) || [];
  // 清理过期记录
  hits = hits.filter(t => now - t < windowMs);

  if (hits.length >= max) {
    const retrySec = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return res.status(429).json({
      ok: false,
      msg: `注册过于频繁，请 ${retrySec} 秒后再试`,
    });
  }

  hits.push(now);
  registerHits.set(ip, hits);
  next();
}

// 定期清理过期的限流记录，避免内存泄漏
setInterval(() => {
  const now = Date.now();
  const windowMs = config.rateLimit.registerWindowMs;
  for (const [ip, hits] of registerHits) {
    const fresh = hits.filter(t => now - t < windowMs);
    if (fresh.length === 0) {
      registerHits.delete(ip);
    } else {
      registerHits.set(ip, fresh);
    }
  }
}, 10 * 60 * 1000); // 每 10 分钟清理一次

// ============================================================
// 认证相关
// ============================================================

// 注册（带 IP 限流）
router.post('/api/auth/register', registerRateLimit, (req, res) => {
  const { account, password } = req.body;
  const result = register(account, password);
  res.json(result);
});

// 登录
router.post('/api/auth/login', (req, res) => {
  const { account, password } = req.body;
  const result = login(account, password);
  res.json(result);
});

// 验证 token（前端检查登录状态）
router.get('/api/auth/check', authMiddleware, (req, res) => {
  res.json({ ok: true, userId: req.userId, account: req.userAccount, role: req.userRole });
});

// ============================================================
// 用户金币
// ============================================================

// 查询金币余额
router.get('/api/user/coins', authMiddleware, (req, res) => {
  const coins = getCoins(req.userId);
  res.json({ ok: true, coins });
});

// 查询签到统计
router.get('/api/user/sign-stats', authMiddleware, (req, res) => {
  const stats = getSignStats(req.userId);
  res.json({ ok: true, stats });
});

// 签到
router.post('/api/user/signin', authMiddleware, (req, res) => {
  const result = signin(req.userId);
  res.json(result);
});

// 补签
router.post('/api/user/makeup-sign', authMiddleware, (req, res) => {
  const { dateStr } = req.body;
  const result = makeupSign(req.userId, dateStr);
  res.json(result);
});

// 获取签到日历
router.get('/api/user/calendar', authMiddleware, (req, res) => {
  const { year, month } = req.query;
  const data = getCalendarData(req.userId, parseInt(year), parseInt(month));
  res.json({ ok: true, ...data });
});

// 充值记录
router.get('/api/user/recharge-records', authMiddleware, (req, res) => {
  const records = stmts.getRechargeList.all(req.userId, 50);
  res.json({ ok: true, records });
});

// ============================================================
// 支付相关
// ============================================================

// 获取套餐列表
router.get('/api/pay/packages', (req, res) => {
  const packages = Object.entries(config.packages).map(([id, pkg]) => ({
    id, ...pkg, priceYuan: pkg.price,
  }));
  res.json({ ok: true, packages });
});

// 创建支付订单
router.post('/api/pay/create', authMiddleware, async (req, res) => {
  const { packageId, payType } = req.body;
  const result = await createOrder({ userId: req.userId, packageId, payType });
  res.json(result);
});

// 查询订单状态（前端轮询）
router.get('/api/pay/status', (req, res) => {
  const { orderNo } = req.query;
  const result = getOrderStatus(orderNo);
  res.json(result);
});

// 虎皮椒异步回调（无需登录验证）
router.post('/api/pay/notify', (req, res) => {
  const params = req.body || req.query;
  console.log('[notify] 收到回调:', JSON.stringify(params));
  const result = handleNotify(params);
  // 虎皮椒要求返回纯文本 "success"
  if (result.ok) {
    res.send('success');
  } else {
    res.send('fail');
  }
});

// GET 方式回调（部分平台用 GET）
router.get('/api/pay/notify', (req, res) => {
  const params = req.query;
  console.log('[notify-GET] 收到回调:', JSON.stringify(params));
  const result = handleNotify(params);
  if (result.ok) {
    res.send('success');
  } else {
    res.send('fail');
  }
});

// ============================================================
// 开发模式专用：模拟支付成功（无虎皮椒配置时测试用）
// ============================================================
router.post('/api/pay/dev-mark-success', authMiddleware, (req, res) => {
  const { orderNo } = req.body;
  const result = devMarkSuccess(orderNo);
  res.json(result);
});

module.exports = router;
