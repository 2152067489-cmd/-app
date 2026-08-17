/**
 * lib/utils.js - 工具函数（响应、请求解析、日期、校验、限流、勋章）
 */

// ============================================================
// HTTP 响应工具
// ============================================================
function sendJson(res, status, data) {
  res.statusCode = status || 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

// 解析请求体（兼容 Vercel 已解析 / 原始字符串 / form-encoded）
function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

// 解析查询参数
function getQuery(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams);
}

// 获取客户端 IP
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'] || '';
  return fwd.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// ============================================================
// 日期工具（北京时间 UTC+8）
// ============================================================
function getBeijingNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function getBeijingDateStr() {
  const bj = getBeijingNow();
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayStr() {
  const bj = new Date(getBeijingNow().getTime() - 24 * 3600 * 1000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// 输入校验
// ============================================================
function validateAccount(account) {
  if (!account) return false;
  const acc = account.trim();
  return acc.length >= 4 && acc.length <= 20 && /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(acc);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

// 生成不可预测的订单号
function genOrderNo() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `ST${ts}${rand}`.toUpperCase();
}

// ============================================================
// 限流（内存版，单实例有效；多实例部署建议换 Redis）
// ============================================================
const rateLimitStore = new Map();

function checkRateLimit(key, windowMs, max) {
  const now = Date.now();
  let hits = rateLimitStore.get(key) || [];
  hits = hits.filter(t => now - t < windowMs);
  if (hits.length >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  rateLimitStore.set(key, hits);
  return { allowed: true };
}

// 定期清理过期记录
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateLimitStore) {
    const fresh = hits.filter(t => now - t < 24 * 3600 * 1000);
    if (fresh.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, fresh);
  }
}, 10 * 60 * 1000).unref?.();

// ============================================================
// 签到连续天数计算
// ============================================================
function recalcContinuousDays(signDateSet, todayStr, yesterdayStr) {
  // 从今天或昨天开始往前数
  let startDate = todayStr;
  if (!signDateSet.has(todayStr)) {
    if (signDateSet.has(yesterdayStr)) {
      startDate = yesterdayStr;
    } else {
      return 0;
    }
  }

  let count = 0;
  let cursor = new Date(startDate + 'T00:00:00Z');
  while (true) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cursor.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (signDateSet.has(dateStr)) {
      count++;
      cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
    } else {
      break;
    }
  }
  return count;
}

// ============================================================
// 勋章解锁检查
// ============================================================
const { MEDAL_CONDITIONS } = require('./config');

function checkMedalUnlock(totalDays, currentMedals) {
  const current = new Set(currentMedals || []);
  const newlyUnlocked = [];
  for (const medal of MEDAL_CONDITIONS) {
    if (totalDays >= medal.days && !current.has(medal.level)) {
      current.add(medal.level);
      newlyUnlocked.push(medal.level);
    }
  }
  return {
    unlockedMedals: Array.from(current).sort((a, b) => a - b),
    newlyUnlocked,
  };
}

module.exports = {
  sendJson, getBody, getQuery, getClientIp,
  getBeijingNow, getBeijingDateStr, getYesterdayStr,
  validateAccount, validatePassword, genOrderNo,
  checkRateLimit, recalcContinuousDays, checkMedalUnlock,
};
