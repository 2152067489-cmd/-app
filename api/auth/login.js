/**
 * POST /api/auth/login
 * 登录（含 IP 限流 + 账号锁定保护）
 */
const { supabase } = require('../../lib/db');
const { signToken, comparePassword } = require('../../lib/auth');
const { sendJson, getBody, getClientIp, checkRateLimit } = require('../../lib/utils');

const LOCK_THRESHOLD = 5;        // 连续失败 5 次锁定
const LOCK_DURATION_MS = 15 * 60 * 1000; // 锁定 15 分钟

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, msg: 'Method not allowed' });

  // IP 限流：每 IP 每分钟最多 10 次登录尝试
  const ip = getClientIp(req);
  const rl = checkRateLimit(`login:${ip}`, 60 * 1000, 10);
  if (!rl.allowed) {
    return sendJson(res, 429, { ok: false, msg: '尝试过于频繁，请稍后再试' });
  }

  const { account, password } = getBody(req);
  if (!account || !password) {
    return sendJson(res, 400, { ok: false, msg: '账号和密码不能为空' });
  }

  const acc = account.trim();
  const { data: user } = await supabase
    .from('users').select('*').eq('account', acc).maybeSingle();

  if (!user) {
    return sendJson(res, 401, { ok: false, msg: '账号或密码错误' });
  }

  // 检查账号是否被锁定
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainMin = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return sendJson(res, 423, { ok: false, msg: `账号已锁定，请 ${remainMin} 分钟后再试` });
  }

  // 密码比对
  if (!comparePassword(password, user.password_hash)) {
    const newFailCount = (user.failed_login_count || 0) + 1;
    const updates = { failed_login_count: newFailCount };
    if (newFailCount >= LOCK_THRESHOLD) {
      updates.locked_until = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    }
    await supabase.from('users').update(updates).eq('id', user.id);
    return sendJson(res, 401, { ok: false, msg: '账号或密码错误' });
  }

  // 登录成功：重置失败计数
  await supabase.from('users')
    .update({ failed_login_count: 0, locked_until: null }).eq('id', user.id);

  const token = signToken(user);
  return sendJson(res, 200, {
    ok: true,
    token,
    user: { id: user.id, account: user.account, role: 'user', coins: user.coins },
  });
};
