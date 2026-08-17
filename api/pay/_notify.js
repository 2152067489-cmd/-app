/**
 * POST /api/pay/notify
 * 虎皮椒支付异步回调（第三方平台调用）
 *
 * 验签 → 幂等检查 → 过期检查 → 更新订单状态 → 加金币 → 写充值记录
 * 返回纯文本 "success"（虎皮椒要求）
 */
const { supabase } = require('../../lib/db');
const { xunhupay } = require('../../lib/config');
const { verifyNotifySign } = require('../../lib/xunhupay');
const { getBody, getQuery } = require('../../lib/utils');

module.exports = async (req, res) => {
  // 虎皮椒可能以 POST form 或 GET 方式回调
  const params = { ...getQuery(req), ...getBody(req) };

  console.log('[pay/notify] 收到回调:', JSON.stringify(params));

  // 验签
  const isValid = verifyNotifySign(params, xunhupay.appSecret);
  if (!isValid) {
    console.error('[pay/notify] 签名验证失败');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('fail');
  }

  const orderNo = params.trade_order_id || params.out_trade_no;
  if (!orderNo) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('fail');
  }

  // 查询订单
  const { data: orderRow } = await supabase
    .from('orders').select('*').eq('order_no', orderNo).maybeSingle();

  if (!orderRow) {
    console.error('[pay/notify] 订单不存在:', orderNo);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('fail');
  }

  // 幂等：已成功则直接返回 success
  if (orderRow.status === 'success') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('success');
  }

  // 过期订单不充值（需人工核对退款）
  if (orderRow.status === 'expired') {
    console.error('[pay/notify] 订单已过期，不充值:', orderNo);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('fail');
  }

  // 原子更新订单状态（pending → success）
  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'success', paid_at: new Date().toISOString() })
    .eq('order_no', orderNo)
    .eq('status', 'pending')
    .select();

  if (updateErr || !updated || updated.length === 0) {
    // 可能已被并发处理
    console.error('[pay/notify] 订单状态更新失败:', orderNo, updateErr?.message);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('success'); // 仍返回 success 避免平台重试
  }

  // 加金币（使用 RPC 确保原子性）
  const { data: newBalance } = await supabase
    .rpc('add_coins', { p_user_id: orderRow.user_id, p_amount: orderRow.coins });

  // 写充值记录
  await supabase.from('recharge_records').insert({
    user_id: orderRow.user_id,
    order_no: orderNo,
    amount: orderRow.amount,
    coins: orderRow.coins,
    pay_type: orderRow.pay_type,
  });

  console.log(`[pay/notify] 充值成功: ${orderNo}, 用户 ${orderRow.user_id} +${orderRow.coins} 金币`);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  return res.end('success');
};
