// ============================================================
// Code.gs — 番茄鐘 Google Sheet 寫入後端
//
// 部署方式：
//   Apps Script → 部署 → 新增部署作業
//   類型：Web 應用程式
//   執行身分：我（你自己的 Google 帳號）
//   具有存取權的使用者：所有人
//
// PropertiesService 設定（見下方說明）：
//   SHEET_ID       → Google Sheet 的 ID（URL 中的長字串）
//   SHEET_NAME     → 工作表名稱（例如 "紀錄"）
//   ALLOWED_EMAIL  → 允許寫入的 Google 帳號 email
// ============================================================

// ── 允許的欄位白名單（順序對應 Google Sheet 欄位順序）──
var ALLOWED_FIELDS = [
  'timestamp',
  'task',
  'reason',
  'plannedMinutes',
  'actualMinutes',
  'status',
  'stopReason',
  'note'
];

// ── 必填欄位（這些欄位不可為空）──
var REQUIRED_FIELDS = ['timestamp', 'task', 'status'];

// ============================================================
// doPost：處理前端 POST 請求
// ============================================================
function doPost(e) {
  // 所有回應都加上 CORS header
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // ── 1. 解析 request body ──
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'REQUEST_PARSE_ERROR',
        message: '無法解析 JSON 請求內容，請確認 Content-Type 為 application/json'
      }));
      return output;
    }

    // ── 2. 取得並驗證 ID Token ──
    var idToken = body.idToken;
    if (!idToken) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'MISSING_TOKEN',
        message: '缺少 idToken，請先登入 Google 帳號'
      }));
      return output;
    }

    var verifyResult = verifyGoogleIdToken(idToken);
    if (!verifyResult.valid) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'INVALID_TOKEN',
        message: verifyResult.message
      }));
      return output;
    }

    // ── 3. 比對 email 白名單 ──
    var props = PropertiesService.getScriptProperties();
    var allowedEmail = props.getProperty('ALLOWED_EMAIL');

    if (!allowedEmail) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'SERVER_CONFIG_ERROR',
        message: '後端尚未設定 ALLOWED_EMAIL，請聯繫管理員'
      }));
      return output;
    }

    if (verifyResult.email.toLowerCase() !== allowedEmail.toLowerCase()) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'UNAUTHORIZED_EMAIL',
        message: '此 Google 帳號無寫入權限：' + verifyResult.email
      }));
      return output;
    }

    // ── 4. 取得 record 資料並驗證欄位 ──
    var record = body.record;
    if (!record || typeof record !== 'object') {
      output.setContent(JSON.stringify({
        success: false,
        error: 'MISSING_RECORD',
        message: '缺少 record 資料欄位'
      }));
      return output;
    }

    var validationResult = validateRecord(record);
    if (!validationResult.valid) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validationResult.message,
        fields: validationResult.fields
      }));
      return output;
    }

    // ── 5. 寫入 Google Sheet ──
    var writeResult = appendToSheet(record, props);
    if (!writeResult.success) {
      output.setContent(JSON.stringify({
        success: false,
        error: 'SHEET_WRITE_ERROR',
        message: writeResult.message
      }));
      return output;
    }

    // ── 6. 成功回應 ──
    output.setContent(JSON.stringify({
      success: true,
      message: '寫入成功',
      writtenAt: new Date().toISOString(),
      email: verifyResult.email
    }));
    return output;

  } catch (unexpectedErr) {
    // 捕捉所有未預期錯誤
    output.setContent(JSON.stringify({
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: unexpectedErr.toString()
    }));
    return output;
  }
}

// ============================================================
// doGet：用於測試後端是否正常運作
// ============================================================
function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify({
    status: 'ok',
    message: '番茄鐘後端運作正常',
    timestamp: new Date().toISOString()
  }));
  return output;
}

// ============================================================
// verifyGoogleIdToken：呼叫 Google tokeninfo API 驗證 ID Token
//
// 回傳格式：
//   { valid: true,  email: 'xxx@gmail.com' }
//   { valid: false, message: '錯誤說明' }
//
// 注意：tokeninfo API 為公開 API，不需要 API Key
// ============================================================
function verifyGoogleIdToken(idToken) {
  try {
    var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true  // 讓 4xx 錯誤不拋出例外，改成手動處理
    });

    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    var tokenData;

    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      return { valid: false, message: 'Google tokeninfo API 回傳無法解析的內容' };
    }

    // tokeninfo API 失敗時會回傳 400
    if (statusCode !== 200) {
      return {
        valid: false,
        message: 'ID Token 驗證失敗：' + (tokenData.error_description || tokenData.error || '未知錯誤')
      };
    }

    // 確認 email 欄位存在
    if (!tokenData.email) {
      return { valid: false, message: 'ID Token 中缺少 email 欄位' };
    }

    // 確認 email 已驗證
    if (tokenData.email_verified !== 'true' && tokenData.email_verified !== true) {
      return { valid: false, message: '此 Google 帳號的 email 尚未驗證' };
    }

    return { valid: true, email: tokenData.email };

  } catch (fetchErr) {
    return { valid: false, message: '呼叫 Google tokeninfo API 失敗：' + fetchErr.toString() };
  }
}

// ============================================================
// validateRecord：驗證 record 欄位格式
// ============================================================
function validateRecord(record) {
  var missingFields = [];
  var invalidFields = [];

  // 檢查必填欄位
  REQUIRED_FIELDS.forEach(function(field) {
    var val = record[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      missingFields.push(field);
    }
  });

  if (missingFields.length > 0) {
    return {
      valid: false,
      message: '以下必填欄位缺少或為空：' + missingFields.join(', '),
      fields: missingFields
    };
  }

  // 驗證 status 只能是 'done' 或 'incomplete'
  if (record.status !== 'done' && record.status !== 'incomplete') {
    invalidFields.push('status（只允許 "done" 或 "incomplete"）');
  }

  // 驗證數字欄位
  if (record.plannedMinutes !== undefined && isNaN(Number(record.plannedMinutes))) {
    invalidFields.push('plannedMinutes（必須是數字）');
  }
  if (record.actualMinutes !== undefined && isNaN(Number(record.actualMinutes))) {
    invalidFields.push('actualMinutes（必須是數字）');
  }

  if (invalidFields.length > 0) {
    return {
      valid: false,
      message: '以下欄位格式錯誤：' + invalidFields.join('; '),
      fields: invalidFields
    };
  }

  return { valid: true };
}

// ============================================================
// appendToSheet：將 record 寫入 Google Sheet
// ============================================================
function appendToSheet(record, props) {
  try {
    var sheetId = props.getProperty('SHEET_ID');
    var sheetName = props.getProperty('SHEET_NAME');

    if (!sheetId || !sheetName) {
      return { success: false, message: '後端缺少 SHEET_ID 或 SHEET_NAME 設定' };
    }

    var spreadsheet = SpreadsheetApp.openById(sheetId);
    var sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, message: '找不到工作表：' + sheetName };
    }

    // 按照 ALLOWED_FIELDS 順序建立列資料，未提供的欄位填空字串
    var row = ALLOWED_FIELDS.map(function(field) {
      var val = record[field];
      if (val === undefined || val === null) return '';
      // 數字欄位轉為數字（方便 Sheet 內計算）
      if (field === 'plannedMinutes' || field === 'actualMinutes') {
        return Number(val) || 0;
      }
      return String(val);
    });

    sheet.appendRow(row);

    return { success: true };

  } catch (err) {
    return { success: false, message: 'Google Sheet 寫入錯誤：' + err.toString() };
  }
}