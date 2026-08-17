/**
 * Catch-all 路由：/api/user/*
 * 将用户相关请求分发到对应内部模块
 */
const coins = require('./_coins');
const signin = require('./_signin');
const makeupSign = require('./_makeup-sign');
const signStats = require('./_sign-stats');
const calendar = require('./_calendar');
const rechargeRecords = require('./_recharge-records');

module.exports = async (req, res) => {
  // req.query.path 是数组，如 ['coins'] 或 ['makeup-sign']
  const action = (req.query.path && req.query.path[0]) || '';
  switch (action) {
    case 'coins': return coins(req, res);
    case 'signin': return signin(req, res);
    case 'makeup-sign': return makeupSign(req, res);
    case 'sign-stats': return signStats(req, res);
    case 'calendar': return calendar(req, res);
    case 'recharge-records': return rechargeRecords(req, res);
    default: return res.status(404).json({ ok: false, msg: 'Not found' });
  }
};
