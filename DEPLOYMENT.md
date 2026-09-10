# Deploy NHT lên Render và Neon

## 1. Tạo PostgreSQL trên Neon

1. Tạo project và database production trên Neon.
2. Trong **Connection Details**, chọn pooled connection và sao chép connection string.
3. Connection string phải có `sslmode=require`.

Ứng dụng tự tạo các bảng và index còn thiếu khi khởi động. Không cần chạy SQL thủ công cho lần deploy đầu tiên.

## 2. Tạo Web Service trên Render

Repository đã có `render.yaml`. Có thể chọn **New > Blueprint** trên Render và kết nối repository.

- Plan: Starter
- Health check: `/healthz`
- Build: `npm ci --include=dev && npm run build && npm --prefix backend ci --omit=dev`
- Start: `npm --prefix backend start`

## 3. Khai báo biến môi trường

Các biến bắt buộc:

- `DATABASE_URL`: pooled connection string từ Neon.
- `ADMIN_USERNAME`: tên đăng nhập quản trị.
- `ADMIN_PASSWORD`: mật khẩu mạnh, duy nhất.
- `ADMIN_SESSION_SECRET`: Render Blueprint tự sinh. Nếu tạo service thủ công, dùng chuỗi ngẫu nhiên tối thiểu 32 byte.

Để gửi email:

- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL`.
- Với Gmail, `SMTP_PASS` là App Password, không phải mật khẩu Gmail.

Để tải ảnh thông tư:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Không đưa file `.env` hoặc giá trị bí mật vào Git.

Render tự cung cấp `RENDER_EXTERNAL_URL` cho URL `onrender.com`. Khi gắn custom domain, thêm `PUBLIC_SITE_URL` bằng URL HTTPS chính thức, không có dấu `/` cuối.

## 4. Kiểm tra sau deploy

1. Mở `/healthz`, kết quả phải là `{ "ok": true }`.
2. Mở trang chủ và kiểm tra trên desktop, điện thoại.
3. Gửi một form liên hệ thật và xác nhận dữ liệu xuất hiện trong admin.
4. Kiểm tra email khách hàng và email quản trị.
5. Đăng nhập `/admin-login.html`, tạo bản nháp, tải ảnh và xuất Excel.
6. Mở `/robots.txt` và `/sitemap.xml`.
7. Sau khi gắn custom domain, cập nhật `PUBLIC_SITE_URL` rồi redeploy.

## 5. Rollback

Nếu bản mới có lỗi, dùng **Rollback** trong Render để quay lại deploy thành công gần nhất. Neon không bị xóa dữ liệu khi rollback ứng dụng.
# Cập nhật luồng yêu cầu tư vấn

Backend tự bổ sung `request_key`, `request_hash`, `mail_attempt_started_at` và unique index khi khởi động. Các cột mới cho phép NULL nên dữ liệu khách hàng cũ được giữ nguyên. Cần khởi động lại backend để áp dụng mã mới.

`npm run test:contact` kiểm tra luồng gửi yêu cầu bằng PostgreSQL TEMP table trên kết nối riêng, dùng cấu hình database trong `backend/.env`. SMTP được mô phỏng; không gửi email thật hoặc ghi yêu cầu vào bảng khách hàng thật.

Trong quản trị, mở chi tiết yêu cầu để xem trạng thái email và bấm “Gửi lại email chưa gửi thành công”. Email đã được ghi nhận gửi thành công sẽ được bỏ qua. Nếu máy chủ dừng giữa lần gửi, có thể thử lại sau 10 phút. SMTP không đảm bảo gửi đúng một lần khi thư đã được nhận nhưng máy chủ dừng trước khi lưu trạng thái; mã chống trùng bảo vệ bản ghi yêu cầu tư vấn.
