/**
 * Cloudflare Pages Functions · 共享辅助（不参与路由，下划线开头）
 * 与 api/*.js（Vercel 版）保持同样的响应头与错误转译约定。
 */

/** 通用响应头：跨域 + 防 MIME 嗅探 + 禁用缓存（与 Vercel 版一致） */
export function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/** JSON 响应 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

/** OPTIONS 预检统一返回 204 */
export function corsPreflight() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
