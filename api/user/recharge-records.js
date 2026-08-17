/**
 * GET /api/user/recharge-records
 * 查询充值记录（最近 50 条）
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson } = require('../../lib/utils');

module.exports = async (req, res) => {
  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const { data: records } = await supabase
    .from('recharge_records')
    .select('*')
    .eq('user_id', decoded.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return sendJson(res, 200, { ok: true, records: records || [] });
};
