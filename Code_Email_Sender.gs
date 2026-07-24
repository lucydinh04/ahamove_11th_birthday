/**
 * ============================================================
 * AHAMOVE 11TH BIRTHDAY — FULL GOOGLE APPS SCRIPT AUTOMATION
 * ============================================================
 *
 * Chức năng:
 * 1) Tự tạo/cập nhật cấu trúc Google Sheet.
 * 2) Tự tạo token bảo mật và Invitation Link cho dòng mới.
 * 3) Tự xác định sự kiện SGN/HAN từ cột Location/Event.
 * 4) Gửi email cá nhân hóa cho các dòng chưa gửi.
 * 5) Ghi Email Status, Sent Time, Error Message.
 * 6) Nhận RSVP từ website:
 *    - THAM DỰ
 *    - KHÔNG THAM GIA ĐƯỢC + lý do
 * 7) Ghi RSVP, Note, Response Time.
 * 8) Tạo trigger tự động quét dữ liệu theo thời gian.
 * 9) Có menu thao tác ngay trên Google Sheet.
 *
 * ------------------------------------------------------------
 * CÀI ĐẶT NHANH
 * ------------------------------------------------------------
 * A. Sửa CONFIG:
 *    - SPREADSHEET_ID
 *    - SHEET_NAME
 *    - FRONTEND_BASE_URL
 *    - SENDER_NAME
 *
 * B. Chạy setupProject() một lần.
 *
 * C. Deploy Web App:
 *    Deploy > New deployment > Web app
 *    Execute as: Me
 *    Who has access: Anyone
 *
 * D. Copy URL /exec để frontend gọi API.
 *
 * ------------------------------------------------------------
 * CẤU TRÚC SHEET
 * ------------------------------------------------------------
 * Employee ID | Name | Email | Location | Event | Token |
 * Invitation Link | Email Status | Sent Time | RSVP |
 * Note | Response Time | Error Message | Last Updated
 */

const CONFIG = {
  SPREADSHEET_ID: '10pPJeyJS6qlC0BZwB9YyAZlf-NTPYBLK5GinpZL5erg',
  SHEET_NAME: 'Invitations',

  // Link website Vercel, KHÔNG thêm dấu / ở cuối.
  FRONTEND_BASE_URL: 'https://ahamove11th.vercel.app',

  SENDER_NAME: 'Ahamove',

  // Có thể để trống để test gửi mail. Khi có File ID logo trên Drive, dán vào đây.
  LOGO_FILE_ID: '1RPA5ZDDKIlnrjMni2o6DIa3cDaofesks',
  EMAIL_SUBJECT: 'THƯ MỜI | AHAMOVE 11 NĂM – CHUYỂN MÌNH BỨT PHÁ',

  // Giới hạn gửi trong mỗi lượt để tránh timeout.
  MAX_EMAILS_PER_RUN: 40,

  // Trigger tự động xử lý dữ liệu mỗi 10 phút.
  TRIGGER_EVERY_MINUTES: 10,

  HEADERS: {
    employeeId: 'Employee ID',
    name: 'Name',
    email: 'Email',
    location: 'Location',
    event: 'Event',
    eventDate: 'Event Date',
    eventTime: 'Event Time',
    venue: 'Venue',
    city: 'City',
    token: 'Token',
    invitationLink: 'Invitation Link',
    emailStatus: 'Email Status',
    sentTime: 'Sent Time',
    rsvp: 'RSVP',
    note: 'Note',
    responseTime: 'Response Time',
    errorMessage: 'Error Message',
    lastUpdated: 'Last Updated'
  },

  EMAIL_STATUS: {
    PENDING: 'PENDING',
    SENT: 'SENT',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED'
  },

  RSVP_STATUS: {
    ATTENDING: 'THAM DỰ',
    DECLINED: 'KHÔNG THAM GIA ĐƯỢC'
  },

  EVENTS: {
    SGN: {
      code: 'SGN',
      city: 'TP. Hồ Chí Minh',
      date: '07/08/2026',
      time: '18:00',
      venue: 'Riverside Palace – Sảnh Nile',
      address: '',
      dresscode: 'Trắng / Bạc / Xanh dương'
    },
    HAN: {
      code: 'HAN',
      city: 'Hà Nội',
      date: '14/08/2026',
      time: '18:00',
      venue: 'Novotel Hanoi Thai Ha',
      address: '',
      dresscode: 'Trắng / Bạc / Xanh dương'
    }
  }
};


/* ============================================================
 * MENU
 * ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ahamove RSVP')
    .addItem('1. Setup toàn bộ hệ thống', 'setupProject')
    .addSeparator()
    .addItem('Xử lý dữ liệu ngay', 'processInvitationData')
    .addItem('Tạo token & link còn thiếu', 'generateMissingTokens')
    .addItem('Gửi email chưa gửi', 'sendPendingInvitations')
    .addSeparator()
    .addItem('Tạo trigger tự động', 'setupAutomation')
    .addItem('Xóa trigger tự động', 'removeAutomation')
    .addSeparator()
    .addItem('Reset dòng đang chọn để test', 'resetSelectedRowsForTesting')
    .addToUi();
}


/* ============================================================
 * WEB APP API
 * ============================================================ */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = normalize_(params.action || 'invitation').toLowerCase();

    if (action === 'health') {
      return jsonResponse_({
        ok: true,
        service: 'Ahamove 11 RSVP Automation',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'invitation') {
      return getInvitation_(params.token);
    }

    return jsonResponse_({
      ok: false,
      message: 'Action không hợp lệ.'
    });

  } catch (error) {
    console.error(error);
    return errorResponse_(error);
  }
}


function doPost(e) {
  try {
    const payload = parseRequestBody_(e);
    const action = normalize_(payload.action || 'rsvp').toLowerCase();

    if (action !== 'rsvp') {
      return jsonResponse_({
        ok: false,
        message: 'Action không hợp lệ.'
      });
    }

    return saveRsvp_(payload);

  } catch (error) {
    console.error(error);
    return errorResponse_(error);
  }
}


/* ============================================================
 * SETUP
 * ============================================================ */

function setupProject() {
  validateConfig_();
  setupSheet();
  setupAutomation();
  processInvitationData();

  SpreadsheetApp.getUi().alert(
    'Setup hoàn tất',
    'Đã tạo cấu trúc Sheet, trigger tự động và xử lý dữ liệu hiện có.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


function setupSheet() {
  validateConfig_();

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  const requiredHeaders = Object.keys(CONFIG.HEADERS).map(function (key) {
    return CONFIG.HEADERS[key];
  });

  let existingHeaders = [];

  if (sheet.getLastColumn() > 0) {
    existingHeaders = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(function (value) {
        return normalize_(value);
      });
  }

  requiredHeaders.forEach(function (header) {
    if (!existingHeaders.includes(header)) {
      existingHeaders.push(header);
    }
  });

  sheet
    .getRange(1, 1, 1, existingHeaders.length)
    .setValues([existingHeaders]);

  const headerRange = sheet.getRange(1, 1, 1, existingHeaders.length);
  headerRange
    .setFontWeight('bold')
    .setBackground('#0B1F3A')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, existingHeaders.length);

  return 'Đã setup sheet "' + CONFIG.SHEET_NAME + '".';
}


/* ============================================================
 * AUTOMATION TRIGGERS
 * ============================================================ */

function setupAutomation() {
  removeAutomation();

  ScriptApp.newTrigger('processInvitationData')
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_EVERY_MINUTES)
    .create();

  return 'Đã tạo trigger mỗi ' + CONFIG.TRIGGER_EVERY_MINUTES + ' phút.';
}


function removeAutomation() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processInvitationData') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  return 'Đã xóa trigger processInvitationData.';
}


/* ============================================================
 * MASTER AUTOMATION
 * ============================================================ */

function processInvitationData() {
  validateConfig_();

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    setupSheet();
    generateMissingTokens();
    normalizePendingStatuses_();
    sendPendingInvitations();

  } catch (error) {
    console.error('processInvitationData error:', error);
    throw error;

  } finally {
    lock.releaseLock();
  }
}


/* ============================================================
 * TOKEN & LINK AUTOMATION
 * ============================================================ */

function generateMissingTokens() {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 'Không có dữ liệu.';
  }

  const allValues = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getValues();

  const updates = [];

  allValues.forEach(function (rowValues, index) {
    const rowNumber = index + 2;
    const rowObject = rowToObject_(rowValues, headerMap);

    const email = normalize_(rowObject[CONFIG.HEADERS.email]);
    const name = normalize_(rowObject[CONFIG.HEADERS.name]);

    // Bỏ qua dòng trống.
    if (!email && !name) {
      return;
    }

    let changed = false;
    let token = normalize_(rowObject[CONFIG.HEADERS.token]);
    let eventCode = normalizeEventCode_(
      rowObject[CONFIG.HEADERS.event] ||
      rowObject[CONFIG.HEADERS.location]
    );

    if (!token) {
      token = createSecureToken_();
      rowValues[headerMap[CONFIG.HEADERS.token] - 1] = token;
      changed = true;
    }

    const expectedLink =
      CONFIG.FRONTEND_BASE_URL.replace(/\/+$/, '') +
      '/i/' +
      encodeURIComponent(token);

    if (
      normalize_(rowObject[CONFIG.HEADERS.invitationLink]) !== expectedLink
    ) {
      rowValues[headerMap[CONFIG.HEADERS.invitationLink] - 1] = expectedLink;
      changed = true;
    }

    if (!normalize_(rowObject[CONFIG.HEADERS.event])) {
      rowValues[headerMap[CONFIG.HEADERS.event] - 1] = eventCode;
      changed = true;
    }

    if (changed) {
      rowValues[headerMap[CONFIG.HEADERS.lastUpdated] - 1] = new Date();
      updates.push({
        rowNumber: rowNumber,
        values: rowValues
      });
    }
  });

  updates.forEach(function (update) {
    sheet
      .getRange(update.rowNumber, 1, 1, update.values.length)
      .setValues([update.values]);
  });

  SpreadsheetApp.flush();

  return 'Đã cập nhật ' + updates.length + ' dòng.';
}


function normalizePendingStatuses_() {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const emailStatusColumn = headerMap[CONFIG.HEADERS.emailStatus];
  const emailColumn = headerMap[CONFIG.HEADERS.email];
  const tokenColumn = headerMap[CONFIG.HEADERS.token];

  for (let row = 2; row <= lastRow; row++) {
    const email = normalize_(sheet.getRange(row, emailColumn).getValue());
    const token = normalize_(sheet.getRange(row, tokenColumn).getValue());
    const currentStatus = normalize_(
      sheet.getRange(row, emailStatusColumn).getValue()
    ).toUpperCase();

    if (
      email &&
      token &&
      !currentStatus
    ) {
      sheet
        .getRange(row, emailStatusColumn)
        .setValue(CONFIG.EMAIL_STATUS.PENDING);
    }
  }
}


/* ============================================================
 * EMAIL AUTOMATION
 * ============================================================ */

function sendPendingInvitations() {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 'Không có dữ liệu gửi.';
  }

  let sentCount = 0;
  let failedCount = 0;

  for (
    let row = 2;
    row <= lastRow && sentCount < CONFIG.MAX_EMAILS_PER_RUN;
    row++
  ) {
    const record = getRowRecord_(sheet, headerMap, row);

    const email = normalize_(record[CONFIG.HEADERS.email]);
    const name = normalize_(record[CONFIG.HEADERS.name]);
    const link = normalize_(record[CONFIG.HEADERS.invitationLink]);
    const token = normalize_(record[CONFIG.HEADERS.token]);
    const status = normalize_(
      record[CONFIG.HEADERS.emailStatus]
    ).toUpperCase();

    if (!email && !name) {
      continue;
    }

    if (!email || !isValidEmail_(email)) {
      updateEmailResult_(
        sheet,
        row,
        headerMap,
        CONFIG.EMAIL_STATUS.SKIPPED,
        '',
        'Email không hợp lệ.'
      );
      continue;
    }

    if (!token || !link) {
      updateEmailResult_(
        sheet,
        row,
        headerMap,
        CONFIG.EMAIL_STATUS.FAILED,
        '',
        'Thiếu token hoặc invitation link.'
      );
      failedCount++;
      continue;
    }

    if (
      status === CONFIG.EMAIL_STATUS.SENT ||
      status === CONFIG.EMAIL_STATUS.SKIPPED
    ) {
      continue;
    }

    try {
      const eventInfo = resolveEventInfo_(record);

      const htmlBody = renderEmailTemplate_({
        name: name || 'Ahamover',
        invitationLink: link,
        event: eventInfo
      });

      const mailOptions = {
        htmlBody: htmlBody,
        name: CONFIG.SENDER_NAME
      };

      // Logo là tùy chọn: nếu chưa cấu hình đúng, email vẫn được gửi.
      const logoBlob = getLogoBlobSafe_();
      if (logoBlob) {
        mailOptions.inlineImages = {
          ahamoveLogo: logoBlob
        };
      }

      GmailApp.sendEmail(
        email,
        CONFIG.EMAIL_SUBJECT,
        'Vui lòng mở email bằng chế độ HTML để xem thư mời.',
        mailOptions
      );

      updateEmailResult_(
        sheet,
        row,
        headerMap,
        CONFIG.EMAIL_STATUS.SENT,
        new Date(),
        ''
      );

      sentCount++;

      // Giảm nguy cơ chạm quota.
      Utilities.sleep(250);

    } catch (error) {
      failedCount++;

      updateEmailResult_(
        sheet,
        row,
        headerMap,
        CONFIG.EMAIL_STATUS.FAILED,
        '',
        error && error.message ? error.message : String(error)
      );
    }
  }

  SpreadsheetApp.flush();

  return (
    'Đã gửi: ' +
    sentCount +
    ' | Lỗi: ' +
    failedCount
  );
}


function renderEmailTemplate_(data) {
  const template = HtmlService.createTemplateFromFile('EmailTemplate');

  template.name = data.name;
  template.invitationLink = data.invitationLink;
  template.event = data.event;
  template.hasInlineLogo = Boolean(getLogoBlobSafe_());

  return template.evaluate().getContent();
}


function updateEmailResult_(
  sheet,
  row,
  headerMap,
  status,
  sentTime,
  errorMessage
) {
  setCellByHeader_(
    sheet,
    row,
    headerMap,
    CONFIG.HEADERS.emailStatus,
    status
  );

  if (sentTime) {
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.sentTime,
      sentTime
    );
  }

  setCellByHeader_(
    sheet,
    row,
    headerMap,
    CONFIG.HEADERS.errorMessage,
    errorMessage || ''
  );

  setCellByHeader_(
    sheet,
    row,
    headerMap,
    CONFIG.HEADERS.lastUpdated,
    new Date()
  );
}


/**
 * Lấy logo nhưng không làm hỏng toàn bộ quy trình gửi mail nếu File ID sai.
 */
function getLogoBlobSafe_() {
  try {
    return getLogoBlob_();
  } catch (error) {
    console.warn('Không tải được logo:', error);
    return null;
  }
}


/**
 * GỬI EMAIL TEST TRỰC TIẾP
 * Chỉ cần sửa TEST_EMAIL rồi chạy sendTestEmail().
 */
function sendTestEmail() {
  const TEST_EMAIL = 'DÁN_EMAIL_TEST_VÀO_ĐÂY';
  const TEST_NAME = 'Ahamover Test';
  const TEST_LOCATION = 'SGN'; // SGN hoặc HAN

  if (
    !TEST_EMAIL ||
    TEST_EMAIL === 'DÁN_EMAIL_TEST_VÀO_ĐÂY' ||
    !isValidEmail_(TEST_EMAIL)
  ) {
    throw new Error('Vui lòng điền email hợp lệ vào TEST_EMAIL.');
  }

  validateConfig_();

  const eventInfo =
    CONFIG.EVENTS[normalizeEventCode_(TEST_LOCATION)] ||
    CONFIG.EVENTS.SGN;

  const testToken = createSecureToken_();
  const testLink =
    CONFIG.FRONTEND_BASE_URL.replace(/\/+$/, '') +
    '/i/' +
    encodeURIComponent(testToken);

  const htmlBody = renderEmailTemplate_({
    name: TEST_NAME,
    invitationLink: testLink,
    event: eventInfo
  });

  const options = {
    htmlBody: htmlBody,
    name: CONFIG.SENDER_NAME
  };

  const logoBlob = getLogoBlobSafe_();
  if (logoBlob) {
    options.inlineImages = {
      ahamoveLogo: logoBlob
    };
  }

  GmailApp.sendEmail(
    TEST_EMAIL,
    '[TEST] ' + CONFIG.EMAIL_SUBJECT,
    'Vui lòng mở email bằng chế độ HTML để xem thư mời.',
    options
  );

  Logger.log(
    'Đã gửi email test đến ' +
    TEST_EMAIL +
    ' | Sự kiện: ' +
    eventInfo.code +
    ' | ' +
    eventInfo.time +
    ' - ' +
    eventInfo.date +
    ' | ' +
    eventInfo.venue
  );
}

function getLogoBlob_() {
  if (
    !CONFIG.LOGO_FILE_ID ||
    CONFIG.LOGO_FILE_ID === 'DÁN_FILE_ID_LOGO_PNG_VÀO_ĐÂY'
  ) {
    throw new Error('Bạn chưa cấu hình CONFIG.LOGO_FILE_ID.');
  }

  return DriveApp
    .getFileById(CONFIG.LOGO_FILE_ID)
    .getBlob()
    .setName('ahamove-dark.png');
}


/* ============================================================
 * RSVP API LOGIC
 * ============================================================ */

function getInvitation_(rawToken) {
  const token = normalize_(rawToken);

  if (!token) {
    return jsonResponse_({
      ok: false,
      message: 'Thiếu token thư mời.'
    });
  }

  const record = findRecordByToken_(token);

  if (!record) {
    return jsonResponse_({
      ok: false,
      message: 'Không tìm thấy thư mời hoặc token không hợp lệ.'
    });
  }

  const eventInfo = resolveEventInfo_(record.values);
  const eventCode = eventInfo.code;

  return jsonResponse_({
    ok: true,
    invitation: {
      employeeId: safeString_(
        record.values[CONFIG.HEADERS.employeeId]
      ),
      name: safeString_(record.values[CONFIG.HEADERS.name]),
      email: safeString_(record.values[CONFIG.HEADERS.email]),
      location: normalizeLocation_(
        record.values[CONFIG.HEADERS.location]
      ),
      eventCode: eventCode,
      event: eventInfo,
      status: safeString_(record.values[CONFIG.HEADERS.rsvp]),
      note: safeString_(record.values[CONFIG.HEADERS.note]),
      responseTime: formatDateValue_(
        record.values[CONFIG.HEADERS.responseTime]
      )
    }
  });
}


function saveRsvp_(payload) {
  const token = normalize_(payload.token);
  const status = normalize_(payload.status).toUpperCase();
  const note = safeString_(payload.note).trim();

  if (!token) {
    return jsonResponse_({
      ok: false,
      message: 'Thiếu token thư mời.'
    });
  }

  if (
    status !== CONFIG.RSVP_STATUS.ATTENDING &&
    status !== CONFIG.RSVP_STATUS.DECLINED
  ) {
    return jsonResponse_({
      ok: false,
      message: 'Trạng thái RSVP không hợp lệ.'
    });
  }

  if (
    status === CONFIG.RSVP_STATUS.DECLINED &&
    !note
  ) {
    return jsonResponse_({
      ok: false,
      message: 'Vui lòng nhập lý do không thể tham gia.'
    });
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const record = findRecordByToken_(token);

    if (!record) {
      return jsonResponse_({
        ok: false,
        message: 'Không tìm thấy thư mời hoặc token không hợp lệ.'
      });
    }

    setCellByHeader_(
      record.sheet,
      record.row,
      record.headerMap,
      CONFIG.HEADERS.rsvp,
      status
    );

    setCellByHeader_(
      record.sheet,
      record.row,
      record.headerMap,
      CONFIG.HEADERS.note,
      note
    );

    setCellByHeader_(
      record.sheet,
      record.row,
      record.headerMap,
      CONFIG.HEADERS.responseTime,
      new Date()
    );

    setCellByHeader_(
      record.sheet,
      record.row,
      record.headerMap,
      CONFIG.HEADERS.lastUpdated,
      new Date()
    );

    SpreadsheetApp.flush();

    return jsonResponse_({
      ok: true,
      status: status,
      note: note,
      message:
        status === CONFIG.RSVP_STATUS.ATTENDING
          ? 'BTC đã ghi nhận bạn sẽ tham dự.'
          : 'BTC đã ghi nhận bạn không thể tham dự.',
      responseTime: new Date().toISOString()
    });

  } finally {
    lock.releaseLock();
  }
}


/* ============================================================
 * TEST / RESET
 * ============================================================ */

function resetSelectedRowsForTesting() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (sheet.getName() !== CONFIG.SHEET_NAME) {
    SpreadsheetApp.getUi().alert(
      'Vui lòng mở sheet "' + CONFIG.SHEET_NAME + '".'
    );
    return;
  }

  const range = sheet.getActiveRange();
  const headerMap = getHeaderMap_(sheet);
  const startRow = Math.max(2, range.getRow());
  const endRow = range.getLastRow();

  for (let row = startRow; row <= endRow; row++) {
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.emailStatus,
      CONFIG.EMAIL_STATUS.PENDING
    );
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.sentTime,
      ''
    );
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.rsvp,
      ''
    );
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.note,
      ''
    );
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.responseTime,
      ''
    );
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.errorMessage,
      ''
    );
    setCellByHeader_(
      sheet,
      row,
      headerMap,
      CONFIG.HEADERS.lastUpdated,
      new Date()
    );
  }

  SpreadsheetApp.flush();

  SpreadsheetApp.getUi().alert(
    'Đã reset ' + (endRow - startRow + 1) + ' dòng để test.'
  );
}


function testGetInvitation() {
  const TEST_TOKEN = 'DÁN_TOKEN_TEST_VÀO_ĐÂY';
  Logger.log(getInvitation_(TEST_TOKEN).getContent());
}


function testConfirmAttendance() {
  const TEST_TOKEN = 'DÁN_TOKEN_TEST_VÀO_ĐÂY';

  Logger.log(
    saveRsvp_({
      token: TEST_TOKEN,
      status: CONFIG.RSVP_STATUS.ATTENDING,
      note: ''
    }).getContent()
  );
}


function testDeclineAttendance() {
  const TEST_TOKEN = 'DÁN_TOKEN_TEST_VÀO_ĐÂY';

  Logger.log(
    saveRsvp_({
      token: TEST_TOKEN,
      status: CONFIG.RSVP_STATUS.DECLINED,
      note: 'Trùng lịch công việc'
    }).getContent()
  );
}


/* ============================================================
 * SHEET HELPERS
 * ============================================================ */

function getSheet_() {
  validateConfig_();

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error(
      'Không tìm thấy sheet "' + CONFIG.SHEET_NAME + '".'
    );
  }

  return sheet;
}


function getHeaderMap_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error('Sheet chưa có header.');
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (value) {
      return normalize_(value);
    });

  const map = {};

  headers.forEach(function (header, index) {
    if (header) {
      map[header] = index + 1;
    }
  });

  Object.keys(CONFIG.HEADERS).forEach(function (key) {
    const expectedHeader = CONFIG.HEADERS[key];

    if (!map[expectedHeader]) {
      throw new Error(
        'Thiếu cột "' + expectedHeader + '". Hãy chạy setupSheet().'
      );
    }
  });

  return map;
}


function getRowRecord_(sheet, headerMap, row) {
  const values = sheet
    .getRange(row, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  return rowToObject_(values, headerMap);
}


function rowToObject_(rowValues, headerMap) {
  const result = {};

  Object.keys(headerMap).forEach(function (header) {
    result[header] = rowValues[headerMap[header] - 1];
  });

  return result;
}


function findRecordByToken_(token) {
  const sheet = getSheet_();
  const headerMap = getHeaderMap_(sheet);
  const tokenColumn = headerMap[CONFIG.HEADERS.token];
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const match = sheet
    .getRange(2, tokenColumn, lastRow - 1, 1)
    .createTextFinder(token)
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  if (!match) {
    return null;
  }

  const row = match.getRow();

  return {
    sheet: sheet,
    headerMap: headerMap,
    row: row,
    values: getRowRecord_(sheet, headerMap, row)
  };
}


function setCellByHeader_(
  sheet,
  row,
  headerMap,
  header,
  value
) {
  const column = headerMap[header];

  if (!column) {
    throw new Error('Không tìm thấy cột "' + header + '".');
  }

  sheet.getRange(row, column).setValue(value);
}



/**
 * Xác định chính xác thông tin sự kiện theo từng dòng.
 * Ưu tiên dữ liệu trong Sheet; nếu trống thì dùng CONFIG.EVENTS.
 */
function resolveEventInfo_(record) {
  const rawEvent = [
    record[CONFIG.HEADERS.event],
    record[CONFIG.HEADERS.location],
    record['Office'],
    record['Work Location'],
    record['Branch']
  ].filter(Boolean).join(' ');

  const eventCode = normalizeEventCode_(rawEvent);
  const fallback = CONFIG.EVENTS[eventCode] || CONFIG.EVENTS.SGN;

  return {
    code: eventCode,
    date: formatEventDate_(
      record[CONFIG.HEADERS.eventDate] || fallback.date
    ),
    time: formatEventTime_(
      record[CONFIG.HEADERS.eventTime] || fallback.time
    ),
    venue: normalize_(
      record[CONFIG.HEADERS.venue] || fallback.venue
    ),
    city: normalize_(
      record[CONFIG.HEADERS.city] || fallback.city
    ),
    address: fallback.address || '',
    dresscode: fallback.dresscode || ''
  };
}


function formatEventDate_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    );
  }

  return normalize_(value);
}


function formatEventTime_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }

  const text = normalize_(value);
  const numeric = Number(text);

  if (!isNaN(numeric) && numeric >= 0 && numeric < 1) {
    const totalMinutes = Math.round(numeric * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2);
  }

  return text;
}


/* ============================================================
 * UTILITIES
 * ============================================================ */

function validateConfig_() {
  if (
    !CONFIG.SPREADSHEET_ID ||
    CONFIG.SPREADSHEET_ID === 'DÁN_ID_GOOGLE_SHEET_VÀO_ĐÂY'
  ) {
    throw new Error('Bạn chưa cấu hình CONFIG.SPREADSHEET_ID.');
  }

  if (
    !CONFIG.FRONTEND_BASE_URL ||
    CONFIG.FRONTEND_BASE_URL.includes('TEN-DU-AN-VERCEL')
  ) {
    throw new Error('Bạn chưa cấu hình CONFIG.FRONTEND_BASE_URL.');
  }
}


function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = normalize_(e.postData.contents);

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const result = {};

    raw.split('&').forEach(function (pair) {
      const parts = pair.split('=');
      const key = decodeURIComponent(parts[0] || '');
      const value = decodeURIComponent(
        String(parts.slice(1).join('=') || '').replace(/\+/g, ' ')
      );

      if (key) {
        result[key] = value;
      }
    });

    return result;
  }
}


function createSecureToken_() {
  const raw =
    Utilities.getUuid() +
    '|' +
    new Date().getTime() +
    '|' +
    Math.random();

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );

  return digest
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    })
    .join('');
}


function normalizeEventCode_(value) {
  const text = removeVietnameseAccents_(
    normalize_(value)
  ).toUpperCase();

  if (
    text.includes('HAN') ||
    text.includes('HA NOI') ||
    text.includes('HANOI') ||
    text.includes('HN') ||
    text.includes('NORTH')
  ) {
    return 'HAN';
  }

  if (
    text.includes('SGN') ||
    text.includes('HO CHI MINH') ||
    text.includes('HCM') ||
    text.includes('SAI GON') ||
    text.includes('SOUTH')
  ) {
    return 'SGN';
  }

  return 'SGN';
}


function removeVietnameseAccents_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}


function normalizeLocation_(value) {
  return normalizeEventCode_(value);
}


function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


function normalize_(value) {
  return String(value == null ? '' : value).trim();
}


function safeString_(value) {
  if (value == null) {
    return '';
  }

  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );
  }

  return String(value);
}


function formatDateValue_(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );
  }

  return String(value);
}


function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


function errorResponse_(error) {
  return jsonResponse_({
    ok: false,
    message:
      error && error.message
        ? error.message
        : 'Đã xảy ra lỗi không xác định.'
  });
}
