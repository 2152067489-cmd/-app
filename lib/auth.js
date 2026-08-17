/**
 * lib/auth.js - JWT 认证工具 + bcrypt 密码加密
 *
 * 用于 Serverless 函数：生成/验证 JWT token，密码哈希/比对。
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_please';
const JWT_EXPIRES = '7d';

// 签发 JWT token
function signToken(user) {
  return jwt.sign(
    { userId: user.id, account: user.account },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// 验证 Authorization 头中的 JWT，返回解码后的 payload 或 null
function verifyToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// 鉴权中间件（Serverless 版）：验证失败时直接返回 401，成功返回 decoded
function requireAuth(req, res) {
  const decoded = verifyToken(req);
  if (!decoded) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, msg: '未登录或登录已过期' }));
    return null;
  }
  return decoded;
}

// 密码哈希
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// 密码比对
function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

module.exports = { signToken, verifyToken, requireAuth, hashPassword, comparePassword };
