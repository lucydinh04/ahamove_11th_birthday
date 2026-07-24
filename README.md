# Ahamove 11 – Bản 4 file, không có folder

Upload trực tiếp 4 file này vào GitHub:

- `server.js`
- `package.json`
- `Code_Email_Sender.gs`
- `README.md`

Không còn folder `api` và `public`.
Logo đã được nhúng thẳng vào `server.js`.

## Deploy Vercel

1. Tạo GitHub repository.
2. Add file → Upload files.
3. Chọn cả 4 file và upload.
4. Commit changes.
5. Vercel → Add New Project → Import repository.
6. Framework Preset: Other.
7. Deploy.

Vercel hỗ trợ triển khai Express app và tự nhận diện server entrypoint.

## Environment Variables trên Vercel

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SHEET_ID
GOOGLE_INVITATION_SHEET=INVITATION
GOOGLE_EVENT_CONFIG_SHEET=EVENT_CONFIG
```

Sau khi thêm biến môi trường, Redeploy.

## Google Sheet

### INVITATION

```text
A ID
B Name
C Email
D Site
E RSVP
F Response Time
G Note
H Token
I Invitation Link
J Email Status
K Sent Time
L Error
```

### EVENT_CONFIG

```text
A Site
B Event Date
C Event Time
D Venue Name
E Venue Detail
F Address
G Map URL
```

## Apps Script

Mở `Code_Email_Sender.gs`, sửa:

```javascript
VERCEL_BASE_URL: 'https://TEN-PROJECT.vercel.app'
TEST_EMAIL: 'email-cua-ban@ahamove.com'
TEST_EMPLOYEE_ID: '257988'
```

Chạy:

1. `setupBirthdaySheets`
2. `validateBirthdayData`
3. `generateTokensAndInvitationLinks`
4. `sendTestInvitationVercel`
5. `sendAllInvitationsVercel`
