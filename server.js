const { JWT } = require('google-auth-library');

const ALLOWED_STATUSES = new Set([
  'THAM DỰ',
  'KHÔNG THAM GIA ĐƯỢC'
]);

function cleanText(value, maxLength = 1000) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
}

function normalizeSite(value) {
  return String(value ?? '').trim().toUpperCase();
}

function getConfig() {
  const config = {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    invitationSheet: process.env.GOOGLE_INVITATION_SHEET || 'INVITATION',
    eventConfigSheet: process.env.GOOGLE_EVENT_CONFIG_SHEET || 'EVENT_CONFIG'
  };

  const missing = ['clientEmail', 'privateKey', 'spreadsheetId']
    .filter(key => !config[key]);

  if (missing.length) {
    throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  }

  return config;
}

async function getAccessToken() {
  const { clientEmail, privateKey } = getConfig();

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const credentials = await auth.authorize();

  if (!credentials.access_token) {
    throw new Error('Không thể xác thực Google Sheets API.');
  }

  return credentials.access_token;
}

async function sheetsRequest(path, options = {}) {
  const token = await getAccessToken();

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Google Sheets API trả về lỗi ${response.status}.`
    );
  }

  return data;
}

async function readRows(sheetName, rangeColumns) {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${sheetName}!${rangeColumns}`);

  const data = await sheetsRequest(
    `${spreadsheetId}/values/${range}?majorDimension=ROWS`
  );

  return Array.isArray(data.values) ? data.values : [];
}

async function findInvitationByToken(rawToken) {
  const token = normalizeToken(rawToken);
  if (!token) return null;

  const { invitationSheet } = getConfig();
  const rows = await readRows(invitationSheet, 'A2:L');

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const sheetToken = normalizeToken(row[7]);

    if (sheetToken && sheetToken === token) {
      return {
        rowNumber: index + 2,
        id: cleanText(row[0], 100),
        name: cleanText(row[1] || 'Ahamover', 200),
        email: cleanText(row[2], 320),
        site: normalizeSite(row[3]),
        status: cleanText(row[4], 100),
        responseTime: cleanText(row[5], 100),
        note: cleanText(row[6], 1000),
        token: sheetToken
      };
    }
  }

  return null;
}

async function getEventBySite(rawSite) {
  const site = normalizeSite(rawSite);
  if (!site) return null;

  const { eventConfigSheet } = getConfig();
  const rows = await readRows(eventConfigSheet, 'A2:G');

  for (const row of rows) {
    if (normalizeSite(row[0]) === site) {
      return {
        site,
        eventDate: cleanText(row[1], 20),
        eventTime: cleanText(row[2], 20),
        venueName: cleanText(row[3], 300),
        venueDetail: cleanText(row[4], 300),
        address: cleanText(row[5], 500),
        mapUrl: cleanText(row[6], 1000)
      };
    }
  }

  return null;
}

async function updateRsvp(rowNumber, status, note) {
  const { spreadsheetId, invitationSheet } = getConfig();
  const safeName = invitationSheet.replace(/'/g, "''");
  const rangeA1 = `'${safeName}'!E${rowNumber}:G${rowNumber}`;
  const encodedRange = encodeURIComponent(rangeA1);
  const now = new Date().toISOString();

  await sheetsRequest(
    `${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: rangeA1,
        majorDimension: 'ROWS',
        values: [[status, now, note]]
      })
    }
  );

  return now;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
}

module.exports = async function handler(req, res) {
  try {
    const pathname = new URL(
      req.url,
      `https://${req.headers.host || 'localhost'}`
    ).pathname;

    if (pathname === '/api/invitation' && req.method === 'GET') {
      const url = new URL(
        req.url,
        `https://${req.headers.host || 'localhost'}`
      );

      const token = normalizeToken(url.searchParams.get('token'));

      if (!token) {
        return sendJson(res, 400, {
          success: false,
          message: 'Đường dẫn thư mời không hợp lệ.'
        });
      }

      const invitation = await findInvitationByToken(token);

      if (!invitation) {
        return sendJson(res, 404, {
          success: false,
          message: 'Không tìm thấy thư mời hoặc token đã không còn hợp lệ.'
        });
      }

      const event = await getEventBySite(invitation.site);

      if (!event) {
        return sendJson(res, 500, {
          success: false,
          message: `Chưa cấu hình địa điểm cho site ${invitation.site || 'không xác định'}.`
        });
      }

      return sendJson(res, 200, {
        success: true,
        invitation: {
          name: invitation.name,
          site: invitation.site,
          status: invitation.status,
          event
        }
      });
    }

    if (pathname === '/api/rsvp' && req.method === 'POST') {
      const body = getBody(req);
      const token = normalizeToken(body.token);
      const status = cleanText(body.status, 100);
      const note = cleanText(body.note || '', 1000);

      if (!token) {
        return sendJson(res, 400, {
          success: false,
          message: 'Token thư mời không hợp lệ.'
        });
      }

      if (!ALLOWED_STATUSES.has(status)) {
        return sendJson(res, 400, {
          success: false,
          message: 'Trạng thái phản hồi không hợp lệ.'
        });
      }

      const invitation = await findInvitationByToken(token);

      if (!invitation) {
        return sendJson(res, 404, {
          success: false,
          message: 'Không tìm thấy thư mời hoặc token đã không còn hợp lệ.'
        });
      }

      const responseTime = await updateRsvp(
        invitation.rowNumber,
        status,
        note
      );

      const message =
        status === 'THAM DỰ'
          ? 'Đã xác nhận tham dự thành công. Hẹn gặp bạn tại chương trình!'
          : 'BTC đã ghi nhận bạn không thể tham dự. Hẹn gặp bạn vào dịp tiếp theo!';

      return sendJson(res, 200, {
        success: true,
        status,
        responseTime,
        message
      });
    }

    return sendJson(res, 404, {
      success: false,
      message: 'API không tồn tại.'
    });
  } catch (error) {
    console.error('Serverless API failed:', error);

    return sendJson(res, 500, {
      success: false,
      message: 'Hệ thống chưa thể xử lý yêu cầu. Vui lòng kiểm tra cấu hình Vercel.'
    });
  }
};
