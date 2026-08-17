/**
 * user.js - 用户金币 / 签到 / 补签
 */
const { stmts } = require('./db');

// 勋章解锁条件（累计签到天数）
const MEDAL_CONDITIONS = [
  { level: 1,  days: 1   },
  { level: 2,  days: 7   },
  { level: 3,  days: 14  },
  { level: 4,  days: 30  },
  { level: 5,  days: 60  },
  { level: 6,  days: 90  },
  { level: 7,  days: 150 },
  { level: 8,  days: 210 },
  { level: 9,  days: 270 },
  { level: 10, days: 360 },
];

// 获取北京时间日期字符串 YYYY-MM-DD
function getBeijingDateStr() {
  const now = new Date();
  // UTC+8
  const bj = new Date(now.getTime() + 8 * 3600 * 1000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayStr() {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600 * 1000 - 24 * 3600 * 1000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// 获取用户金币
// ============================================================
function getCoins(userId) {
  const row = stmts.getUserCoins.get(userId);
  return row ? row.coins : 0;
}

// ============================================================
// 增加金币（充值到账）
// ============================================================
function addCoins(userId, amount) {
  stmts.updateCoins.run(amount, userId);
  return getCoins(userId);
}

// ============================================================
// 获取签到统计
// ============================================================
function getSignStats(userId) {
  let stats = stmts.getSignStats.get(userId);
  if (!stats) {
    stmts.upsertSignStats.run(userId, 0, 0, '', '[]');
    stats = stmts.getSignStats.get(userId);
  }
  stats.unlockedMedals = JSON.parse(stats.unlocked_medals || '[]');
  return stats;
}

// ============================================================
// 重新计算连续签到天数
// ============================================================
function recalcContinuousDays(userId) {
  const stats = getSignStats(userId);
  const today = getBeijingDateStr();
  const yesterday = getYesterdayStr();

  // 获取所有签到日期
  const records = stmts.getRecentSigns.all(userId, 9999);
  const signSet = new Set(records.map(r => r.sign_date));

  // 从今天（或昨天）往前数连续天数
  let continuous = 0;
  let cursor = today;
  if (!signSet.has(cursor)) {
    cursor = yesterday;
  }
  while (signSet.has(cursor)) {
    continuous++;
    const [y, m, d] = cursor.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    cursor = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }

  return continuous;
}

// ============================================================
// 检查勋章解锁
// ============================================================
function checkMedalUnlock(userId) {
  const stats = getSignStats(userId);
  const unlocked = stats.unlockedMedals;
  const newlyUnlocked = [];

  for (const medal of MEDAL_CONDITIONS) {
    if (stats.total_days >= medal.days && !unlocked.includes(medal.level)) {
      newlyUnlocked.push(medal.level);
      unlocked.push(medal.level);
    }
  }

  if (newlyUnlocked.length > 0) {
    stmts.upsertSignStats.run(userId, stats.total_days, stats.continuous_days, stats.last_sign_date, JSON.stringify(unlocked));
  }

  return newlyUnlocked;
}

// ============================================================
// 签到
// ============================================================
function signin(userId) {
  const today = getBeijingDateStr();
  const existing = stmts.findSignRecord.get(userId, today);
  if (existing) {
    return { ok: false, msg: '今天已经签到了' };
  }

  // 写入签到记录
  stmts.insertSignRecord.run(userId, today, 0);

  // 更新统计
  const stats = getSignStats(userId);
  stats.total_days += 1;
  stats.continuous_days = recalcContinuousDays(userId);
  stats.last_sign_date = today;
  stmts.upsertSignStats.run(userId, stats.total_days, stats.continuous_days, stats.last_sign_date, JSON.stringify(stats.unlockedMedals));

  // 检查勋章
  const newMedals = checkMedalUnlock(userId);

  return { ok: true, totalDays: stats.total_days, continuousDays: stats.continuous_days, newMedals };
}

// ============================================================
// 补签（消耗 626 金币）
// ============================================================
const MAKEUP_COST = 626;

function makeupSign(userId, dateStr) {
  const today = getBeijingDateStr();

  // 不能补签今天或未来
  if (dateStr >= today) {
    return { ok: false, msg: '今天和未来的日期不能补签' };
  }

  // 只能补签最近30天
  const [ty, tm, td] = today.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const diffDays = Math.floor((new Date(ty, tm-1, td) - new Date(dy, dm-1, dd)) / (1000*60*60*24));
  if (diffDays > 30) {
    return { ok: false, msg: '只能补签最近30天内的漏签' };
  }

  // 检查是否已签到
  const existing = stmts.findSignRecord.get(userId, dateStr);
  if (existing) {
    return { ok: false, msg: '该日期已签到' };
  }

  // 检查金币
  const coins = getCoins(userId);
  if (coins < MAKEUP_COST) {
    return { ok: false, msg: `金币不足，补签需要 ${MAKEUP_COST} 金币`, coins, cost: MAKEUP_COST };
  }

  // 扣除金币
  stmts.updateCoins.run(-MAKEUP_COST, userId);

  // 写入补签记录
  stmts.insertSignRecord.run(userId, dateStr, 1);

  // 更新统计
  const stats = getSignStats(userId);
  stats.total_days += 1;
  stats.continuous_days = recalcContinuousDays(userId);
  // last_sign_date 保持为最近一次实际签到日期，不被补签覆盖
  stmts.upsertSignStats.run(userId, stats.total_days, stats.continuous_days, stats.last_sign_date, JSON.stringify(stats.unlockedMedals));

  // 检查勋章
  const newMedals = checkMedalUnlock(userId);

  return {
    ok: true,
    msg: '补签成功',
    coins: coins - MAKEUP_COST,
    cost: MAKEUP_COST,
    totalDays: stats.total_days,
    continuousDays: stats.continuous_days,
    newMedals,
  };
}

// ============================================================
// 获取签到日历数据（某月）
// ============================================================
function getCalendarData(userId, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const records = stmts.getRecentSigns.all(userId, 9999);
  const signedDates = records
    .filter(r => r.sign_date.startsWith(prefix))
    .map(r => r.sign_date);

  return { signedDates };
}

module.exports = {
  getCoins,
  addCoins,
  getSignStats,
  signin,
  makeupSign,
  getCalendarData,
  getBeijingDateStr,
  checkMedalUnlock,
};
