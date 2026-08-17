/**
 * lib/config.js - 充值套餐、虎皮椒、订单配置
 *
 * 金额由后端统一管理，绝不信任前端传的金额。
 */

// 充值套餐
const packages = {
  A: { price: 1,  coins: 1,   name: '1枚626金币' },
  B: { price: 7,  coins: 10,  name: '10枚626金币（推荐）' },
  C: { price: 30, coins: 50,  name: '50枚626金币' },
  D: { price: 68, coins: 120, name: '120枚626金币' },
};

// 虎皮椒配置
const xunhupay = {
  appId:     process.env.XUNHUPAY_APP_ID || '',
  appSecret: process.env.XUNHUPAY_APP_SECRET || '',
  notifyUrl: process.env.XUNHUPAY_NOTIFY_URL || '',
  returnUrl: process.env.XUNHUPAY_RETURN_URL || '',
  apiUrl:    'https://api.xunhupay.com/payment.html',
};

// 订单配置
const order = {
  expireMinutes: 5,         // 订单有效期 5 分钟
};

// 补签消耗金币
const MAKEUP_COST = 626;

// 勋章解锁条件（等级: 累计签到天数）
const MEDAL_CONDITIONS = [
  { level: 1,  days: 1   },
  { level: 2,  days: 7   },
  { level: 3,  days: 14  },
  { level: 4,  days: 30  },
  { level: 5,  days: 60  },
  { level: 6,  days: 90  },
  { level: 7,  days: 150 },
  { level: 8,  days: 210 },
  { level: 9,  days: 270 },
  { level: 10, days: 360 },
];

module.exports = { packages, xunhupay, order, MAKEUP_COST, MEDAL_CONDITIONS };
