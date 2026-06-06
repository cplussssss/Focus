/**
 * env.js — Supabase 連線設定
 *
 * Supabase anon key 是公開金鑰，設計上就是給前端使用的。
 * 資料安全靠 Supabase 後台的 Row Level Security (RLS) 保護，
 * 不是靠 key 本身保密，所以直接寫在這裡沒有問題。
 */

export const SUPABASE_URL = "https://ujpwqxxriimtxsjconfk.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcHdxeHhyaWltdHhzamNvbmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDM5NjIsImV4cCI6MjA5NjExOTk2Mn0.PW8o1O7-kTC_Nl1wN39sqMOwN2H_CNtEKORmEe_u-rA";
