/**
 * index.js - 服务器入口 + 定时任务
 *
 * 公开网站版本：监听 0.0.0.0，无预设账号，CORS 可配置。
 *
 * 启动步骤：
 * 1. cd server
 * 2. npm install
 * 3. cp .env.example .env （填写 JWT 密钥、支付平台参数）
 * 4. npm start
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { cleanupExpiredOrders } = require('./pay');

const app = express();

// ============================================================
// CORS 配置（生产环境通过 .env 指定允许的域名）
// ============================================================
const corsOptions = {
  origin(origin, cb) {
    // 允许非浏览器工具（如 curl，无 origin）和同源请求
    if (!origin) return cb(null, true);
    if (config.corsOrigins.includes('*')) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（前端页面）——由 Express 托管，也可改用 Nginx
const path = require('path');
const clientPath = path.join(__dirname, '..', '..');
app.use(express.static(clientPath));

// API 路由
app.use(routes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, msg: '史迪奇学习乐园服务器运行中', time: new Date().toISOString() });
});

// ============================================================
// 定时任务：每分钟清理超时订单
// ============================================================
setInterval(() => {
  cleanupExpiredOrders();
}, config.order.cleanupIntervalMs);
cleanupExpiredOrders(); // 启动时也清理一次

// ============================================================
// 启动服务器（监听 0.0.0.0，公网可访问）
// ============================================================
app.listen(config.port, config.host, () => {
  console.log('====================================================');
  console.log('  🌺 史迪奇学习乐园（公开网站版）已启动');
  console.log(`  📡 http://${config.host}:${config.port}`);
  console.log(`  💰 虎皮椒配置: ${config.xunhupay.appId ? '已配置' : '未配置（开发模式）'}`);
  console.log(`  🔐 JWT 密钥: ${config.jwtSecret === 'stitch_public_secret_change_me' ? '⚠️ 请修改默认密钥' : '已自定义'}`);
  console.log(`  🌐 CORS: ${config.corsOrigins.join(',')}`);
  console.log(`  ⏰ 超时清理: 每${config.order.cleanupIntervalMs / 1000}秒检查一次`);
  console.log('====================================================');
});
