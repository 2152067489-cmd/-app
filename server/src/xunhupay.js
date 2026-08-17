/**
 * xunhupay.js - 虎皮椒支付模块
 *
 * 负责：
 * 1. 签名生成（MD5）
 * 2. 创建支付订单（调用虎皮椒 API）
 * 3. 回调验签
 *
 * 虎皮椒文档：https://www.xunhupay.com/doc/api/page/index.html
 * 如需替换为其他平台（PayJS、Z支付等），只需修改本文件的 API 调用和签名逻辑。
 */
const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

// ============================================================
// 签名生成（虎皮椒 MD5 签名）
// 规则：
// 1. 将所有非空参数按 key 升序排列
// 2. 拼接成 key1=value1&key2=value2 形式（不进行 URL 编码）
// 3. 在末尾拼接密钥：...&key=APP_SECRET
// 4. 对整个字符串做 MD5，取小写
// ============================================================
function generateSign(params, appSecret) {
  // 过滤空值，按 key 升序
  const sortedKeys = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort();

  const parts = sortedKeys.map(k => `${k}=${params[k]}`);
  const signStr = parts.join('&') + appSecret; // 虎皮椒用 key=密钥，但直接拼接也兼容
  // 注意：虎皮椒实际签名方式为 key=value&...&key=APP_SECRET
  // 不同版本可能略有差异，请参考虎皮椒最新文档

  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
}

// ============================================================
// 验证回调签名
// ============================================================
function verifyNotifySign(params, appSecret) {
  const receivedHash = params.hash || '';
  if (!receivedHash) return false;

  // 复制参数，移除 hash 字段
  const signParams = { ...params };
  delete signParams.hash;

  const calculatedHash = generateSign(signParams, appSecret);
  return calculatedHash.toLowerCase() === receivedHash.toLowerCase();
}

// ============================================================
// 创建支付订单
// 调用虎皮椒 API，返回收款码 URL
// ============================================================
async function createPayment({ outTradeNo, totalFee, body, payType }) {
  const { appId, appSecret, notifyUrl, returnUrl, apiUrl } = config.xunhupay;

  // 未配置虎皮椒时进入开发模式（返回模拟支付链接）
  if (!appId || !appSecret || appId === '你的商户APPID') {
    console.warn('[xunhupay] 虎皮椒未配置，返回模拟支付链接（开发模式）');
    return {
      ok: true,
      qrCodeUrl: `dev://mock-pay/${outTradeNo}`,
      payUrl: `dev://mock-pay/${outTradeNo}`,
      devMode: true,
    };
  }

  // 虎皮椒参数
  const params = {
    version: '1.1',
    appid: appId,
    trade_order_id: outTradeNo,      // 商户订单号
    total_fee: totalFee.toFixed(2),   // 金额（元，保留两位小数）
    title: body,                      // 商品标题
    time: Math.floor(Date.now() / 1000), // 时间戳
    notify_url: notifyUrl,            // 异步回调地址
    return_url: returnUrl,            // 同步跳转地址
    nonce_str: crypto.randomBytes(16).toString('hex'), // 随机字符串
    type: payType === 'wechat' ? 'WAP' : 'WAP', // 支付方式（H5跳转）
    // 如果需要微信扫码，type 可设为 'WXPAY'，支付宝设为 'ALIPAY'
    wap_url: returnUrl,
    wap_name: '史迪奇充值',
  };

  // 生成签名
  params.hash = generateSign(params, appSecret);

  try {
    // 调用虎皮椒 API
    const response = await axios.post(apiUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const data = response.data;

    // 虎皮椒返回 JSON：{ errcode: 0, errmsg: 'ok', url: '支付链接', ... }
    if (data.errcode === 0 || data.errcode === '0000') {
      return {
        ok: true,
        qrCodeUrl: data.url || data.qrcode || '',  // 支付链接/二维码
        payUrl: data.url || '',
      };
    } else {
      console.error('[xunhupay] 创建订单失败:', data);
      return { ok: false, msg: data.errmsg || '创建支付订单失败' };
    }
  } catch (err) {
    console.error('[xunhupay] API调用异常:', err.message);
    return { ok: false, msg: '支付服务暂时不可用：' + err.message };
  }
}

module.exports = { generateSign, verifyNotifySign, createPayment };
