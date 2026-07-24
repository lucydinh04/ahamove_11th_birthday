const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhSMeFcg9wi_7koHPQOnES29NdguEaCpOfIalCDnn6ZqLqzTCnNXOMK9aK1GTsrhR1/exec';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method không được hỗ trợ.'
    });
  }

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  const token = String(body.token || '').trim();
  const status = String(body.status || '').trim();
  const note = String(body.note || '').trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu token thư mời.'
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu trạng thái phản hồi.'
    });
  }

  try {
    // text/plain avoids unnecessary CORS preflight when calling Apps Script.
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        action: 'rsvp',
        token,
        status,
        note
      }),
      redirect: 'follow'
    });

    const rawText = await upstream.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw new Error(
        'Apps Script không trả về JSON hợp lệ. Hãy deploy lại Web app.'
      );
    }

    if (!upstream.ok || !data.ok) {
      return res.status(upstream.ok ? 400 : 502).json({
        success: false,
        message:
          data.message ||
          'Không thể ghi nhận phản hồi.'
      });
    }

    return res.status(200).json({
      success: true,
      status: data.status || status,
      note: data.note || note,
      message: data.message || 'Đã ghi nhận phản hồi.',
      responseTime: data.responseTime || ''
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Không thể kết nối đến hệ thống RSVP.'
    });
  }
}
