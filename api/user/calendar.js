/**
 * GET /api/user/calendar?year=2026&month=8
 * 查询指定月份的签到日历数据
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson, getBeijingDateStr } = require('../../lib/utils');

module.exports = async (req, res) => {
  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const userId = decoded.userId;
  const query = req.query || {};
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const year = parseInt(query.year) || now.getUTCFullYear();
  const month = parseInt(query.month) || (now.getUTCMonth() + 1);

  // 构建月份范围
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const endDate = `${nextMonth.y}-${String(nextMonth.m).padStart(2, '0')}-01`;

  // 查询该月签到记录
  const { data: records } = await supabase
    .from('sign_records')
    .select('sign_date, is_makeup')
    .eq('user_id', userId)
    .gte('sign_date', startDate)
    .lt('sign_date', endDate);

  // 构建签到日期映射
  const signedDates = {};
  for (const r of records || []) {
    signedDates[r.sign_date] = { signed: true, isMakeup: r.is_makeup };
  }

  // 计算本月签到天数
  const monthSignedCount = Object.keys(signedDates).length;

  // 计算本月总天数
  const daysInMonth = new Date(year, month, 0).getDate();

  // 今天
  const today = getBeijingDateStr();

  return sendJson(res, 200, {
    ok: true,
    year,
    month,
    signedDates,
    monthSignedCount,
    daysInMonth,
    today,
  });
};
