/**
 * Ahamove 11 - Apps Script gửi email Vercel bằng token.
 *
 * INVITATION:
 * A ID | B Name | C Email | D Site | E RSVP | F Response Time
 * G Note | H Token | I Invitation Link | J Email Status
 * K Sent Time | L Error
 *
 * EVENT_CONFIG:
 * A Site | B Event Date | C Event Time | D Venue Name
 * E Venue Detail | F Address | G Map URL
 */

const CONFIG = {
  INVITATION_SHEET: 'INVITATION',
  EVENT_CONFIG_SHEET: 'EVENT_CONFIG',

  // Thay bằng Production Domain sau khi deploy.
  VERCEL_BASE_URL: 'https://YOUR-PROJECT.vercel.app',

  SUBJECT: '🔥 Thư mời Sinh nhật Ahamove 11 tuổi',
  SENDER_NAME: 'Ahamove Birthday 11',

  TEST_EMAIL: 'YOUR_EMAIL@AHAMOVE.COM',
  TEST_EMPLOYEE_ID: '257988',

  BATCH_LIMIT: 80,
  TIME_ZONE: 'Asia/Ho_Chi_Minh'
};

function setupBirthdaySheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let invitation = ss.getSheetByName(CONFIG.INVITATION_SHEET);
  if (!invitation) {
    invitation = ss.insertSheet(CONFIG.INVITATION_SHEET);
  }

  invitation.getRange(1, 1, 1, 12).setValues([[
    'ID',
    'Name',
    'Email',
    'Site',
    'RSVP',
    'Response Time',
    'Note',
    'Token',
    'Invitation Link',
    'Email Status',
    'Sent Time',
    'Error'
  ]]);

  invitation.setFrozenRows(1);
  invitation.getRange('A:A').setNumberFormat('@');
  invitation.getRange('H:H').setNumberFormat('@');

  let config = ss.getSheetByName(CONFIG.EVENT_CONFIG_SHEET);
  if (!config) {
    config = ss.insertSheet(CONFIG.EVENT_CONFIG_SHEET);
  }

  config.getRange(1, 1, 1, 7).setValues([[
    'Site',
    'Event Date',
    'Event Time',
    'Venue Name',
    'Venue Detail',
    'Address',
    'Map URL'
  ]]);

  if (config.getLastRow() < 2) {
    config.getRange(2, 1, 2, 7).setValues([
      [
        'SGN',
        '07/08/2026',
        '18:00',
        'ĐIỀN TÊN ĐỊA ĐIỂM SGN',
        'ĐIỀN TÊN SẢNH / KHU VỰC',
        'ĐIỀN ĐỊA CHỈ SGN',
        'ĐIỀN LINK GOOGLE MAPS SGN'
      ],
      [
        'HAN',
        '14/08/2026',
        '18:00',
        'ĐIỀN TÊN ĐỊA ĐIỂM HAN',
        'ĐIỀN TÊN SẢNH / KHU VỰC',
        'ĐIỀN ĐỊA CHỈ HAN',
        'ĐIỀN LINK GOOGLE MAPS HAN'
      ]
    ]);
  }

  config.setFrozenRows(1);
  SpreadsheetApp.flush();

  return {
    success: true,
    message:
      'Đã tạo/cập nhật tab INVITATION và EVENT_CONFIG.'
  };
}

function generateTokensAndInvitationLinks() {
  const sheet = getSheet_(CONFIG.INVITATION_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Tab INVITATION chưa có dữ liệu.');
  }

  const baseUrl = normalizeBaseUrl_(CONFIG.VERCEL_BASE_URL);
  const rows = sheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues();
  const existingTokens = new Set(
    rows.map(row => normalizeToken_(row[7])).filter(Boolean)
  );

  const tokenValues = [];
  const linkValues = [];

  rows.forEach(row => {
    const id = normalizeId_(row[0]);
    let token = normalizeToken_(row[7]);

    if (!id) {
      tokenValues.push(['']);
      linkValues.push(['']);
      return;
    }

    if (!token) {
      do {
        token = createSecureToken_();
      } while (existingTokens.has(token));

      existingTokens.add(token);
    }

    tokenValues.push([token]);
    linkValues.push([
      `${baseUrl}/i/${encodeURIComponent(token)}`
    ]);
  });

  sheet.getRange(2, 8, tokenValues.length, 1).setValues(tokenValues);
  sheet.getRange(2, 9, linkValues.length, 1).setValues(linkValues);
  SpreadsheetApp.flush();

  return {
    success: true,
    totalLinks: linkValues.filter(([link]) => Boolean(link)).length
  };
}

function validateBirthdayData() {
  const invitation = getSheet_(CONFIG.INVITATION_SHEET);
  const eventConfig = getSheet_(CONFIG.EVENT_CONFIG_SHEET);

  const configRows = eventConfig
    .getRange(2, 1, Math.max(eventConfig.getLastRow() - 1, 1), 7)
    .getDisplayValues();

  const validSites = new Set(
    configRows
      .map(row => normalizeSite_(row[0]))
      .filter(Boolean)
  );

  const rows = invitation
    .getRange(2, 1, Math.max(invitation.getLastRow() - 1, 1), 12)
    .getDisplayValues();

  const issues = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const id = normalizeId_(row[0]);
    const email = String(row[2] || '').trim();
    const site = normalizeSite_(row[3]);

    if (!id && !email && !site) return;

    if (!id) issues.push(`Dòng ${rowNumber}: thiếu ID.`);
    if (!isValidEmail_(email)) {
      issues.push(`Dòng ${rowNumber}: email không hợp lệ.`);
    }
    if (!validSites.has(site)) {
      issues.push(
        `Dòng ${rowNumber}: site "${site}" chưa có trong EVENT_CONFIG.`
      );
    }
  });

  if (issues.length) {
    throw new Error(issues.slice(0, 30).join('\n'));
  }

  return {
    success: true,
    message: 'Dữ liệu hợp lệ.',
    totalEmployees: rows.filter(row => normalizeId_(row[0])).length
  };
}

function sendTestInvitationVercel() {
  const sheet = getSheet_(CONFIG.INVITATION_SHEET);
  const testId = normalizeId_(CONFIG.TEST_EMPLOYEE_ID);
  const rowNumber = findRowById_(sheet, testId);

  if (rowNumber === -1) {
    throw new Error(`Không tìm thấy ID ${testId} trong cột A.`);
  }

  ensureTokenAndLinkForRow_(sheet, rowNumber);

  const row = sheet.getRange(rowNumber, 1, 1, 12).getDisplayValues()[0];
  const name = String(row[1] || 'Ahamover').trim();
  const site = normalizeSite_(row[3]);
  const link = String(row[8] || '').trim();
  const event = getEventConfigBySite_(site);

  sendOneEmail_(
    CONFIG.TEST_EMAIL,
    name,
    site,
    event,
    link,
    true
  );

  return {
    success: true,
    email: CONFIG.TEST_EMAIL,
    link,
    site
  };
}

function sendAllInvitationsVercel() {
  const sheet = getSheet_(CONFIG.INVITATION_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Tab INVITATION chưa có dữ liệu.');
  }

  generateTokensAndInvitationLinks();
  validateBirthdayData();

  const data = sheet
    .getRange(2, 1, lastRow - 1, 12)
    .getDisplayValues();

  const eventMap = getEventConfigMap_();
  const quota = MailApp.getRemainingDailyQuota();
  const limit = Math.min(CONFIG.BATCH_LIMIT, quota);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  data.forEach((row, index) => {
    if (sent >= limit) return;

    const rowNumber = index + 2;
    const id = normalizeId_(row[0]);
    const name = String(row[1] || 'Ahamover').trim();
    const email = String(row[2] || '').trim();
    const site = normalizeSite_(row[3]);
    const link = String(row[8] || '').trim();
    const emailStatus = String(row[9] || '').trim().toUpperCase();

    if (emailStatus === 'SENT') {
      skipped++;
      return;
    }

    if (!id || !isValidEmail_(email) || !link || !eventMap[site]) {
      sheet.getRange(rowNumber, 10).setValue('ERROR');
      sheet.getRange(rowNumber, 12).setValue(
        'Thiếu ID, email, link hoặc cấu hình địa điểm.'
      );
      errors++;
      return;
    }

    try {
      sendOneEmail_(
        email,
        name,
        site,
        eventMap[site],
        link,
        false
      );

      sheet.getRange(rowNumber, 10).setValue('SENT');
      sheet.getRange(rowNumber, 11).setValue(new Date());
      sheet.getRange(rowNumber, 12).clearContent();

      sent++;
      Utilities.sleep(300);
    } catch (error) {
      sheet.getRange(rowNumber, 10).setValue('ERROR');
      sheet.getRange(rowNumber, 12).setValue(
        error.message || 'Không thể gửi email.'
      );
      errors++;
    }
  });

  SpreadsheetApp.flush();

  return {
    success: true,
    sent,
    skipped,
    errors,
    remainingQuota: MailApp.getRemainingDailyQuota()
  };
}

function ensureTokenAndLinkForRow_(sheet, rowNumber) {
  const baseUrl = normalizeBaseUrl_(CONFIG.VERCEL_BASE_URL);
  const id = normalizeId_(sheet.getRange(rowNumber, 1).getDisplayValue());

  if (!id) {
    throw new Error(`Dòng ${rowNumber} chưa có ID.`);
  }

  let token = normalizeToken_(
    sheet.getRange(rowNumber, 8).getDisplayValue()
  );

  if (!token) {
    token = createSecureToken_();
    sheet.getRange(rowNumber, 8).setValue(token);
  }

  const link = `${baseUrl}/i/${encodeURIComponent(token)}`;
  sheet.getRange(rowNumber, 9).setValue(link);
  SpreadsheetApp.flush();
}

function sendOneEmail_(email, name, site, event, link, isTest) {
  const subject = `${isTest ? '[TEST] ' : ''}${CONFIG.SUBJECT}`;
  const safeName = escapeHtml_(name);
  const safeLink = escapeHtml_(link);
  const safeSite = escapeHtml_(site);
  const safeVenue = escapeHtml_(event.venueName);
  const safeDetail = escapeHtml_(event.venueDetail);
  const safeAddress = escapeHtml_(event.address);
  const safeDate = escapeHtml_(event.eventDate);
  const safeTime = escapeHtml_(event.eventTime);

  const htmlBody = `
  <div style="margin:0;padding:24px 12px;background:#eef2f7;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:auto;overflow:hidden;border-radius:24px;background:#061a38;text-align:center">
      <a href="${safeLink}" target="_blank" style="display:block;padding:52px 24px;background:#061a38;color:#fff;text-decoration:none">
        <div style="font-size:64px;font-weight:700;color:#ff7a1a">11</div>
        <div style="margin-top:14px;font-size:20px;font-weight:700">11 NĂM CHUYỂN MÌNH</div>
        <div style="margin-top:6px;font-size:17px;font-weight:700;color:#8dccff">CHUYỂN MÌNH BỨT PHÁ</div>
      </a>

      <div style="padding:30px 26px 34px">
        <p style="margin:0 0 16px;color:#fff;font-size:18px;font-weight:700">Thân gửi ${safeName},</p>

        <p style="margin:0;color:#c7d6e8;font-size:15px;line-height:1.7">
          Một lời mời đặc biệt đang chờ bạn khám phá.
          Hãy chạm vào nút bên dưới để mở thư mời Sinh nhật Ahamove 11 tuổi.
        </p>

        <div style="margin:24px 0 0;padding:18px;border:1px solid rgba(255,255,255,.16);border-radius:16px;background:#0b2449;color:#fff;text-align:left">
          <div style="font-size:12px;color:#8dccff;font-weight:700">${safeSite} CELEBRATION NIGHT</div>
          <div style="margin-top:8px;font-size:18px;font-weight:700">${safeVenue}</div>
          ${safeDetail ? `<div style="margin-top:4px;color:#d7e6f5;font-size:14px">${safeDetail}</div>` : ''}
          ${safeAddress ? `<div style="margin-top:8px;color:#91a6bd;font-size:13px;line-height:1.5">${safeAddress}</div>` : ''}
          <div style="margin-top:12px;color:#ff8738;font-size:14px;font-weight:700">${safeTime} • ${safeDate}</div>
        </div>

        <a href="${safeLink}" target="_blank" style="display:inline-block;margin-top:26px;padding:16px 30px;border-radius:14px;background:#f26522;color:#fff;font-size:15px;font-weight:700;text-decoration:none">
          CHẠM ĐỂ MỞ THƯ MỜI
        </a>

        <p style="margin:22px 0 0;color:#7890ab;font-size:12px;line-height:1.6">
          Nếu nút không hoạt động, mở đường dẫn:<br>
          <a href="${safeLink}" style="color:#8dccff;word-break:break-all">${safeLink}</a>
        </p>
      </div>
    </div>
  </div>`;

  GmailApp.sendEmail(
    email,
    subject,
    `Thân gửi ${name},

${site} Celebration Night
${event.venueName}${event.venueDetail ? ' - ' + event.venueDetail : ''}
${event.address}
${event.eventTime} - ${event.eventDate}

Mở thư mời tại:
${link}`,
    {
      htmlBody,
      name: CONFIG.SENDER_NAME
    }
  );
}

function getEventConfigMap_() {
  const sheet = getSheet_(CONFIG.EVENT_CONFIG_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('EVENT_CONFIG chưa có dữ liệu.');
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, 7)
    .getDisplayValues();

  return rows.reduce((map, row) => {
    const site = normalizeSite_(row[0]);
    if (!site) return map;

    map[site] = {
      site,
      eventDate: String(row[1] || '').trim(),
      eventTime: String(row[2] || '').trim(),
      venueName: String(row[3] || '').trim(),
      venueDetail: String(row[4] || '').trim(),
      address: String(row[5] || '').trim(),
      mapUrl: String(row[6] || '').trim()
    };

    return map;
  }, {});
}

function getEventConfigBySite_(site) {
  const event = getEventConfigMap_()[normalizeSite_(site)];

  if (!event) {
    throw new Error(`Chưa cấu hình địa điểm cho site ${site}.`);
  }

  return event;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(name);

  if (!sheet) {
    throw new Error(`Không tìm thấy tab ${name}.`);
  }

  return sheet;
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues();

  for (let index = 0; index < values.length; index++) {
    if (normalizeId_(values[index][0]) === id) {
      return index + 2;
    }
  }

  return -1;
}

function createSecureToken_() {
  const raw = [
    Utilities.getUuid(),
    Utilities.getUuid(),
    new Date().getTime(),
    Math.random()
  ].join('|');

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );

  return Utilities.base64EncodeWebSafe(digest)
    .replace(/=+$/g, '')
    .slice(0, 32);
}

function normalizeBaseUrl_(value) {
  const url = String(value || '').trim().replace(/\/+$/, '');

  if (!/^https:\/\/.+/.test(url) || url.includes('YOUR-PROJECT')) {
    throw new Error(
      'Hãy điền Production Domain Vercel vào CONFIG.VERCEL_BASE_URL.'
    );
  }

  return url;
}

function normalizeId_(value) {
  return String(value || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, '')
    .replace(/\.0+$/, '')
    .toLowerCase();
}

function normalizeToken_(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
}

function normalizeSite_(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || '').trim()
  );
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
