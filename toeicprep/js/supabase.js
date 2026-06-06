/**
 * supabase.js — 資料庫客戶端
 * 使用 Supabase JS SDK (CDN UMD 版)，可直接在瀏覽器運行，不需要 Node.js。
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env.js";

// Supabase JS v2 CDN 版本透過 window.supabase 暴露
const { createClient } = window.supabase;

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ───────────────────────────────────────────
   error_logs 欄位說明
   ─────────────────────────────────────────
   id          uuid        PK, gen_random_uuid()
   created_at  timestamptz default now()
   part        text        'Part 1'~'Part 7'
   question_no text        題號（如 "Q23"）
   content     text        題目摘要或原文
   error_type  text        錯誤類型（如「聽力」「文法」「詞彙」）
   note        text        個人筆記
   reviewed    boolean     default false（是否已複習）
   ─────────────────────────────────────────
   daily_checklist 欄位說明
   ─────────────────────────────────────────
   id          uuid        PK
   date        date        當日日期
   mode        text        'listening' | 'reading' | 'full'
   tasks       jsonb       [{id, label, done}]
   created_at  timestamptz
   ─────────────────────────────────────────
*/

// ── error_logs ──────────────────────────────

export async function fetchErrors(part = null) {
  let query = db
    .from("error_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (part) query = query.eq("part", part);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addError(payload) {
  const { data, error } = await db
    .from("error_logs")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateError(id, payload) {
  const { data, error } = await db
    .from("error_logs")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteError(id) {
  const { error } = await db.from("error_logs").delete().eq("id", id);
  if (error) throw error;
}

// ── daily_checklist ──────────────────────────

export async function fetchChecklist(date) {
  const { data, error } = await db
    .from("daily_checklist")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveChecklist(payload) {
  // upsert by date
  const { data, error } = await db
    .from("daily_checklist")
    .upsert([payload], { onConflict: "date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
