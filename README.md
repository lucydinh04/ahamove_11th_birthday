# Ahamove 11 – Vercel Token + Địa điểm SGN/HAN

Bản final này dùng:

- Một website duy nhất trên Vercel.
- Mỗi nhân viên có một token ngẫu nhiên riêng.
- Link dạng `https://TEN-PROJECT.vercel.app/i/TOKEN`.
- SGN và HAN lấy ngày, giờ, venue, sảnh, địa chỉ và Google Maps từ tab `EVENT_CONFIG`.
- Apps Script chỉ tạo token/link và gửi email.
- Vercel Functions đọc/ghi Google Sheet bằng Service Account.

## 1. Google Sheet

### Tab INVITATION

| Cột | Header          |
| ---- | --------------- |
| A    | ID              |
| B    | Name            |
| C    | Email           |
| D    | Site            |
| E    | RSVP            |
| F    | Response Time   |
| G    | Note            |
| H    | Token           |
| I    | Invitation Link |
| J    | Email Status    |
| K    | Sent Time       |
| L    | Error           |

Cột D chỉ dùng `SGN` hoặc `HAN`.

### Tab EVENT_CONFIG

| Cột | Header       |
| ---- | ------------ |
| A    | Site         |
| B    | Event Date   |
| C    | Event Time   |
| D    | Venue Name   |
| E    | Venue Detail |
| F    | Address      |
| G    | Map URL      |

Mẫu:

```text
SGN | 07/08/2026 | 18:00 | Tên venue SGN | Tên sảnh | Địa chỉ | Google Maps
HAN | 14/08/2026 | 18:00 | Tên venue HAN | Tên sảnh | Địa chỉ | Google Maps
```

Chạy `setupBirthdaySheets()` để tạo/cập nhật header và hai dòng cấu hình mẫu.

## 2. Service Account

1. Google Cloud Console → tạo/chọn project.
2. Enable Google Sheets API.
3. IAM & Admin → Service Accounts → Create.
4. Tạo JSON key.
5. Share Google Sheet cho `client_email` trong file JSON với quyền Editor.
6. Không upload file JSON hoặc private key lên GitHub.

## 3. Deploy Vercel

1. Upload toàn bộ thư mục này lên GitHub.
2. Vercel → Add New → Project → Import repo.
3. Framework Preset: Other.
4. Deploy.

## 4. Environment Variables

Thêm trong Vercel:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SHEET_ID
GOOGLE_INVITATION_SHEET=INVITATION
GOOGLE_EVENT_CONFIG_SHEET=EVENT_CONFIG
```

Sau khi thêm hoặc đổi biến môi trường, redeploy.

## 5. Apps Script gửi email

Mở `Code_Email_Sender.gs`, sửa:

```javascript
VERCEL_BASE_URL: 'https://TEN-PROJECT.vercel.app'
TEST_EMAIL: 'email-cua-ban@ahamove.com'
TEST_EMPLOYEE_ID: '257988'
```

Dán toàn bộ vào Apps Script gắn với Google Sheet.

Chạy lần lượt:

1. `setupBirthdaySheets`
2. Điền dữ liệu nhân viên và venue SGN/HAN
3. `validateBirthdayData`
4. `generateTokensAndInvitationLinks`
5. `sendTestInvitationVercel`
6. Test trên Gmail điện thoại
7. `sendAllInvitationsVercel`

## 6. Test trực tiếp

Link thư mời:

```text
https://TEN-PROJECT.vercel.app/i/TOKEN
```

Test API:

```text
https://TEN-PROJECT.vercel.app/api/invitation?token=TOKEN
```

## 7. Khi đổi địa điểm

Chỉ sửa tab `EVENT_CONFIG`. Không cần sửa HTML, API hay redeploy Vercel.

Email đã gửi trước đó vẫn mở ra thông tin venue mới nhất vì landing page luôn tải dữ liệu từ Sheet.

Lưu ý: Nội dung venue hiển thị ngay trong email là dữ liệu tại thời điểm gửi; landing page là dữ liệu cập nhật theo thời gian thực.
