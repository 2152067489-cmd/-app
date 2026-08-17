/**
 * config.js - 全局配置（读取 .env 环境变量）
 */
require('dotenv').config();

const config = {
  // 服务器
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0', // 监听所有网卡，便于公网部署
  jwtSecret: process.env.JWT_SECRET || 'stitch_public_secret_change_me',
  jwtExpiresIn: '7d',

  // CORS 允许的来源（逗号分隔，* 表示允许所有，生产环境建议指定域名）
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()),

  // 注册限流：同一 IP 在时间窗口内最多注册 N 次
  rateLimit: {
    registerWindowMs: parseInt(process.env.REGISTER_WINDOW_MS) || 60 * 60 * 1000, // 1 小时
    registerMax: parseInt(process.env.REGISTER_MAX) || 5, // 每小时最多 5 次
  },

  // 虎皮椒支付配置
  xunhupay: {
    appId: process.env.XUNHUPAY_APP_ID || '',
    appSecret: process.env.XUNHUPAY_APP_SECRET || '',
    notifyUrl: process.env.XUNHUPAY_NOTIFY_URL || '',
    returnUrl: process.env.XUNHUPAY_RETURN_URL || '',
    apiUrl: 'https://api.xunhupay.com/payment.html',
  },

  // 充值套餐（后端统一管理，不信任前端金额）
  // price 单位：元；coins 单位：枚
  packages: {
    A: { price: 1,  coins: 1,   name: '1枚626金币' },
    B: { price: 7,  coins: 10,  name: '10枚626金币（推荐）' },
    C: { price: 30, coins: 50,  name: '50枚626金币' },
    D: { price: 68, coins: 120, name: '120枚626金币' },
  },

  // 订单配置
  order: {
    expireMinutes: 5,       // 订单有效期 5 分钟
    pollIntervalMs: 2000,   // 前端轮询间隔
    cleanupIntervalMs: 60000, // 后端定时清理间隔
  },
};

module.exports = config;
