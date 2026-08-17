/**
 * GET /api/pay/packages
 * 返回充值套餐列表（无需登录）
 */
const { packages } = require('../../lib/config');
const { sendJson } = require('../../lib/utils');

module.exports = async (req, res) => {
  const list = Object.entries(packages).map(([id, pkg]) => ({
    id,
    name: pkg.name,
    price: pkg.price,
    coins: pkg.coins,
  }));
  return sendJson(res, 200, { ok: true, packages: list });
};
