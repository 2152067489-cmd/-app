/**
 * pay.js - 支付通用逻辑
 *
 * 负责：
 * 1. 创建订单（调用虎皮椒）
 * 2. 查询订单状态
 * 3. 处理支付回调（验签 + 发放金币）
 * 4. 超时订单清理
 *
 * 订单幂等：同一订单号只充值一次
 * 超时保护：超过5分钟的 pending 订单标记为 expired，即使收到回调也不充值
 */
const crypto = require('crypto');
const config = require('./config');
const { stmts } = require('./db');
const { createPayment, verifyNotifySign } = require('./xunhupay');
const { addCoins, getCoins } = require('./user');

// ============================================================
// 生成商户订单号
// ============================================================
function genOrderNo() {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `STITCH_${ts}${rand}`;
}

// ============================================================
// 创建支付订单
// ============================================================
async function createOrder({ userId, packageId, payType }) {
  // 从后端配置取套餐（不信任前端金额）
  const pkg = config.packages[packageId];
  if (!pkg) {
    return { ok: false, msg: '无效的充值套餐' };
  }

  if (payType !== 'alipay' && payType !== 'wechat') {
    return { ok: false, msg: '无效的支付方式' };
  }

  // 生成订单号
  const orderNo = genOrderNo();

  // 调用虎皮椒创建支付
  // 虎皮椒 total_fee 单位为元（字符串）
  const payResult = await createPayment({
    outTradeNo: orderNo,
    totalFee: pkg.price,
    body: `史迪奇充值-${pkg.name}`,
    payType,
  });

  if (!payResult.ok) {
    return { ok: false, msg: payResult.msg };
  }

  // 写入数据库
  stmts.insertOrder.run(
    orderNo, userId, packageId, pkg.price, pkg.coins, payType,
    'pending', payResult.qrCodeUrl
  );

  // 计算过期时间
  const expireTime = new Date(Date.now() + config.order.expireMinutes * 60 * 1000);

  return {
    ok: true,
    orderNo,
    qrCodeUrl: payResult.qrCodeUrl,
    qrCodeIsUrl: payResult.payUrl ? true : false, // 如果是URL则前端需要生成二维码
    amount: pkg.price,
    coins: pkg.coins,
    payType,
    expireTime: expireTime.toISOString(),
    devMode: payResult.devMode || false,
  };
}

// ============================================================
// 查询订单状态（前端轮询用）
// ============================================================
function getOrderStatus(orderNo) {
  const order = stmts.findOrderByNo.get(orderNo);
  if (!order) {
    return { ok: false, msg: '订单不存在' };
  }
  return {
    ok: true,
    orderNo: order.order_no,
    status: order.status,  // pending / success / expired / failed
    coins: order.coins,
    amount: order.amount,
  };
}

// ============================================================
// 处理虎皮椒异步回调
// ============================================================
function handleNotify(params) {
  // 验签
  const isValid = verifyNotifySign(params, config.xunhupay.appSecret);
  if (!isValid) {
    console.warn('[pay] 回调验签失败', params);
    return { ok: false, msg: '签名验证失败' };
  }

  const orderNo = params.trade_order_id || params.out_trade_no;
  const tradeStatus = params.trade_status || params.status || '';

  // 虎皮椒支付成功状态：TRADE_SUCCESS
  if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'success') {
    console.warn('[pay] 回调状态非成功:', tradeStatus);
    return { ok: false, msg: '支付未成功' };
  }

  // 查找订单
  const order = stmts.findOrderByNo.get(orderNo);
  if (!order) {
    console.warn('[pay] 回调订单不存在:', orderNo);
    return { ok: false, msg: '订单不存在' };
  }

  // 订单幂等：已成功则不重复充值
  if (order.status === 'success') {
    console.log('[pay] 订单已处理（幂等）:', orderNo);
    return { ok: true, msg: 'success' };
  }

  // 超时保护：已过期的订单不充值
  if (order.status === 'expired') {
    console.warn('[pay] 订单已过期，不予充值（需人工核对）:', orderNo);
    return { ok: false, msg: '订单已过期，请联系客服处理' };
  }

  // 更新订单状态为成功
  const updated = stmts.updateOrderStatus.run('success', orderNo, 'pending');
  if (updated.changes === 0) {
    // 状态不是 pending，可能已被其他回调处理
    console.log('[pay] 订单状态非pending，跳过:', orderNo);
    return { ok: true, msg: 'success' };
  }

  // 发放金币
  addCoins(order.user_id, order.coins);

  // 记录充值记录
  stmts.insertRecharge.run(order.user_id, orderNo, order.amount, order.coins, order.pay_type);

  const newBalance = getCoins(order.user_id);
  console.log(`[pay] 充值成功: 订单=${orderNo}, 用户=${order.user_id}, 金币+${order.coins}, 余额=${newBalance}`);

  return { ok: true, msg: 'success' };
}

// ============================================================
// 清理超时订单（定时任务调用）
// ============================================================
function cleanupExpiredOrders() {
  const expireMinutes = config.order.expireMinutes;
  const expireStr = `-${expireMinutes} minutes`;

  const expiredOrders = stmts.findPendingOrders.all(expireStr);
  let count = 0;
  for (const order of expiredOrders) {
    const result = stmts.updateOrderStatus.run('expired', order.order_no, 'pending');
    if (result.changes > 0) count++;
  }

  if (count > 0) {
    console.log(`[pay] 清理超时订单: ${count} 笔`);
  }
  return count;
}

// ============================================================
// 开发模式：手动标记订单成功（用于无虎皮椒配置时的测试）
// ============================================================
function devMarkSuccess(orderNo) {
  const order = stmts.findOrderByNo.get(orderNo);
  if (!order) return { ok: false, msg: '订单不存在' };
  if (order.status !== 'pending') return { ok: false, msg: '订单状态非pending' };

  stmts.updateOrderStatus.run('success', orderNo, 'pending');
  addCoins(order.user_id, order.coins);
  stmts.insertRecharge.run(order.user_id, orderNo, order.amount, order.coins, order.pay_type);

  const newBalance = getCoins(order.user_id);
  console.log(`[pay-dev] 模拟充值成功: 订单=${orderNo}, 金币+${order.coins}, 余额=${newBalance}`);
  return { ok: true, msg: '模拟充值成功', coins: order.coins, balance: newBalance };
}

module.exports = {
  createOrder,
  getOrderStatus,
  handleNotify,
  cleanupExpiredOrders,
  devMarkSuccess,
};
