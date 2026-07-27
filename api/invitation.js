const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhSMeFcg9wi_7koHPQOnES29NdguEaCpOfIalCDnn6ZqLqzTCnNXOMK9aK1GTsrhR1/exec';

function splitVenue(value) {
  const text = String(value || '').trim();
  if (!text) return { venueName: '', venueDetail: '' };

  const parts = text.split(/\s+[–—-]\s+/);
  return {
    venueName: parts[0] || text,
    venueDetail: parts.slice(1).join(' – ')
  };
}

function normalizeEventDate(value) {
  if (!value) return '';

  const text = String(value).trim();

  let match = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) {
    return `${String(match[3]).padStart(2, '0')}/${String(match[2]).padStart(2, '0')}/${match[1]}`;
  }

  match = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (match) {
    return `${String(match[1]).padStart(2, '0')}/${String(match[2]).padStart(2, '0')}/${match[3]}`;
  }

  return text;
}

function buildInvitationResponse(source) {
  const event = source.event || {};
  const venue = splitVenue(event.venue);
  const mapQuery = [event.venue, event.city]
    .filter(Boolean)
    .join(', ');

  return {
    employeeId: source.employeeId || '',
    name: source.name || 'Ahamover',
    email: source.email || '',
    dept: source.dept || '',
    location: source.location || event.code || '',
    token: source.token || '',
    invitationLink: source.invitationLink || '',
    status: source.status || '',
    note: source.note || '',
    responseTime: source.responseTime || '',
    event: {
      site: event.code || source.eventCode || source.location || 'SGN',
      eventDate: normalizeEventDate(event.date || ''),
      eventTime: event.time || '',
      venueName: venue.venueName,
      venueDetail: venue.venueDetail,
      address: event.address || event.city || '',
      city: event.city || '',
      dresscode: event.dresscode || '',
      mapUrl: mapQuery
        ? 'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(mapQuery)
        : ''
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method không được hỗ trợ.'
    });
  }

  const token = String(req.query.token || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!token && !email) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu token hoặc email tra cứu.'
    });
  }

  try {
    const params = new URLSearchParams();

    if (email) {
      params.set('action', 'lookupByEmail');
      params.set('email', email);
    } else {
      params.set('action', 'invitation');
      params.set('token', token);
    }

    const upstream = await fetch(
      APPS_SCRIPT_URL + '?' + params.toString(),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        cache: 'no-store'
      }
    );

    const rawText = await upstream.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw new Error(
        'Apps Script không trả về JSON hợp lệ. Hãy kiểm tra deployment /exec.'
      );
    }

    if (!upstream.ok || !data.ok || !data.invitation) {
      return res.status(upstream.ok ? 404 : 502).json({
        success: false,
        message:
          data.message ||
          (email
            ? 'Email này chưa có thư mời.'
            : 'Không tìm thấy thông tin thư mời.')
      });
    }

    return res.status(200).json({
      success: true,
      invitation: buildInvitationResponse(data.invitation)
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Không thể kết nối đến hệ thống thư mời.'
    });
  }
}
