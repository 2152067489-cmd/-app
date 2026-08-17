/**
 * GET /api/user/coins
 * 查询当前用户金币余额
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson } = require('../../lib/utils');

module.exports = async (req, res) => {
  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const { data: user } = await supabase
    .from('users').select('coins').eq('id', decoded.userId).maybeSingle();

  if (!user) {
    return sendJson(res, 404, { ok: false, msg: '用户不存在' });
  }

  return sendJson(res, 200, { ok: true, coins: user.coins });
};
