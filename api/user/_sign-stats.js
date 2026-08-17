/**
 * GET /api/user/sign-stats
 * 查询签到统计（累计天数、连续天数、已解锁勋章）
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson, getBeijingDateStr, getYesterdayStr, recalcContinuousDays } = require('../../lib/utils');
const { MEDAL_CONDITIONS } = require('../../lib/config');

module.exports = async (req, res) => {
  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const userId = decoded.userId;

  // 获取签到统计
  const { data: stats } = await supabase
    .from('sign_stats').select('*').eq('user_id', userId).maybeSingle();

  if (!stats) {
    return sendJson(res, 200, {
      ok: true,
      totalDays: 0,
      continuousDays: 0,
      lastSignDate: '',
      unlockedMedals: [],
      medals: MEDAL_CONDITIONS.map(m => ({ ...m, unlocked: false, remainDays: m.days })),
    });
  }

  // 重新计算连续天数（确保实时准确）
  const { data: allSigns } = await supabase
    .from('sign_records').select('sign_date').eq('user_id', userId);
  const signSet = new Set((allSigns || []).map(r => r.sign_date));
  const today = getBeijingDateStr();
  const yesterday = getYesterdayStr();
  const continuousDays = recalcContinuousDays(signSet, today, yesterday);

  const unlockedSet = new Set(stats.unlocked_medals || []);
  const medals = MEDAL_CONDITIONS.map(m => ({
    level: m.level,
    days: m.days,
    unlocked: unlockedSet.has(m.level),
    remainDays: Math.max(0, m.days - stats.total_days),
  }));

  return sendJson(res, 200, {
    ok: true,
    totalDays: stats.total_days,
    continuousDays,
    lastSignDate: stats.last_sign_date || '',
    unlockedMedals: stats.unlocked_medals || [],
    medals,
  });
};
