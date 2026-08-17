/**
 * migrate-remove-dev-account.js
 *
 * 数据迁移脚本：从旧数据库中删除开发者预设账号及相关数据。
 *
 * 适用场景：从带开发者账号的旧版本升级到公开网站版时运行。
 * 新部署无需运行此脚本。
 *
 * 用法：
 *   cd server
 *   node migrate-remove-dev-account.js
 *
 * 会删除以下数据：
 *   1. users 表中 account='21520677489' 或 role='developer' 的记录
 *   2. sign_records / sign_stats / recharge_records / pay_orders 中关联的记录
 *
 * 删除前会自动备份数据库到 data.db.bak.<timestamp>。
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');

if (!fs.existsSync(DB_PATH)) {
  console.log('[migrate] 数据库不存在，无需迁移（新部署）。');
  process.exit(0);
}

// 备份
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `data.db.bak.${ts}`);
fs.copyFileSync(DB_PATH, backupPath);
console.log(`[migrate] 已备份数据库到: ${backupPath}`);

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = OFF');

// 查找要删除的用户
const devAccounts = ['21520677489'];
const devUsers = db.prepare(
  `SELECT id, account, role, coins FROM users WHERE account IN (${devAccounts.map(() => '?').join(',')}) OR role = 'developer'`
).all(...devAccounts);

if (devUsers.length === 0) {
  console.log('[migrate] 未发现开发者账号，无需迁移。');
  db.close();
  process.exit(0);
}

console.log(`[migrate] 发现 ${devUsers.length} 个开发者账号：`);
devUsers.forEach(u => console.log(`   - id=${u.id}, account=${u.account}, role=${u.role}, coins=${u.coins}`));

const devIds = devUsers.map(u => u.id);
const placeholders = devIds.map(() => '?').join(',');

// 按依赖顺序删除
const tables = ['sign_records', 'sign_stats', 'recharge_records', 'pay_orders', 'users'];
let totalDeleted = 0;
for (const table of tables) {
  const result = db.prepare(`DELETE FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'} IN (${placeholders})`).run(...devIds);
  console.log(`[migrate] ${table}: 删除 ${result.changes} 条`);
  totalDeleted += result.changes;
}

db.exec('PRAGMA foreign_keys = ON');
db.close();

console.log('====================================================');
console.log(`[migrate] 迁移完成，共删除 ${totalDeleted} 条记录。`);
console.log(`[migrate] 备份文件: ${backupPath}`);
console.log('[migrate] 普通用户数据不受影响，可正常使用。');
