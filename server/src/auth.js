/**
 * auth.js - 登录 / 注册 / JWT 认证
 *
 * 公开网站版本：无预设账号、无开发者账号，所有用户均通过注册创建。
 * 所有用户角色统一为 'user'。
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { stmts } = require('./db');

// ============================================================
// 注册（新用户初始金币 0）
// ============================================================
function register(account, password) {
  const acc = (account || '').trim();
  if (acc.length < 4 || acc.length > 20) {
    return { ok: false, msg: '账号长度需4-20位' };
  }
  if (!password || password.length < 6) {
    return { ok: false, msg: '密码至少6位' };
  }

  const existing = stmts.findUserByAccount.get(acc);
  if (existing) {
    return { ok: false, msg: '该账号已被注册' };
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = stmts.insertUser.run(acc, hashed, 'user', 0);
  // 初始化签到统计
  stmts.upsertSignStats.run(result.lastInsertRowid, 0, 0, '', '[]');

  // 注册成功后直接生成 token（自动登录）
  const user = stmts.findUserById.get(result.lastInsertRowid);
  const token = jwt.sign(
    { userId: user.id, account: user.account, role: 'user' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    ok: true,
    msg: '注册成功',
    token,
    user: { id: user.id, account: user.account, role: 'user', coins: 0 },
  };
}

// ============================================================
// 登录（返回 JWT token）
// ============================================================
function login(account, password) {
  if (!account || !password) {
    return { ok: false, msg: '账号和密码不能为空' };
  }

  const user = stmts.findUserByAccount.get(account.trim());
  if (!user) {
    return { ok: false, msg: '账号或密码错误' };
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return { ok: false, msg: '账号或密码错误' };
  }

  // 生成 JWT（角色统一为 user，忽略数据库中可能存在的旧角色）
  const token = jwt.sign(
    { userId: user.id, account: user.account, role: 'user' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    ok: true,
    token,
    user: {
      id: user.id,
      account: user.account,
      role: 'user',
      coins: user.coins,
    },
  };
}

// ============================================================
// JWT 验证中间件
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, msg: '未登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    req.userAccount = decoded.account;
    req.userRole = 'user';
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, msg: '登录已过期，请重新登录' });
  }
}

module.exports = { register, login, authMiddleware };
