# AHAMOVE 11 — BỘ CODE ĐỒNG BỘ VERCEL + APPS SCRIPT

## Đã cấu hình

- Apps Script Web App:
  https://script.google.com/macros/s/AKfycbzhSMeFcg9wi_7koHPQOnES29NdguEaCpOfIalCDnn6ZqLqzTCnNXOMK9aK1GTsrhR1/exec
- Frontend:
  https://ahamove11th.vercel.app
- Spreadsheet ID:
  10pPJeyJS6qlC0BZwB9YyAZlf-NTPYBLK5GinpZL5erg
- Logo File ID:
  1RPA5ZDDKIlnrjMni2o6DIa3cDaofesks

## Cấu trúc deploy lên Vercel

Upload nguyên thư mục gốc gồm:

- index.html
- background.png
- 11_3D.png
- vercel.json
- api/invitation.js
- api/rsvp.js

Không upload riêng mỗi file index.html vì frontend cần hai API proxy trong thư mục `api`.

## Data đầu vào trong Google Sheet

Tên tab: `Invitations`

### Cột bắt buộc

| Employee ID | Name           | Email         | Location | Email Status |
| ----------- | -------------- | ------------- | -------- | ------------ |
| AHM001      | Nguyễn Văn A | a@ahamove.com | SGN      | PENDING      |
| AHM002      | Trần Thị B   | b@ahamove.com | HAN      | PENDING      |

`Location` nên dùng `SGN` hoặc `HAN`.

### Cột tùy chọn để custom từng dòng

| Event | Event Date | Event Time | Venue                          | City              |
| ----- | ---------- | ---------- | ------------------------------ | ----------------- |
| SGN   | 07/08/2026 | 18:00      | Riverside Palace – Sảnh Nile | TP. Hồ Chí Minh |
| HAN   | 14/08/2026 | 18:00      | Novotel Hanoi Thai Ha          | Hà Nội          |

Thứ tự ưu tiên:

1. `Event Date`, `Event Time`, `Venue`, `City` trong từng dòng.
2. Nếu để trống, dùng mặc định theo `Event` hoặc `Location`.
3. `Name` được lấy trực tiếp từ cột `Name`.

## Cách tạo link thư mời

Code Apps Script sẽ tạo link dạng:

`https://ahamove11th.vercel.app/i/TOKEN_CÁ_NHÂN`

Frontend đọc token, gọi `/api/invitation`, Vercel proxy sang Apps Script và trả dữ liệu đúng format cho giao diện.

## Cách cập nhật

### Apps Script

1. Thay `Code.gs` và `EmailTemplate.html` bằng hai file trong thư mục `apps-script`.
2. Save.
3. Deploy > Manage deployments > Edit.
4. Chọn **New version**.
5. Execute as: Me.
6. Who has access: Anyone.
7. Deploy.

### Vercel

Deploy lại toàn bộ thư mục này.

Sau deploy, mở thử:

`https://ahamove11th.vercel.app/api/invitation?token=TOKEN_TEST`

Kết quả hợp lệ phải có:

```json
{
  "success": true,
  "invitation": {
    "name": "Tên nhân sự",
    "event": {
      "site": "SGN",
      "eventDate": "07/08/2026",
      "eventTime": "18:00",
      "venueName": "Riverside Palace",
      "venueDetail": "Sảnh Nile"
    }
  }
}
```

## Lưu ý quan trọng

Sau khi sửa `Code.gs`, phải cập nhật deployment thành **New version**. Chỉ bấm Save không làm URL `/exec` chạy code mới.
