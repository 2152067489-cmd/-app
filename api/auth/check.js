/**
 * GET /api/auth/check
 * 验证 JWT token 是否有效，返回当前用户信息
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson } = require('../../lib/utils');

module.exports = async (req, res) => {
  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const { data: user } = await supabase
    .from('users').select('id, account, coins').eq('id', decoded.userId).maybeSingle();

  if (!user) {
    return sendJson(res, 404, { ok: false, msg: '用户不存在' });
  }

  return sendJson(res, 200, {
    ok: true,
    user: { id: user.id, account: user.account, role: 'user', coins: user.coins },
  });
};
