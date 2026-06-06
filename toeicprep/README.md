# 📚 TOEIC Prep — 多益備考網站

三頁式備考輔助工具，後端使用 Supabase，前端純 HTML/CSS/JS，不需要 Node.js。

## 功能

| 頁面 | 檔案 | 說明 |
|------|------|------|
| 讀書計畫 | `index.html` | 11 週計畫 + 每日三種模式 |
| 錯題筆記 | `errors.html` | 新增、瀏覽、篩選、編輯、刪除 |
| 每日檢核 | `checklist.html` | 選模式、勾任務、雲端儲存 |

## 使用方式

### 本機直接開
直接用瀏覽器開 `index.html` 即可，不需要任何安裝。

### GitHub Pages 部署
1. 推上 GitHub
2. repo 設定 → Pages → Branch: main → Save
3. 等一分鐘，會得到一個 `https://你的帳號.github.io/repo名稱/` 網址

## Supabase 資料表

### `error_logs`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid | PK，自動生成 |
| `created_at` | timestamptz | 建立時間 |
| `part` | text | Part 1–7 |
| `question_no` | text | 題號（如 Q23） |
| `content` | text | 題目摘要 |
| `error_type` | text | 錯誤類型 |
| `note` | text | 個人筆記 |
| `reviewed` | boolean | 是否已複習 |

### `daily_checklist`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid | PK |
| `date` | date | 日期（unique） |
| `mode` | text | listening / reading / full |
| `tasks` | jsonb | `[{id, label, done}]` |
| `created_at` | timestamptz | 建立時間 |

#### 必要的 SQL（在 Supabase SQL Editor 執行一次）

```sql
ALTER TABLE daily_checklist 
ADD CONSTRAINT daily_checklist_date_key UNIQUE (date);
```
