/**
 * lib/xunhupay.js - 虎皮椒支付集成（API调用 / 签名 / 验签）
 *
 * 未配置虎皮椒时自动进入开发模式，返回模拟支付链接。
 */
const crypto = require('crypto');
const axios = require('axios');
const { xunhupay } = require('./config');

// 生成 MD5 签名
function generateSign(params, appSecret) {
  const sortedKeys = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort();
  const parts = sortedKeys.map(k => `${k}=${params[k]}`);
  const signStr = parts.join('&') + appSecret;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
}

// 验证回调签名
function verifyNotifySign(params, appSecret) {
  const hash = params.hash || params.sign;
  if (!hash) return false;
  const { hash: _h, sign: _s, ...rest } = params;
  const expected = generateSign(rest, appSecret);
  return hash === expected;
}

// 创建支付订单
async function createPayment({ outTradeNo, totalFee, body, payType }) {
  const { appId, appSecret, notifyUrl, returnUrl, apiUrl } = xunhupay;

  // 未配置虎皮椒时进入开发模式
  if (!appId || !appSecret || appId === '你的商户APPID') {
    console.warn('[xunhupay] 虎皮椒未配置，返回模拟支付链接（开发模式）');
    return {
      ok: true,
      qrCodeUrl: `dev://mock-pay/${outTradeNo}`,
      devMode: true,
    };
  }

  const params = {
    version: '1.1',
    appid: appId,
    trade_order_id: outTradeNo,
    total_fee: totalFee.toFixed(2),
    title: body,
    time: Math.floor(Date.now() / 1000),
    notify_url: notifyUrl,
    return_url: returnUrl,
    nonce_str: crypto.randomBytes(16).toString('hex'),
    type: 'WAP',
    wap_url: returnUrl,
    wap_name: '史迪奇充值',
  };
  params.hash = generateSign(params, appSecret);

  try {
    const response = await axios.post(apiUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    return {
      ok: true,
      qrCodeUrl: response.data.url || response.data.qrcode || '',
      payUrl: response.data.url || response.data.qrcode || '',
    };
  } catch (err) {
    console.error('[xunhupay] API调用异常:', err.message);
    return { ok: false, msg: '支付服务暂时不可用：' + err.message };
  }
}

module.exports = { generateSign, verifyNotifySign, createPayment };
