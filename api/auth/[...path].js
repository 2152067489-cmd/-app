/**
 * Catch-all 路由：/api/auth/*
 * 将认证相关请求分发到对应内部模块
 */
const login = require('./_login');
const register = require('./_register');
const check = require('./_check');

module.exports = async (req, res) => {
  // req.query.path 是数组，如 ['login'] 或 ['register']
  const action = (req.query.path && req.query.path[0]) || '';
  switch (action) {
    case 'login': return login(req, res);
    case 'register': return register(req, res);
    case 'check': return check(req, res);
    default: return res.status(404).json({ ok: false, msg: 'Not found' });
  }
};
