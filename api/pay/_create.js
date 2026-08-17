/**
 * POST /api/pay/create
 * 创建支付订单（金额由后端从套餐配置计算，不信任前端）
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { packages, order } = require('../../lib/config');
const { createPayment } = require('../../lib/xunhupay');
const { sendJson, getBody, genOrderNo } = require('../../lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, msg: 'Method not allowed' });

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const { packageId, payType } = getBody(req);

  // 校验套餐
  const pkg = packages[packageId];
  if (!pkg) {
    return sendJson(res, 400, { ok: false, msg: '无效的充值套餐' });
  }

  // 校验支付方式
  if (!['alipay', 'wechat'].includes(payType)) {
    return sendJson(res, 400, { ok: false, msg: '无效的支付方式' });
  }

  // 生成订单号
  const orderNo = genOrderNo();

  // 调用虎皮椒创建支付
  const payResult = await createPayment({
    outTradeNo: orderNo,
    totalFee: pkg.price,
    body: `史迪奇充值-${pkg.name}`,
    payType,
  });

  if (!payResult.ok) {
    return sendJson(res, 500, { ok: false, msg: payResult.msg || '创建支付订单失败' });
  }

  // 写入订单
  const { error } = await supabase.from('orders').insert({
    order_no: orderNo,
    user_id: decoded.userId,
    package_id: packageId,
    amount: pkg.price,
    coins: pkg.coins,
    pay_type: payType,
    status: 'pending',
    qr_code_url: payResult.qrCodeUrl,
  });

  if (error) {
    console.error('[pay/create] 写入订单失败:', error.message);
    return sendJson(res, 500, { ok: false, msg: '创建订单失败' });
  }

  const expireTime = new Date(Date.now() + order.expireMinutes * 60 * 1000);

  return sendJson(res, 200, {
    ok: true,
    orderNo,
    qrCodeUrl: payResult.qrCodeUrl,
    amount: pkg.price,
    coins: pkg.coins,
    payType,
    devMode: payResult.devMode || false,
    expireTime: expireTime.toISOString(),
  });
};
