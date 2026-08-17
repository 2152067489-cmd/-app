/**
 * Catch-all 路由：/api/pay/*
 * 将支付相关请求分发到对应内部模块
 */
const packages = require('./_packages');
const create = require('./_create');
const status = require('./_status');
const notify = require('./_notify');
const devMarkSuccess = require('./_dev-mark-success');

module.exports = async (req, res) => {
  // req.query.path 是数组，如 ['packages'] 或 ['dev-mark-success']
  const action = (req.query.path && req.query.path[0]) || '';
  switch (action) {
    case 'packages': return packages(req, res);
    case 'create': return create(req, res);
    case 'status': return status(req, res);
    case 'notify': return notify(req, res);
    case 'dev-mark-success': return devMarkSuccess(req, res);
    default: return res.status(404).json({ ok: false, msg: 'Not found' });
  }
};
