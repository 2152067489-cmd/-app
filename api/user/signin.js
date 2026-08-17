/**
 * POST /api/user/signin
 * 每日签到（北京时间）
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson, getBeijingDateStr, getYesterdayStr, recalcContinuousDays, checkMedalUnlock } = require('../../lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, msg: 'Method not allowed' });

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const userId = decoded.userId;
  const today = getBeijingDateStr();
  const yesterday = getYesterdayStr();

  // 检查今日是否已签到
  const { data: existing } = await supabase
    .from('sign_records').select('id').eq('user_id', userId).eq('sign_date', today).maybeSingle();

  if (existing) {
    return sendJson(res, 400, { ok: false, msg: '今天已签到' });
  }

  // 写入签到记录
  await supabase.from('sign_records').insert({
    user_id: userId,
    sign_date: today,
    is_makeup: false,
  });

  // 获取所有签到日期（用于计算连续天数）
  const { data: allSigns } = await supabase
    .from('sign_records').select('sign_date').eq('user_id', userId);
  const signSet = new Set((allSigns || []).map(r => r.sign_date));

  // 计算统计
  const totalDays = signSet.size;
  const continuousDays = recalcContinuousDays(signSet, today, yesterday);

  // 获取当前统计
  const { data: stats } = await supabase
    .from('sign_stats').select('unlocked_medals').eq('user_id', userId).maybeSingle();
  const currentMedals = stats?.unlocked_medals || [];

  // 检查勋章解锁
  const { unlockedMedals, newlyUnlocked } = checkMedalUnlock(totalDays, currentMedals);

  // 更新统计
  await supabase.from('sign_stats').upsert({
    user_id: userId,
    total_days: totalDays,
    continuous_days: continuousDays,
    last_sign_date: today,
    unlocked_medals: unlockedMedals,
  });

  return sendJson(res, 200, {
    ok: true,
    msg: '签到成功',
    totalDays,
    continuousDays,
    newMedals: newlyUnlocked,
    unlockedMedals,
  });
};
