# Đặc tả yêu cầu — Website NHT

> **Phiên bản:** 1.0  
> **Ngày lập:** 06/10/2026  
> **Cơ sở:** phân tích mã nguồn, trang HTML/JavaScript, API, schema cơ sở dữ liệu và tài liệu triển khai hiện có.  
> **Phạm vi:** website giới thiệu dịch vụ kế toán/tư vấn NHT, thu nhận yêu cầu tư vấn, trang quản trị lead và nội dung thông tư pháp luật.

## 1. Mục tiêu và đối tượng

Website cung cấp thông tin về NHT và các dịch vụ; giúp khách hàng gửi yêu cầu tư vấn; giúp quản trị viên tiếp nhận và xử lý lead, quản lý bài thông tư pháp luật và xuất dữ liệu. Tài liệu này mô tả hành vi quan sát được trong phiên bản hiện tại. Nội dung giới thiệu/giá trên website là dữ liệu kinh doanh được công bố, không phải cam kết rằng hợp đồng dịch vụ được tạo tự động qua website.

### Vai trò

- **Khách truy cập:** xem trang công khai, dịch vụ, giá và thông tin pháp luật đã công bố; gửi yêu cầu tư vấn.
- **Quản trị viên:** đăng nhập để xem/xử lý lead, thử gửi lại email và tạo/cập nhật/xóa nội dung thông tư.
- **Hệ thống/tích hợp:** PostgreSQL lưu dữ liệu; SMTP gửi thông báo; Cloudinary lưu ảnh nội dung.

## 2. Business Rules (quy tắc nghiệp vụ)

### BR-01 — Danh mục dịch vụ

Danh mục được dùng chung ở form, API và email, gồm sáu mã dịch vụ:

| Mã | Tên hiển thị |
|---|---|
| `ke-toan-tron-goi` | Kế toán trọn gói |
| `soat-xet-bctc` | Soát xét báo cáo tài chính |
| `bhxh-tien-luong` | Cố vấn nhân sự & bảo hiểm |
| `thu-tuc-phap-ly` | Hành chính & pháp lý |
| `ke-toan-noi-bo-tai-chinh` | Kế toán nội bộ & tài chính |
| `dich-vu-so-ho-tro-khac` | Dịch vụ số & hỗ trợ khác |

Dịch vụ quan tâm có thể để trống; nếu có giá trị thì phải khớp một mã trong danh mục.

### BR-02 — Quy tắc tiếp nhận yêu cầu tư vấn

- Họ tên, email và số điện thoại là bắt buộc ở form. Tên công ty, mã số thuế/CCCD, dịch vụ và nội dung yêu cầu có thể để trống.
- Email phải có định dạng hợp lệ; số điện thoại tối đa 30 ký tự và phải có ít nhất 8 chữ số sau khi bỏ ký tự không phải số.
- Mã số thuế/CCCD nếu có phải là 10 chữ số, 12 chữ số hoặc mã đơn vị phụ thuộc dạng `0123456789-001`.
- Giới hạn dữ liệu phía máy chủ: họ tên 150; email 254; điện thoại 30; tên công ty 200; mã số thuế tối đa 14 theo schema; dịch vụ 100; lời nhắn 5.000 ký tự. API chấp nhận mã thuế trống hoặc theo các mẫu trên. Trường vượt giới hạn được từ chối (một số trường HTML/API có thêm giới hạn riêng).
- Sau kiểm tra hợp lệ, yêu cầu được lưu bền vững trong PostgreSQL trước khi thử gửi email. Lỗi SMTP không làm mất lead hoặc biến việc lưu thành công thành thất bại.
- Form gửi kèm mã yêu cầu UUID để chống gửi lặp. Nếu cùng mã và cùng dữ liệu, hệ thống trả kết quả duplicate mà không tạo lead/gửi lại; cùng mã nhưng dữ liệu khác trả xung đột HTTP 409.
- Mỗi địa chỉ IP được gửi tối đa 5 lần trong 15 phút theo rate limit của API.

### BR-03 — Trạng thái lead và xử lý

- Lead mới mặc định mang trạng thái xử lý `new`; có thể chuyển sang `in_progress` hoặc `completed`.
- Không cho phép chuyển lead đã rời `new` về `new`.
- Khi chuyển sang `completed`, hệ thống lưu thời điểm hoàn tất. Giữ nguyên thời điểm khi vẫn `completed`; nếu chuyển từ `completed` sang `in_progress`, thời điểm hoàn tất được xóa.
- Lead và dữ liệu liên hệ không có thao tác xóa trong giao diện/API quản trị được ghi nhận ở phiên bản hiện tại.

### BR-04 — Email xác nhận và thông báo nội bộ

- Sau khi lưu lead, hệ thống thử email xác nhận cho khách và thông báo cho quản trị viên (nếu có cấu hình người nhận).
- Trạng thái email khách và email quản trị được theo dõi riêng; có thể là `pending`, `sent`, `failed` hoặc `not_configured` tùy kết quả/cấu hình.
- Email đã gửi thành công không được gửi lại khi quản trị viên retry. Nếu chỉ một email thất bại/chưa cấu hình, lần retry chỉ thử các email chưa có trạng thái `sent`.
- Lease gửi email ngăn hai lượt gửi đồng thời; lease quá 10 phút có thể được thử lại. Retry quản trị bị giới hạn 5 lần/phút.
- Nội dung email khách nêu thời gian phản hồi dự kiến trong vòng 24 giờ làm việc; đây là thông tin thông báo hiện có, không có bộ SLA/đồng hồ theo dõi phản hồi tự động trong hệ thống.

### BR-05 — Quy tắc nội dung pháp luật

- Bài thông tư có trạng thái `draft` hoặc `published`; mặc định là bản nháp.
- Tiêu đề bắt buộc. Phải có ít nhất tóm tắt hoặc nội dung. Số văn bản, cơ quan ban hành, ngày ban hành, ngày hiệu lực, nguồn và ảnh là tùy chọn.
- Độ dài tối đa: tiêu đề 250; tóm tắt 600; nội dung 30.000; số văn bản 100; cơ quan 200; URL nguồn 2.000; URL ảnh 500; mã ảnh 300 ký tự.
- URL nguồn nếu có phải bắt đầu bằng HTTP/HTTPS. Ảnh nếu có phải là URL ảnh Cloudinary HTTPS hợp lệ kèm public ID đúng định dạng; URL và public ID phải cùng có hoặc cùng trống.
- Ảnh tải lên chỉ chấp nhận JPEG, PNG, WebP, tối đa 5 MB mỗi file; cần Cloudinary được cấu hình.
- Khách công khai chỉ xem bài `published`. Bản nháp chỉ hiện trong trang quản trị. Khi xuất bản lần đầu ghi `published_at`; lần chỉnh sửa bài đã xuất bản giữ ngày xuất bản; chuyển về nháp xóa ngày xuất bản.
- Khi thay hoặc xóa bài, hệ thống yêu cầu Cloudinary xóa ảnh cũ nếu có public ID; lỗi xóa ảnh chỉ được ghi log.

### BR-06 — Giá và phạm vi dịch vụ được công bố

Theo nội dung `HTML/bang-gia.html`, `HTML` trang dịch vụ và đối chiếu `PRICE_REVIEW.md`, website hiện công bố các mức/điều kiện dưới đây. Đây là giá tham khảo hiển thị, không có giỏ hàng, thanh toán hay tính báo giá tự động.

- Kế toán trọn gói: từ 700.000đ/tháng; mức/điều kiện phụ thuộc doanh thu và phạm vi gói.
- Soát xét BCTC: từ 1.000.000đ/năm; có phụ phí 30% khi phải làm lại sổ sách theo nội dung đối chiếu giá.
- Hành chính/pháp lý: từ 500.000đ/hồ sơ; cần phân biệt cấp lại giấy phép/con dấu với dịch vụ thành lập doanh nghiệp.
- Cố vấn nhân sự/bảo hiểm: từ 1.000.000đ/tháng, với điều kiện quy mô dưới 20 người và doanh thu dưới 5 tỷ/năm theo bảng giá.
- Kế toán nội bộ: từ 6.000.000đ/tháng; hồ sơ tín dụng được tính riêng theo nội dung giá.
- Dịch vụ số/hỗ trợ khác hiển thị các sản phẩm như hóa đơn điện tử/chữ ký số/phần mềm theo gói và thời hạn; thiết bị không mặc nhiên nằm trong giá phần mềm.
- Giá, điều kiện áp dụng và phạm vi cuối cùng cần được xác nhận với NHT. Tài liệu giá tham chiếu không đủ căn cứ để khẳng định mọi giá đã gồm VAT.

> Nội dung giá có thể thay đổi. Hãy đồng bộ phần này với bảng giá được duyệt mỗi khi cập nhật website; không xem tài liệu này là bảng giá hợp đồng.

### BR-07 — Truy cập và công bố nội dung

- Chỉ người có thông tin đăng nhập quản trị cấu hình mới có thể sử dụng API quản trị.
- Trang admin yêu cầu phiên hợp lệ; trang đăng nhập và quản trị bị đặt `noindex`.
- API công khai thông tư chỉ trả nội dung đã xuất bản; dữ liệu lead và CRUD bài viết yêu cầu phiên admin.

## 3. Functional Requirements (yêu cầu chức năng)

### FR-01 — Trang công khai và điều hướng

Hệ thống cung cấp trang chủ, giới thiệu, danh sách/chi tiết dịch vụ, bảng giá, liên hệ, điều khoản và trang thông tư pháp luật; điều hướng liên kết giữa các trang, CTA tới form liên hệ, liên kết điện thoại/email/bản đồ/mạng xã hội. Các đường dẫn dịch vụ có thể truyền mã dịch vụ sang trang liên hệ để điền lựa chọn tương ứng.

### FR-02 — Xem thông tin dịch vụ và giá

Khách có thể xem mô tả, phạm vi, điều kiện, mức giá được công bố và liên kết yêu cầu tư vấn cho từng nhóm dịch vụ. Website không ghi nhận đơn mua hoặc thanh toán trực tuyến.

### FR-03 — Gửi yêu cầu tư vấn

Form nhận họ tên, email, điện thoại, công ty, MST/CCCD, dịch vụ quan tâm và nội dung. Client cung cấp kiểm tra trường bắt buộc/định dạng; server kiểm tra lại, chuẩn hóa khoảng trắng, giới hạn độ dài và kiểm tra danh mục dịch vụ. Trả thông báo thành công/lỗi cho người dùng. Sinh hoặc nhận request UUID, chống ghi lặp, lưu lead vào database và kích hoạt luồng gửi email.

### FR-04 — Đăng nhập/đăng xuất quản trị

Quản trị viên đăng nhập bằng username/password cấu hình ở môi trường máy chủ. Hệ thống đặt cookie phiên sau đăng nhập, cung cấp kiểm tra phiên hiện tại và xóa cookie khi đăng xuất. Sai thông tin trả lỗi xác thực; thiếu cấu hình xác thực trả lỗi máy chủ.

### FR-05 — Xem và xử lý lead

Trang quản trị hiển thị danh sách lead theo thời gian mới nhất, xem thông tin chi tiết, trạng thái xử lý và trạng thái email. Quản trị viên có thể chuyển trạng thái theo các quy tắc BR-03, tải lại danh sách và yêu cầu gửi lại email chưa gửi thành công.

### FR-06 — Xuất lead ra Excel

Quản trị viên có thể tải toàn bộ lead thành `.xlsx`, sắp xếp mới nhất trước. Workbook có thông tin liên hệ/dịch vụ/nội dung, trạng thái xử lý và email, ngày giờ theo múi giờ Việt Nam, tiêu đề, bộ lọc và danh sách chọn trạng thái xử lý.

### FR-07 — Quản lý nội dung thông tư

Quản trị viên có thể xem danh sách tất cả bài, tạo bài nháp/công khai, sửa trạng thái và metadata, xem trước/tải ảnh, xóa bài và tải ảnh lên Cloudinary. Hệ thống xác thực dữ liệu trước khi lưu và ghi người tạo, thời gian tạo/cập nhật/xuất bản.

### FR-08 — Công khai thông tư

Khách có thể xem danh sách thông tư đã xuất bản, được sắp theo ngày xuất bản/khởi tạo mới nhất, mở chi tiết từng bài, đọc nội dung/metadata và theo liên kết tới văn bản gốc nếu có. Bài không tồn tại hoặc chưa xuất bản trả 404.

### FR-09 — Hỗ trợ SEO và trạng thái dịch vụ

Hệ thống cung cấp `robots.txt`, `sitemap.xml`, canonical URL cho trang công khai và endpoint `/healthz` kiểm tra kết nối database. Trang quản trị/API bị loại khỏi lập chỉ mục.

## 4. Non-Functional Requirements (yêu cầu phi chức năng)

### NFR-01 — Bảo mật

- Dùng Helmet, tắt header nhận diện Express, giới hạn JSON request 32 KB, chặn dotfiles; nội dung email escape HTML trước khi chèn vào template.
- Cookie admin `HttpOnly`, `SameSite=Strict`, `Secure` ở production, hết hạn sau 3 giờ; chữ ký HMAC-SHA256 và so sánh credential theo cách constant-time.
- Rate limit đăng nhập 10 lần/15 phút; rate limit form 5 lần/15 phút; giới hạn upload 1 ảnh và 5 MB.
- Production phải cấu hình `DATABASE_URL`, `ADMIN_PASSWORD` tối thiểu 12 ký tự và `ADMIN_SESSION_SECRET` tối thiểu 32 ký tự. Secrets chỉ lưu trong môi trường triển khai, không commit vào Git.
- Truyền truy vấn PostgreSQL có tham số; chỉ admin được gọi endpoint lead/admin.

### NFR-02 — Quyền riêng tư và cache

- Trang/admin response nhạy cảm đặt `Cache-Control: no-store`; endpoint xuất Excel cũng không cache.
- Thông tin cá nhân trong lead gồm họ tên, email, số điện thoại, công ty và MST/CCCD. Chính sách thời gian lưu, xóa/ẩn danh, phân quyền nhiều cấp và nhật ký truy cập không được thể hiện trong mã hiện tại.

### NFR-03 — Tính toàn vẹn và khả năng phục hồi dữ liệu

- PostgreSQL là nguồn lưu trữ bền vững cho lead và bài pháp luật; schema/index cần được áp dụng khi backend khởi động.
- Mã request có unique index; việc lưu lead xảy ra trước tích hợp email.
- `/healthz` trả 503 khi truy vấn database thất bại. Tắt máy đóng HTTP server rồi kết nối database một cách có kiểm soát.
- Chính sách backup/retention database không được mô tả trong mã ứng dụng; phụ thuộc nhà cung cấp/vận hành.

### NFR-04 — Tương thích, giao diện và khả năng tiếp cận

- Trang HTML khai báo `lang="vi"`, viewport cho thiết bị di động; bố cục điều hướng desktop/mobile.
- Điều khiển tương tác quan trọng có nhãn/role, thông báo trạng thái; các hiệu ứng reveal tôn trọng `prefers-reduced-motion`.
- Yêu cầu browser tối thiểu cụ thể chưa được định nghĩa; giao diện dùng HTML/CSS/JavaScript hiện đại.

### NFR-05 — Hiệu năng và băng thông

- Nén response HTTP; static asset có ETag và cache tối đa 1 giờ, font tối đa 30 ngày/immutable. CSP chỉ cho phép nguồn được cấu hình; ảnh Cloudinary được cho phép.
- Chưa có SLO định lượng về thời gian tải, lưu lượng, concurrency hoặc availability trong repository.

### NFR-06 — Triển khai và cấu hình

- Backend chạy Node.js 18 trở lên, Express và PostgreSQL; frontend là static HTML/CSS/JS được Express phục vụ.
- Tài liệu triển khai cấu hình Render/Neon; SMTP và Cloudinary là tích hợp tùy cấu hình. Thiếu SMTP không ngăn lưu lead; thiếu Cloudinary ngăn upload ảnh.
- URL công khai có thể lấy từ `PUBLIC_SITE_URL`, URL Render hoặc request host; dùng HTTPS/custom domain theo cấu hình môi trường production.

### NFR-07 — Quan sát lỗi

Lỗi API trả JSON thông báo; lỗi nội bộ được ghi log phía server và trả lỗi tổng quát. Một số lỗi email/Cloudinary được ghi log và không làm mất dữ liệu nghiệp vụ đã lưu. Chưa có tích hợp log aggregation, metrics, tracing hoặc cảnh báo được khai báo.

## 5. Ngoài phạm vi/giới hạn đã xác nhận

- Không có tài khoản khách hàng, thanh toán, đặt lịch, ký hợp đồng hoặc tạo hóa đơn trực tuyến.
- Không có tìm kiếm/lọc/phân trang lead thể hiện trong API quản trị hiện tại; danh sách được tải toàn bộ.
- Không có nhiều vai trò admin, quản lý người dùng, gán người phụ trách hoặc lưu ghi chú nội bộ trên server; một số cột Excel đang để trống.
- Không có quy trình duyệt nhiều bước, lên lịch xuất bản, phiên bản hóa bài viết hay tác vụ tự động cập nhật pháp luật.
- Không có SLA kỹ thuật, retention dữ liệu hay backup policy được xác định trong source hiện tại.

## 6. Giả định và điểm cần xác nhận

1. Các mức giá là nội dung marketing được duyệt; bảng giá trên website là nguồn hiện hành. Nguồn đối chiếu giá ghi rõ không xác nhận tính cập nhật pháp luật và không đủ căn cứ khẳng định giá gồm VAT.
2. Thời hạn phản hồi 24 giờ làm việc là cam kết nội dung trong email tự động; cần chủ sở hữu nghiệp vụ xác nhận trước khi xem là SLA chính thức.
3. Form cho phép bỏ trống công ty và MST/CCCD, dù database khai báo các cột này `NOT NULL`; API sẽ lưu chuỗi rỗng khi không nhập.
4. Thời hạn lưu lead, quyền yêu cầu xóa dữ liệu, backup/restore và phân quyền admin chi tiết cần chủ sở hữu sản phẩm xác nhận nếu cần đưa vào đặc tả hợp đồng.

## 7. Nguồn nội bộ đã rà soát

- `HTML/*.html`: trang công khai, bảng giá, form liên hệ, trang quản trị.
- `js/main.js`, `js/admin.js`, `js/legal-documents.js`, `js/service-catalog.js`.
- `backend/index.js`, `backend/database.js`, `backend/data/schema.sql`.
- `backend/routes/*.js`, `backend/middleware/admin-auth.js`, `backend/services/*.js`, `backend/utils/legal-document.js`.
- `DEPLOYMENT.md`, `PRICE_REVIEW.md`.

---

*Tài liệu phản ánh triển khai trong repository tại ngày lập; nên rà soát lại cùng chủ sở hữu nghiệp vụ trước khi dùng làm đặc tả hợp đồng hoặc tiêu chí nghiệm thu chính thức.*
