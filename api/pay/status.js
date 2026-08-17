/**
 * GET /api/pay/status?orderNo=xxx
 * 查询订单状态（前端轮询用，含按需过期检查）
 */
const { supabase } = require('../../lib/db');
const { order } = require('../../lib/config');
const { sendJson, getQuery } = require('../../lib/utils');

module.exports = async (req, res) => {
  const { orderNo } = getQuery(req);

  if (!orderNo) {
    return sendJson(res, 400, { ok: false, msg: '缺少 orderNo 参数' });
  }

  const { data: orderRow } = await supabase
    .from('orders').select('*').eq('order_no', orderNo).maybeSingle();

  if (!orderRow) {
    return sendJson(res, 404, { ok: false, msg: '订单不存在' });
  }

  // 按需过期检查：pending 超过 5 分钟则标记为 expired
  if (orderRow.status === 'pending') {
    const createdAt = new Date(orderRow.created_at);
    const expireTime = new Date(createdAt.getTime() + order.expireMinutes * 60 * 1000);
    if (new Date() > expireTime) {
      await supabase.from('orders')
        .update({ status: 'expired' })
        .eq('order_no', orderNo)
        .eq('status', 'pending');
      orderRow.status = 'expired';
    }
  }

  return sendJson(res, 200, {
    ok: true,
    orderNo: orderRow.order_no,
    status: orderRow.status,
    coins: orderRow.coins,
    amount: orderRow.amount,
  });
};
