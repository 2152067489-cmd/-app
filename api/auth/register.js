/**
 * POST /api/auth/register
 * 注册新用户（IP 限流，成功后自动返回 token）
 */
const { supabase } = require('../../lib/db');
const { signToken, hashPassword } = require('../../lib/auth');
const { sendJson, getBody, getClientIp, validateAccount, validatePassword, checkRateLimit } = require('../../lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, msg: 'Method not allowed' });

  // IP 限流：每 IP 每天最多 3 次注册
  const ip = getClientIp(req);
  const rl = checkRateLimit(`register:${ip}`, 24 * 3600 * 1000, 3);
  if (!rl.allowed) {
    return sendJson(res, 429, { ok: false, msg: `注册过于频繁，请 ${rl.retryAfterSec} 秒后再试` });
  }

  const { account, password } = getBody(req);

  // 输入校验
  if (!validateAccount(account)) {
    return sendJson(res, 400, { ok: false, msg: '账号需4-20位，仅含字母数字下划线中文' });
  }
  if (!validatePassword(password)) {
    return sendJson(res, 400, { ok: false, msg: '密码至少6位' });
  }

  const acc = account.trim();

  // 检查账号唯一性
  const { data: existing } = await supabase.from('users').select('id').eq('account', acc).maybeSingle();
  if (existing) {
    return sendJson(res, 409, { ok: false, msg: '该账号已被注册' });
  }

  // 创建用户
  const passwordHash = hashPassword(password);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ account: acc, password_hash: passwordHash, coins: 0 })
    .select('id, account, coins')
    .single();

  if (error || !user) {
    console.error('[register] 创建用户失败:', error?.message);
    return sendJson(res, 500, { ok: false, msg: '注册失败，请稍后重试' });
  }

  // 初始化签到统计
  await supabase.from('sign_stats').insert({
    user_id: user.id,
    total_days: 0,
    continuous_days: 0,
    unlocked_medals: [],
  });

  // 签发 token（自动登录）
  const token = signToken(user);

  return sendJson(res, 200, {
    ok: true,
    msg: '注册成功',
    token,
    user: { id: user.id, account: user.account, role: 'user', coins: 0 },
  });
};
