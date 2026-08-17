/**
 * POST /api/pay/dev-mark-success
 * 开发模式模拟支付成功（虎皮椒未配置时用于测试）
 *
 * 生产环境中此接口仍然可用（需登录），但只有在未配置真实支付时才有意义。
 */
const { supabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { sendJson, getBody } = require('../../lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, msg: 'Method not allowed' });

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const { orderNo } = getBody(req);
  if (!orderNo) {
    return sendJson(res, 400, { ok: false, msg: '缺少 orderNo' });
  }

  // 查询订单
  const { data: orderRow } = await supabase
    .from('orders').select('*').eq('order_no', orderNo).maybeSingle();

  if (!orderRow) {
    return sendJson(res, 404, { ok: false, msg: '订单不存在' });
  }

  // 权限检查：只能模拟自己的订单
  if (orderRow.user_id !== decoded.userId) {
    return sendJson(res, 403, { ok: false, msg: '无权操作' });
  }

  // 幂等检查
  if (orderRow.status === 'success') {
    return sendJson(res, 200, { ok: true, msg: '订单已成功', coins: orderRow.coins });
  }

  if (orderRow.status === 'expired') {
    return sendJson(res, 400, { ok: false, msg: '订单已过期' });
  }

  // 原子更新：pending → success
  const { data: updated } = await supabase
    .from('orders')
    .update({ status: 'success', paid_at: new Date().toISOString() })
    .eq('order_no', orderNo)
    .eq('status', 'pending')
    .select();

  if (!updated || updated.length === 0) {
    return sendJson(res, 400, { ok: false, msg: '订单状态更新失败' });
  }

  // 加金币
  const { data: newBalance } = await supabase
    .rpc('add_coins', { p_user_id: decoded.userId, p_amount: orderRow.coins });

  // 写充值记录
  await supabase.from('recharge_records').insert({
    user_id: decoded.userId,
    order_no: orderNo,
    amount: orderRow.amount,
    coins: orderRow.coins,
    pay_type: orderRow.pay_type,
  });

  return sendJson(res, 200, {
    ok: true,
    msg: '模拟支付成功',
    coins: orderRow.coins,
    balance: newBalance,
  });
};
