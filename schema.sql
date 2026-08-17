-- ============================================================
-- 史迪奇学习乐园 - Supabase 数据库建表脚本
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ============================================================

-- ============================================================
-- 1. 数据表
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account             TEXT UNIQUE NOT NULL,          -- 账号（4-20位）
  password_hash       TEXT NOT NULL,                 -- bcrypt 加密
  coins               INTEGER DEFAULT 0,             -- 626金币余额
  failed_login_count  INTEGER DEFAULT 0,             -- 登录失败次数
  locked_until        TIMESTAMPTZ,                   -- 锁定截止时间
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 签到记录表
CREATE TABLE IF NOT EXISTS sign_records (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sign_date   DATE NOT NULL,                         -- 签到日期（北京时间）
  is_makeup   BOOLEAN DEFAULT FALSE,                 -- 是否补签
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sign_date)
);

-- 签到统计表
CREATE TABLE IF NOT EXISTS sign_stats (
  user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_days        INTEGER DEFAULT 0,
  continuous_days   INTEGER DEFAULT 0,
  last_sign_date    DATE,
  unlocked_medals   JSONB DEFAULT '[]'::jsonb        -- 已解锁勋章等级数组
);

-- 支付订单表
CREATE TABLE IF NOT EXISTS orders (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_no      TEXT UNIQUE NOT NULL,                -- 商户订单号
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id    TEXT NOT NULL,                        -- A/B/C/D
  amount        NUMERIC(10,2) NOT NULL,               -- 金额（元）
  coins         INTEGER NOT NULL,                     -- 金币数
  pay_type      TEXT NOT NULL,                        -- alipay / wechat
  status        TEXT DEFAULT 'pending',               -- pending/success/expired/failed
  qr_code_url   TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);

-- 充值记录表
CREATE TABLE IF NOT EXISTS recharge_records (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_no    TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  coins       INTEGER NOT NULL,
  pay_type    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sign_records_user_date ON sign_records(user_id, sign_date);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_recharge_user ON recharge_records(user_id);

-- ============================================================
-- 3. 存储过程（确保原子性）
-- ============================================================

-- 原子加金币
CREATE OR REPLACE FUNCTION add_coins(p_user_id BIGINT, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE users SET coins = coins + p_amount WHERE id = p_user_id
  RETURNING coins INTO new_balance;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- 原子扣金币（余额不足时返回 FALSE）
CREATE OR REPLACE FUNCTION deduct_coins(p_user_id BIGINT, p_amount INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users SET coins = coins - p_amount
  WHERE id = p_user_id AND coins >= p_amount;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. 行级安全（RLS）
-- 启用 RLS 但不创建策略 → anon key 无法直接访问任何表
-- 所有数据操作通过 Serverless 函数用 service_role_key 完成（绕过 RLS）
-- 即使 anon key 泄露，也无法直接读写数据库
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE recharge_records ENABLE ROW LEVEL SECURITY;
