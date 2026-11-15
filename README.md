# 🏠 Rental House Management System (Hệ Thống Quản Lý Nhà Trọ)

Hệ thống quản lý nhà trọ, phòng trọ, khách thuê, chụp ảnh & ghi chỉ số điện nước minh bạch, lập hóa đơn tự động và ký kết hợp đồng điện tử bất biến bảo mật cao, triển khai trọn bộ Frontend & Backend Serverless trên Netlify.

---

## 🌟 Tính Năng Nổi Bật

### 1. Dành Cho Người Thuê Phòng (Tenant Portal)
- **Xác thực qua số điện thoại**: Đăng nhập nhanh bằng OTP bảo mật (không cần mật khẩu phức tạp).
- **Giao diện thân thiện tối ưu cho người lớn tuổi**: Chữ to rõ ràng ($\ge 18\text{px}$), số tiền hiển thị nổi bật ($32\text{px}$ bold), nút bấm lớn ($\ge 52\text{px}$), màu sắc tương phản cao, ngôn ngữ tiếng Việt dễ hiểu.
- **Xem chi tiết tiền phòng, tiền điện, tiền nước tháng hiện tại**: Hiển thị chỉ số cũ, chỉ số mới, số lượng tiêu thụ, đơn giá và ảnh chụp đồng hồ thực tế kèm phóng to.
- **Biểu đồ lịch sử sử dụng**: Theo dõi xu hướng dùng điện và nước trong 3 tháng, 6 tháng, 12 tháng kèm mức tiêu thụ trung bình.
- **Ký hợp đồng điện tử trên màn hình cảm ứng**: Ký trực tiếp bằng ngón tay hoặc chuột trên khung chữ ký số (HTML5 Canvas), khóa hợp đồng vĩnh viễn với mã băm toàn vẹn SHA-256.
- **Liên hệ chủ nhà**: Tự động hiển thị số điện thoại chủ nhà sau khi hoàn tất ký hợp đồng.

### 2. Dành Cho Quản Trị Viên / Chủ Nhà (Admin Dashboard)
- **Quản lý phòng trọ**: Theo dõi tình trạng phòng (còn trống, đang thuê, bảo trì), giá thuê, lịch sử khách thuê (xóa mềm bảo toàn dữ liệu).
- **Quản lý khách thuê**: Đăng ký, phân phòng, lưu trữ thông tin liên hệ.
- **Chụp ảnh công tơ & Ghi chỉ số điện nước thủ công (Admin)**:
  - Chụp ảnh trực tiếp từ camera thiết bị (hỗ trợ đèn Flash) hoặc tải ảnh từ thư viện; hỗ trợ tạo chỉ số trước rồi bổ sung ảnh sau.
  - Quản trị viên tự đối chiếu ảnh mặt đồng hồ thực tế và nhập chỉ số cũ / chỉ số mới (đối với công tơ điện cơ chỉ nhập 5 chữ số ô trắng, bỏ qua chữ số ô đỏ thập phân).
  - Tự động tính mức tiêu thụ (hỗ trợ trừ tự động Phòng 2 & Phòng 3 cho đồng hồ nước tổng Phòng 1), cảnh báo bất thường khi chỉ số mới nhỏ hơn chỉ số cũ (trừ trường hợp quay vòng/thay đồng hồ).
- **Lập hóa đơn tự động & Thông báo đa kênh (SMS OTP & Email Resend)**:
  - Tự động tập hợp tiền phòng + tiền điện + tiền nước + phí dịch vụ cho các phòng đang thuê.
  - Tự động gửi thông báo trực tiếp qua **SMS OTP** và **Email Resend** kèm bảng kê chi tiết cho khách thuê ngay khi lập.
  - Chốt đơn giá tại thời điểm lập (snapshot pricing) để hóa đơn lịch sử không bao giờ bị sai lệch.
- **Tối ưu hóa Giao diện Di động (Mobile-First Card UI)**:
  - Danh sách hóa đơn, danh sách phòng trọ và hợp đồng tự động chuyển sang giao diện thẻ card thông minh trên màn hình nhỏ ($\le 768\text{px}$).
  - Không cần cuộn ngang, nút bấm lớn thuận tiện thao tác một tay.
  - Thanh điều hướng đáy kính lỏng Apple (Liquid Glass Dock) phong cách tối giản.
- **Tối ưu hóa SEO & Khả năng Tìm kiếm**:
  - Tích hợp chuẩn Schema.org JSON-LD (ApartmentComplex), OpenGraph, Twitter Card, Sitemap.xml, Robots.txt và Dynamic Page SEO Hook.
- **Quản lý hợp đồng & Tính toàn vẹn**:
  - Soạn thảo hợp đồng mới, chủ nhà ký điện tử trước.
  - Giữ lại vĩnh viễn lịch sử hợp đồng cũ khi khách rời đi và có khách mới đến thuê.
  - Sau khi 2 bên ký, sinh file PDF bất biến, lưu trữ mã băm mật mã học SHA-256 (`contracts.document_hash`).
  - Database trigger ngăn chặn tuyệt đối mọi hành vi sửa đổi hoặc xóa hợp đồng đã ký.
- **Phân tích dữ liệu & Cảnh báo**:
  - Tỷ lệ lấp đầy phòng, doanh thu tiền phòng, tiền điện, tiền nước.
  - Phát hiện tiêu thụ bất thường so với mức trung bình 3-6 tháng.
  - Dự báo khoảng tiêu thụ ước tính cho tháng tiếp theo kèm mức độ tin cậy.
- **Nhật ký kiểm toán (Audit Logs)**: Ghi nhận chi tiết: Ai đã làm gì? Vào lúc nào? Dữ liệu trước và sau thay đổi? Địa chỉ IP và thiết bị.

---

## 🛠️ Công Nghệ Sử Dụng

| Thành Phần | Công Nghệ |
|---|---|
| **Frontend** | React 18, Vite 6, React Router 6, Axios, Recharts, Lucide React, High-Contrast Accessible CSS |
| **Mobile App (Android & iOS)** | Capacitor 8, Android Studio / Gradle, Xcode (Swift Package Manager), PWA Standalone |
| **Backend & Serverless** | Node.js (v20+), Express.js, Netlify Functions (`serverless-http`), `pg`, Argon2 / bcryptjs, Cookie-Parser, Helmet, Multer, PDFKit |
| **Database** | Neon Serverless PostgreSQL 16+ (Normalized, UUIDs, Triggers, Indexes, Constraints) |
| **Hosting & Deploy** | Netlify Full-Stack (Vite Static CDN + Netlify Serverless Functions + Scheduled Billing Cron) |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### Cách 1: Chạy trực tiếp bằng Node.js (Nhanh nhất)

#### 1. Khởi động Backend API
```bash
cd backend
npm install
node server.js
```
API sẽ lắng nghe tại: `http://localhost:5000`
*(Hệ thống đã tích hợp sẵn In-Memory Mock Store nạp đầy đủ dữ liệu mẫu của `seeds.sql` khi chưa kết nối Neon DB).*

#### 2. Khởi động Frontend
```bash
cd frontend
npm install
npm run dev
```
Giao diện người dùng sẽ chạy tại: `http://localhost:5173`

---

### Cách 2: Chạy toàn bộ hệ thống bằng Docker Compose

```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Database: Kết nối trực tiếp máy chủ đám mây **Neon PostgreSQL** (không cần container PostgreSQL cục bộ)

### Cách 3: Triển khai Full-Stack trên Netlify (Frontend + Backend Functions)
Xem hướng dẫn chi tiết tại [`NETLIFY.md`](./NETLIFY.md). Mọi yêu cầu `/api/*`, `/uploads/*` và `/health` được điều hướng thẳng vào `backend/netlify/functions/api.mjs` qua [`netlify.toml`](./netlify.toml).

---

### 📱 Cách 3: Ứng Dụng Di Động (Android & iOS)

- **Tệp APK Android đã biên dịch sẵn**: [`dist-mobile/NhaTroThanhTam-v1.0.0.apk`](file:///c:/rent_house/dist-mobile/NhaTroThanhTam-v1.0.0.apk) (Chép vào điện thoại Android và cài đặt ngay).
- **Dự án iOS**: [`frontend/ios/App`](file:///c:/rent_house/frontend/ios/App) (Mở bằng Xcode trên macOS: `npm run mobile:ios`).
- **Cài đặt tức thì trên iPhone qua Safari (PWA)**: Mở `https://nhatrothanhtam.netlify.app` > Bấm *Chia sẻ* > Chọn *"Thêm vào Màn hình chính"*.
- **Tài liệu hướng dẫn chi tiết**: Xem tại [`MOBILE_APP_GUIDE.md`](file:///c:/rent_house/MOBILE_APP_GUIDE.md).
- **Lệnh biên dịch lại APK 1 chạm**: Chạy file [`build-android-apk.bat`](file:///c:/rent_house/build-android-apk.bat) hoặc gõ `npm run mobile:build`.

---

## 🔑 Tài Khoản Dùng Thử Mẫu

### 1. Dành cho Chủ nhà / Quản trị viên:
- Đường dẫn: `http://localhost:5173/admin/login`
- Tên đăng nhập: `admin`
- Mật khẩu: `Admin@123456`

### 2. Dành cho Người thuê phòng:
- Đường dẫn: `http://localhost:5173/tenant/login`
- Số điện thoại: `0912345678` (Phòng P101 - Nguyễn Văn An) hoặc `0987654321` (Phòng P102 - Trần Thị Bích)
- Mã xác thực OTP: `123456` (hoặc mã hiển thị trên màn hình kiểm thử)

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Neon PostgreSQL)

File kịch bản SQL hoàn chỉnh sẵn sàng thực thi trực tiếp trên Neon PostgreSQL:
`database/schema.sql`

File dữ liệu khởi tạo mẫu:
`database/seeds.sql`

---

## 🔒 Kiểm Tra & Kiểm Toán Bảo Mật

- [x] Không lưu trữ token hoặc mật khẩu trong `localStorage` / `sessionStorage`.
- [x] Sử dụng `HTTP-only`, `SameSite=Lax/Strict`, `Secure` cookies cho cả phiên Admin và Tenant.
- [x] Mật khẩu được băm bằng `bcrypt`/`Argon2` với salt rounds an toàn.
- [x] Chống SQL Injection bằng câu lệnh tham số hóa 100% trên `pg`.
- [x] Giới hạn tần suất gọi API (Rate limiting) cho endpoint đăng nhập và gửi mã OTP.
- [x] Bảo vệ tính bất biến của hợp đồng bằng trigger cơ sở dữ liệu `trg_enforce_contract_immutability`.
- [x] Mã băm mật mã học SHA-256 bảo vệ tính toàn vẹn của tệp PDF đã ký.
- [x] Kiểm tra phân quyền sở hữu chặt chẽ: Khách thuê A không bao giờ xem được dữ liệu của Khách thuê B.
