/**
 * POST /api/user/makeup-sign
 * 补签（消耗 626 金币）
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { MAKEUP_COST } = require('../../lib/config');
const { sendJson, getBody, getBeijingDateStr, getYesterdayStr, recalcContinuousDays, checkMedalUnlock } = require('../../lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, msg: 'Method not allowed' });

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const userId = decoded.userId;
  const { date: dateStr } = getBody(req);

  if (!dateStr) {
    return sendJson(res, 400, { ok: false, msg: '请选择补签日期' });
  }

  const today = getBeijingDateStr();

  // 不能补签今天或未来
  if (dateStr >= today) {
    return sendJson(res, 400, { ok: false, msg: '今天和未来的日期不能补签' });
  }

  // 只能补签最近 30 天
  const [ty, tm, td] = today.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const diffDays = Math.floor((new Date(ty, tm - 1, td) - new Date(dy, dm - 1, dd)) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) {
    return sendJson(res, 400, { ok: false, msg: '只能补签最近30天内的漏签' });
  }

  // 检查是否已签到
  const { data: existing } = await supabase
    .from('sign_records').select('id').eq('user_id', userId).eq('sign_date', dateStr).maybeSingle();
  if (existing) {
    return sendJson(res, 400, { ok: false, msg: '该日期已签到' });
  }

  // 检查金币并扣除（使用 RPC 确保原子性）
  const { data: deductOk, error: deductErr } = await supabase
    .rpc('deduct_coins', { p_user_id: userId, p_amount: MAKEUP_COST });

  if (deductErr || !deductOk) {
    // 查询当前余额给出提示
    const { data: u } = await supabase.from('users').select('coins').eq('id', userId).maybeSingle();
    return sendJson(res, 400, {
      ok: false,
      msg: `金币不足，补签需要 ${MAKEUP_COST} 金币`,
      coins: u?.coins || 0,
      cost: MAKEUP_COST,
    });
  }

  // 写入补签记录
  await supabase.from('sign_records').insert({
    user_id: userId,
    sign_date: dateStr,
    is_makeup: true,
  });

  // 重新计算统计
  const { data: allSigns } = await supabase
    .from('sign_records').select('sign_date').eq('user_id', userId);
  const signSet = new Set((allSigns || []).map(r => r.sign_date));
  const totalDays = signSet.size;
  const yesterday = getYesterdayStr();
  const continuousDays = recalcContinuousDays(signSet, today, yesterday);

  // 勋章检查
  const { data: stats } = await supabase
    .from('sign_stats').select('unlocked_medals').eq('user_id', userId).maybeSingle();
  const currentMedals = stats?.unlocked_medals || [];
  const { unlockedMedals, newlyUnlocked } = checkMedalUnlock(totalDays, currentMedals);

  // 更新统计（last_sign_date 不被补签覆盖）
  const { data: prevStats } = await supabase
    .from('sign_stats').select('last_sign_date').eq('user_id', userId).maybeSingle();
  await supabase.from('sign_stats').upsert({
    user_id: userId,
    total_days: totalDays,
    continuous_days: continuousDays,
    last_sign_date: prevStats?.last_sign_date || today,
    unlocked_medals: unlockedMedals,
  });

  // 查询扣除后的余额
  const { data: user } = await supabase.from('users').select('coins').eq('id', userId).maybeSingle();

  return sendJson(res, 200, {
    ok: true,
    msg: '补签成功',
    coins: user?.coins || 0,
    cost: MAKEUP_COST,
    totalDays,
    continuousDays,
    newMedals: newlyUnlocked,
  });
};
