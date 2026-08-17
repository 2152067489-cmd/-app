/**
 * db.js - SQLite 数据库初始化与操作
 *
 * 使用 Node.js 22+ 内置的 node:sqlite 模块（DatabaseSync）
 * API 与 better-sqlite3 高度兼容，无需安装 native 依赖
 *
 * 注意：node:sqlite 目前为实验性 API，启动时会有警告，但不影响使用
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));
db.exec('PRAGMA journal_mode = WAL'); // 提升并发写入性能

// ============================================================
// 建表
// ============================================================
db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account     TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,           -- bcrypt 加密
    role        TEXT DEFAULT 'user',     -- user / developer
    coins       INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 签到记录表（按日期记录）
  CREATE TABLE IF NOT EXISTS sign_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    sign_date   TEXT NOT NULL,           -- YYYY-MM-DD
    is_makeup   INTEGER DEFAULT 0,       -- 0=正常签到, 1=补签
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, sign_date),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 签到统计表
  CREATE TABLE IF NOT EXISTS sign_stats (
    user_id           INTEGER PRIMARY KEY,
    total_days        INTEGER DEFAULT 0,
    continuous_days   INTEGER DEFAULT 0,
    last_sign_date    TEXT DEFAULT '',
    unlocked_medals   TEXT DEFAULT '[]', -- JSON 数组
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 支付订单表
  CREATE TABLE IF NOT EXISTS pay_orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no      TEXT UNIQUE NOT NULL,   -- 商户订单号
    user_id       INTEGER NOT NULL,
    package_id    TEXT NOT NULL,           -- A/B/C/D
    amount        REAL NOT NULL,           -- 金额（元）
    coins         INTEGER NOT NULL,        -- 金币数
    pay_type      TEXT NOT NULL,           -- alipay / wechat
    status        TEXT DEFAULT 'pending',  -- pending/success/expired/failed
    qr_code_url   TEXT DEFAULT '',         -- 收款码链接
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at       DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 充值记录表
  CREATE TABLE IF NOT EXISTS recharge_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    order_no    TEXT NOT NULL,
    amount      REAL NOT NULL,
    coins       INTEGER NOT NULL,
    pay_type    TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ============================================================
// 预处理语句（提升性能）
// ============================================================
const stmts = {
  // 用户
  findUserByAccount: db.prepare('SELECT * FROM users WHERE account = ?'),
  findUserById:      db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser:        db.prepare('INSERT INTO users (account, password, role, coins) VALUES (?, ?, ?, ?)'),
  updateCoins:       db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?'),
  getUserCoins:      db.prepare('SELECT coins FROM users WHERE id = ?'),

  // 签到
  findSignRecord:    db.prepare('SELECT * FROM sign_records WHERE user_id = ? AND sign_date = ?'),
  insertSignRecord:  db.prepare('INSERT INTO sign_records (user_id, sign_date, is_makeup) VALUES (?, ?, ?)'),
  getSignStats:      db.prepare('SELECT * FROM sign_stats WHERE user_id = ?'),
  upsertSignStats:   db.prepare(`
    INSERT INTO sign_stats (user_id, total_days, continuous_days, last_sign_date, unlocked_medals)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      total_days = excluded.total_days,
      continuous_days = excluded.continuous_days,
      last_sign_date = excluded.last_sign_date,
      unlocked_medals = excluded.unlocked_medals
  `),
  countSignedDates:  db.prepare('SELECT COUNT(*) as cnt FROM sign_records WHERE user_id = ? AND sign_date <= ?'),
  getRecentSigns:    db.prepare('SELECT sign_date FROM sign_records WHERE user_id = ? ORDER BY sign_date DESC LIMIT ?'),

  // 支付订单
  insertOrder:       db.prepare(`INSERT INTO pay_orders (order_no, user_id, package_id, amount, coins, pay_type, status, qr_code_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  findOrderByNo:     db.prepare('SELECT * FROM pay_orders WHERE order_no = ?'),
  updateOrderStatus: db.prepare('UPDATE pay_orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE order_no = ? AND status = ?'),
  findPendingOrders: db.prepare(`SELECT * FROM pay_orders WHERE status = 'pending' AND created_at < datetime('now', ?)`),

  // 充值记录
  insertRecharge:    db.prepare('INSERT INTO recharge_records (user_id, order_no, amount, coins, pay_type) VALUES (?, ?, ?, ?, ?)'),
  getRechargeList:   db.prepare('SELECT * FROM recharge_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'),
};

module.exports = { db, stmts };
