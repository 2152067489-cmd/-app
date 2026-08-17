# 🌺 史迪奇学习乐园 - 公开网站版

人人可注册使用的史迪奇主题学习签到网站，含个人收款码支付（虎皮椒）、签到勋章、补签、626 金币系统。

- 后端：Node.js + Express + SQLite（内置 `node:sqlite`，无需 native 编译）
- 前端：纯原生 HTML/CSS/JS，史迪奇风格
- 支付：第三方个人收款码方案（默认虎皮椒 xunhupay）
- 认证：JWT + bcrypt，无预设账号，所有用户自行注册

## 环境要求

- **Node.js ≥ 22**（使用内置 `node:sqlite` 模块，无需安装 better-sqlite3）

```bash
node --version  # 确认 >= v22
```

## 快速开始（开发环境）

```bash
cd server
npm install
cp .env.example .env   # 编辑 .env 填写 JWT 密钥等
npm start
```

服务器启动在 `http://localhost:3000`，前端页面访问 `http://localhost:3000/study-checkin.html`。

> ⚠️ 本版本**无预设账号**，所有账号均由用户自行注册产生。新用户初始金币为 0。

## .env 配置说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `HOST` | 监听地址，公网部署用 `0.0.0.0` | `0.0.0.0` |
| `PORT` | 端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥，**务必修改为随机长字符串** | `a1b2c3...` |
| `CORS_ORIGINS` | 允许的前端域名（逗号分隔，`*` 允许全部） | `https://stitch.example.com` |
| `REGISTER_MAX` | 单 IP 时间窗口内最大注册次数 | `5` |
| `REGISTER_WINDOW_MS` | 注册限流时间窗口（毫秒） | `3600000` |
| `XUNHUPAY_APP_ID` | 虎皮椒商户 APPID | `2021xxxx` |
| `XUNHUPAY_APP_SECRET` | 虎皮椒商户密钥 | `xxxx` |
| `XUNHUPAY_NOTIFY_URL` | 支付异步回调地址（公网可访问） | `https://域名/api/pay/notify` |
| `XUNHUPAY_RETURN_URL` | 支付同步跳转地址 | `https://域名/study-checkin.html` |

## 虎皮椒（xunhupay）配置教程

### 1. 注册虎皮椒商户

1. 访问 [虎皮椒官网](https://www.xunhupay.com) 注册账号
2. 登录后进入「商户管理」→「我的商户」
3. 记录 **APPID** 和 **商户密钥**

### 2. 绑定个人收款码

1. 在虎皮椒后台进入「支付渠道」
2. 绑定你的**个人支付宝收款码**和**微信收款码**
3. 绑定后用户支付时资金直接进入你的个人账户，虎皮椒只负责检测到账

### 3. 配置 .env

```env
XUNHUPAY_APP_ID=你的APPID
XUNHUPAY_APP_SECRET=你的商户密钥
XUNHUPAY_NOTIFY_URL=https://你的域名/api/pay/notify
XUNHUPAY_RETURN_URL=https://你的域名/study-checkin.html
```

### 4. 内网穿透调试（ngrok）

虎皮椒回调需要公网可访问的 URL，开发时用 ngrok：

```bash
# 安装 ngrok
brew install ngrok   # macOS
# 或去 https://ngrok.com 下载

# 穿透本地 3000 端口
ngrok http 3000

# 得到类似 https://xxxx.ngrok.io
# 将该地址填入 .env
XUNHUPAY_NOTIFY_URL=https://xxxx.ngrok.io/api/pay/notify
XUNHUPAY_RETURN_URL=https://xxxx.ngrok.io/study-checkin.html
```

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户：id, account(唯一), password(bcrypt), role(统一'user'), coins, created_at |
| `sign_records` | 签到记录：user_id, sign_date(YYYY-MM-DD), is_makeup(0正常/1补签) |
| `sign_stats` | 签到统计：user_id, total_days, continuous_days, last_sign_date, unlocked_medals(JSON) |
| `pay_orders` | 支付订单：order_no(唯一), user_id, package_id, amount, coins, pay_type, status, qr_code_url |
| `recharge_records` | 充值记录：user_id, order_no, amount, coins, pay_type |

所有用户数据按 `user_id` 隔离，API 通过 JWT 校验登录态防止越权。

## API 接口

| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|--------|
| POST | `/api/auth/register` | 注册（IP 限流，成功返回 token 自动登录） | ❌ |
| POST | `/api/auth/login` | 登录 | ❌ |
| GET | `/api/auth/check` | 验证 token | ✅ |
| GET | `/api/user/coins` | 查询金币 | ✅ |
| GET | `/api/user/sign-stats` | 签到统计 | ✅ |
| POST | `/api/user/signin` | 签到 | ✅ |
| POST | `/api/user/makeup-sign` | 补签（消耗 626 金币） | ✅ |
| GET | `/api/user/calendar` | 签到日历 | ✅ |
| GET | `/api/user/recharge-records` | 充值记录 | ✅ |
| GET | `/api/pay/packages` | 套餐列表 | ❌ |
| POST | `/api/pay/create` | 创建支付订单 | ✅ |
| GET | `/api/pay/status` | 查询订单状态 | ❌ |
| POST | `/api/pay/notify` | 支付回调（虎皮椒） | ❌ |
| POST | `/api/pay/dev-mark-success` | 开发模式模拟支付成功 | ✅ |

## 充值套餐

| 套餐 | 价格 | 金币 |
|------|------|------|
| A | ¥1 | 1 枚 |
| B | ¥7 | 10 枚（推荐）|
| C | ¥30 | 50 枚 |
| D | ¥68 | 120 枚 |

## 数据迁移（从旧版升级）

如果旧数据库中存在开发者账号，运行迁移脚本清除（普通用户数据保留）：

```bash
cd server
node migrate-remove-dev-account.js
```

脚本会自动备份数据库，然后删除 account=`21520677489` 或 role=`developer` 的用户及其关联数据。新部署无需运行。

## 开发模式（未配置虎皮椒）

未配置虎皮椒时，`createOrder` 返回模拟链接 `dev://mock-pay/xxx`。
前端弹窗会显示"🧪 开发模式：模拟支付成功"按钮，点击调用 `/api/pay/dev-mark-success` 模拟支付成功，方便开发调试。

## 替换为其他支付平台

如需使用 PayJS、Z支付等，只需修改 `src/xunhupay.js`：
1. 替换 API 地址
2. 替换签名算法
3. 替换回调验签逻辑

其他模块（pay.js、routes.js）无需改动。

## 生产环境部署教程

### 1. 服务器准备

准备一台云服务器（如阿里云/腾讯云），安装 Node.js ≥ 22：

```bash
# 使用 nvm 安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 22
nvm use 22
```

### 2. 上传代码并安装依赖

```bash
git clone <你的仓库地址> stitch-study
cd stitch-study/server
npm install --production
cp .env.example .env
# 编辑 .env，填写 JWT_SECRET、域名、虎皮椒配置
vim .env
```

### 3. 使用 PM2 守护进程

```bash
npm install -g pm2
pm2 start src/index.js --name stitch-study
pm2 save
pm2 startup   # 开机自启
```

常用命令：
```bash
pm2 status              # 查看状态
pm2 logs stitch-study   # 查看日志
pm2 restart stitch-study
pm2 stop stitch-study
```

### 4. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name stitch.example.com;  # 你的域名

    # 前端静态文件
    root /var/www/stitch-study;
    index study-checkin.html;

    # API 反向代理到 Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源
    location / {
        try_files $uri $uri/ /study-checkin.html;
    }
}
```

重载 Nginx：
```bash
nginx -t          # 检查配置
nginx -s reload   # 重载
```

### 5. SSL 证书（HTTPS）

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
brew install certbot        # macOS
sudo apt install certbot python3-certbot-nginx   # Ubuntu

# 自动申请并配置证书
sudo certbot --nginx -d stitch.example.com

# 自动续期（certbot 默认已配置定时任务）
sudo certbot renew --dry-run
```

配置 HTTPS 后，更新 `.env`：
```env
XUNHUPAY_NOTIFY_URL=https://stitch.example.com/api/pay/notify
XUNHUPAY_RETURN_URL=https://stitch.example.com/study-checkin.html
CORS_ORIGINS=https://stitch.example.com
```

### 6. 域名绑定

在域名服务商处添加 A 记录，将域名指向服务器公网 IP：
```
A  stitch  →  你的服务器IP
```

### 7. 防火墙

开放必要端口：
```bash
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw allow 22      # SSH
# 不要开放 3000 端口，由 Nginx 反向代理
```

## 安全说明

- 平台密钥只存在后端 `.env`，不暴露给前端
- 金额由后端从套餐配置计算，不信任前端
- 回调必须验签（MD5）
- 订单幂等：同一订单号只充值一次
- 超时订单即使收到回调也不充值（需人工核对退款）
- 密码 bcrypt 加密，登录 JWT token
- 注册接口 IP 限流（默认每小时 5 次）
- 所有用户数据接口校验 JWT，按 userId 隔离
- SQL 使用参数化查询，防止注入

## 订单超时处理

- 订单有效期 5 分钟
- 后端每分钟检查超时订单，标记为 `expired`
- 超时后即使收到回调也不充值（需人工核对退款）
- 前端倒计时结束提示"订单已超时"

## 史迪奇素材放置路径

素材位于项目根目录 `stitch-assets/`：
- `stitch_1.png` ~ `stitch_10.png`：十套史迪奇动作（对应十枚勋章）
- `stitch_wink.png`：wink 表情（鼠标悬停时显示）
- `stitch-pose-01-*.png` ~ `stitch-pose-10-*.png`：备用姿势图

## 项目结构

```
项目根目录/
  study-checkin.html      前端单页应用（史迪奇风格）
  stitch-assets/          史迪奇素材（PNG）
  /server
    /src
      index.js            入口 + 定时任务（超时订单清理）
      config.js           配置（.env）
      db.js               SQLite 数据库（node:sqlite）
      xunhupay.js         虎皮椒支付模块（API/签名/验签）
      pay.js              支付逻辑（订单/状态/金币发放）
      auth.js             注册登录（无预设账号、无验证码）
      user.js             用户/签到/补签/金币/勋章
      routes.js           API 路由 + 注册限流
    migrate-remove-dev-account.js   数据迁移脚本
    .env.example
    package.json
    data.db               SQLite 数据库（运行后自动生成）
```
