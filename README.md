# 🌺 史迪奇学习乐园 - 公开网站版（Vercel + Supabase）

人人可注册使用的史迪奇主题学习签到网站。部署到 Vercel 后永久公网访问，无需常开电脑，手机随时可用。

## 功能

- 用户注册/登录（JWT 认证，bcrypt 加密，无预设账号）
- 每日签到 + 十枚勋章系统（史迪奇跳舞庆祝）
- 发现页签到日历（月历视图、漏签标记、月份切换）
- 补签功能（消耗 626 金币）
- 个人收款码充值（虎皮椒，支付宝/微信，自动到账检测）
- 我的页面（金币余额、充值记录、勋章、退出登录）
- 史迪奇桌面宠物（悬停 wink、拖拽、10 秒随机动作）
- 全站史迪奇风格 + 移动端适配

## 技术架构

| 层 | 技术 |
|----|------|
| 前端 | 纯原生 HTML/CSS/JS（静态托管） |
| 后端 | Vercel Serverless Functions（Node.js） |
| 数据库 | Supabase（PostgreSQL，免费版） |
| 支付 | 虎皮椒（个人收款码方案） |
| 认证 | JWT + bcryptjs |
| CDN | Vercel 全球 CDN + 自动 HTTPS |

## 环境要求

- Node.js ≥ 18（本地开发用 `vercel dev`）
- Vercel 账号（免费，用 GitHub 登录）
- Supabase 账号（免费版）
- 虎皮椒商户账号（个人收款码支付，可选）

## 快速部署（5 步上线）

### 第 1 步：Supabase 数据库准备

1. 访问 [supabase.com](https://supabase.com) 注册账号，创建新项目
2. 进入项目 → **SQL Editor** → 粘贴 `schema.sql` 内容 → **Run** 执行
3. 进入 **Settings → API**，记录以下信息：
   - `Project URL`（如 `https://xxxx.supabase.co`）
   - `service_role` secret key（仅服务端使用）
   - `anon` public key

### 第 2 步：虎皮椒支付配置（可选）

> 不配置则进入开发模式（模拟支付），适合先测试其他功能。

1. 访问 [虎皮椒官网](https://www.xunhupay.com) 注册商户
2. 绑定你的**个人支付宝/微信收款码**
3. 记录 **APPID** 和 **商户密钥**
4. 回调地址填写：`https://你的域名/api/pay/notify`

### 第 3 步：推送到 GitHub

```bash
git init
git add .
git commit -m "史迪奇学习乐园公开网站版"
git remote add origin https://github.com/你的用户名/stitch-study.git
git push -u origin main
```

### 第 4 步：Vercel 部署

1. 访问 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 点击 **New Project** → 选择刚推送的 GitHub 仓库
3. **Settings → Environment Variables**，添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `JWT_SECRET` | 随机长字符串（如 `a1b2c3d4e5...`） |
| `XUNHUPAY_APP_ID` | 虎皮椒 APPID（可选） |
| `XUNHUPAY_APP_SECRET` | 虎皮椒密钥（可选） |
| `XUNHUPAY_NOTIFY_URL` | `https://你的域名/api/pay/notify` |
| `XUNHUPAY_RETURN_URL` | `https://你的域名/study-checkin.html` |

4. 点击 **Deploy**，等待 1-2 分钟
5. 获得 `https://stitch-study-xxx.vercel.app` 永久公网地址

### 第 5 步：绑定自定义域名（可选）

1. Vercel 项目 → **Settings → Domains** → 添加域名
2. 在域名服务商处添加 CNAME 记录指向 Vercel
3. Vercel 自动签发 SSL 证书

## 本地开发

```bash
# 安装 Vercel CLI
npm i -g vercel

# 安装依赖
npm install

# 本地启动（自动加载 .env）
vercel dev
```

访问 `http://localhost:3000` 即可调试。`.env` 文件格式参考 `.env.example`。

## 项目结构

```
/
  study-checkin.html      前端单页应用（史迪奇风格，全功能）
  stitch-assets/          史迪奇素材 PNG
  vercel.json             Vercel 配置（函数超时 + 安全响应头）
  schema.sql              Supabase 建表脚本（含 RLS + 存储过程）
  package.json            依赖声明
  .env.example            环境变量模板
  /api                    Serverless 函数
    /auth
      login.js            登录（IP限流 + 账号锁定）
      register.js         注册（IP限流 + 自动登录）
      check.js            验证 token
    /user
      coins.js            查询金币
      signin.js           每日签到
      makeup-sign.js      补签（消耗626金币）
      sign-stats.js       签到统计 + 勋章
      calendar.js         签到日历
      recharge-records.js 充值记录
    /pay
      packages.js         套餐列表
      create.js           创建支付订单
      status.js           查询订单状态（含按需过期）
      notify.js           虎皮椒异步回调（验签+幂等+加金币）
      dev-mark-success.js 开发模式模拟支付成功
  /lib                    共享模块（Serverless 函数引用）
    db.js                 Supabase 客户端（service_role_key）
    auth.js               JWT + bcrypt 工具
    config.js             套餐/虎皮椒/勋章配置
    xunhupay.js           虎皮椒 API（签名/验签/创建订单）
    utils.js              工具函数（限流/日期/校验/响应）
  /server                 旧版 Express 后端（已弃用，保留参考）
```

## API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册（IP限流，自动登录） | ❌ |
| POST | `/api/auth/login` | 登录（IP限流+账号锁定） | ❌ |
| GET | `/api/auth/check` | 验证 token | ✅ |
| GET | `/api/user/coins` | 查询金币 | ✅ |
| POST | `/api/user/signin` | 签到 | ✅ |
| POST | `/api/user/makeup-sign` | 补签（-626金币） | ✅ |
| GET | `/api/user/sign-stats` | 签到统计+勋章 | ✅ |
| GET | `/api/user/calendar` | 月度签到日历 | ✅ |
| GET | `/api/user/recharge-records` | 充值记录 | ✅ |
| GET | `/api/pay/packages` | 套餐列表 | ❌ |
| POST | `/api/pay/create` | 创建订单 | ✅ |
| GET | `/api/pay/status` | 订单状态 | ❌ |
| POST | `/api/pay/notify` | 支付回调（虎皮椒） | ❌ |
| POST | `/api/pay/dev-mark-success` | 模拟支付（开发模式） | ✅ |

## 数据库表结构

| 表 | 说明 |
|----|------|
| `users` | 用户：id, account(唯一), password_hash, coins, failed_login_count, locked_until |
| `sign_records` | 签到记录：user_id, sign_date, is_makeup |
| `sign_stats` | 签到统计：user_id, total_days, continuous_days, last_sign_date, unlocked_medals |
| `orders` | 支付订单：order_no(唯一), user_id, package_id, amount, coins, pay_type, status |
| `recharge_records` | 充值记录：user_id, order_no, amount, coins, pay_type |

RLS 已启用（无策略），anon key 无法直接访问数据库，所有操作通过 Serverless 函数用 service_role key 完成。

## 安全措施

| 措施 | 说明 |
|------|------|
| HTTPS | Vercel 默认提供，HSTS 头强制加密 |
| CSP | vercel.json 配置内容安全策略 |
| X-Frame-Options: DENY | 防止点击劫持 |
| X-Content-Type-Options: nosniff | 防止 MIME 嗅探 |
| JWT 认证 | 所有数据接口校验 token |
| bcrypt | 密码加密存储 |
| RLS | Supabase 行级安全，anon key 无法访问 |
| 注册限流 | 同一 IP 每天最多 3 次注册 |
| 登录限流 | 同一 IP 每分钟最多 10 次，失败 5 次锁定 15 分钟 |
| 支付验签 | 虎皮椒 MD5 签名验证 |
| 订单幂等 | 同一订单号只充值一次 |
| 金额后端计算 | 不信任前端传的金额 |
| 参数化查询 | Supabase SDK 防止 SQL 注入 |

## 充值套餐

| 套餐 | 价格 | 金币 |
|------|------|------|
| A | ¥1 | 1 枚 |
| B | ¥7 | 10 枚（推荐）|
| C | ¥30 | 50 枚 |
| D | ¥68 | 120 枚 |

## 替换为其他支付平台

修改 `lib/xunhupay.js` 中的 API 地址、签名算法和验签逻辑即可。其他文件无需改动。

## 内网穿透调试（开发时）

虎皮椒回调需要公网 URL，Vercel 部署后直接用 Vercel 域名即可。
本地开发可用 ngrok：

```bash
ngrok http 3000
# 将 https://xxxx.ngrok.io 填入 XUNHUPAY_NOTIFY_URL
```

## 日常维护

- **无需常开电脑**：Vercel 自动运行
- **代码更新**：推送到 GitHub 后 Vercel 自动重新部署
- **查看日志**：Vercel Dashboard → 项目 → Functions → Logs
- **查看数据**：Supabase Dashboard → Table Editor
- **数据库备份**：Supabase 免费版提供每日自动备份

## 启动页署名

启动页保留"开发者：编号626的史迪奇大王"署名。
