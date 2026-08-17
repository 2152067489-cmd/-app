/**
 * lib/db.js - Supabase 客户端（服务端，使用 service_role_key 绕过 RLS）
 *
 * 仅在 Serverless 函数中使用，绝不出现在前端代码中。
 */
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !serviceKey) {
  console.error('[db] ⚠️ SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未配置');
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase };
