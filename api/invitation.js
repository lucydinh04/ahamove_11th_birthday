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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method không được hỗ trợ.'
    });
  }

  const token = String(req.query.token || '').trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu token thư mời.'
    });
  }

  try {
    const url =
      APPS_SCRIPT_URL +
      '?action=invitation&token=' +
      encodeURIComponent(token);

    const upstream = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      cache: 'no-store'
    });

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
          'Không tìm thấy thông tin thư mời.'
      });
    }

    const source = data.invitation;
    const event = source.event || {};
    const venue = splitVenue(event.venue);
    const mapQuery = [event.venue, event.city]
      .filter(Boolean)
      .join(', ');

    return res.status(200).json({
      success: true,
      invitation: {
        employeeId: source.employeeId || '',
        name: source.name || 'Ahamover',
        email: source.email || '',
        location: source.location || event.code || '',
        status: source.status || '',
        note: source.note || '',
        responseTime: source.responseTime || '',
        event: {
          site: event.code || source.eventCode || source.location || 'SGN',
          eventDate: event.date || '',
          eventTime: event.time || '',
          venueName: venue.venueName,
          venueDetail: venue.venueDetail,
          address: event.city || '',
          city: event.city || '',
          dresscode: event.dresscode || '',
          mapUrl: mapQuery
            ? 'https://www.google.com/maps/search/?api=1&query=' +
              encodeURIComponent(mapQuery)
            : ''
        }
      }
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
