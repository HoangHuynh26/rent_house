# 🏠 Rental House Management System (Hệ Thống Quản Lý Nhà Trọ)

Hệ thống quản lý nhà trọ, phòng trọ, khách thuê, chỉ số điện nước, phân tích ảnh đồng hồ bằng trí tuệ nhân tạo (AI OCR cục bộ), lập hóa đơn tự động và ký kết hợp đồng điện tử bất biến bảo mật cao.

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
- **Đo điện nước & AI OCR tự động**:
  - Tải ảnh đồng hồ điện/nước lên hệ thống.
  - Phân tích chất lượng ảnh: Tự động cảnh báo ảnh mờ (Laplacian variance), ảnh quá tối, ảnh chói sáng hoặc sai độ phân giải.
  - Tự động nhận diện chữ số chỉ số trên mặt đồng hồ với độ tin cậy (confidence score).
  - Cảnh báo bất thường nếu chỉ số mới thấp hơn chỉ số cũ hoặc tăng vọt đột biến.
  - **Quy trình duyệt Human-In-The-Loop**: Chủ nhà đối chiếu ảnh thực tế và số AI đọc được song song, phê duyệt 1 chạm hoặc điều chỉnh số liệu trước khi chính thức ghi nhận.
  - Tự động ghi nhận mẫu dữ liệu chuẩn vào tập dữ liệu huấn luyện AI (`ai_training_samples`).
- **Lập hóa đơn tự động 1 chạm**:
  - Tự động tập hợp tiền phòng + tiền điện + tiền nước + phí dịch vụ - giảm trừ cho các phòng đang thuê.
  - Chốt đơn giá tại thời điểm lập (snapshot pricing) để hóa đơn lịch sử không bao giờ bị sai lệch khi giá điện nước thay đổi trong tương lai.
  - Tự động gửi thông báo trong ứng dụng đến khách thuê.
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
| **Backend** | Node.js (v20+), Express.js, `pg` (PostgreSQL Client), Argon2 / bcryptjs, Cookie-Parser, Helmet, Multer, PDFKit |
| **Database** | Neon Serverless PostgreSQL 16+ (Normalized, UUIDs, Triggers, Indexes, Constraints) |
| **AI OCR Service** | Python 3.11+, FastAPI, OpenCV, NumPy, Pillow (100% Self-Hosted, Không phụ thuộc bên ngoài) |
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

#### 3. Khởi động AI Microservice (Tùy chọn)
```bash
cd ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```
Dịch vụ AI cục bộ sẽ chạy tại: `http://localhost:8000`
*(Lưu ý: Nếu không bật AI Service, Backend tự động kích hoạt bộ xử lý thị giác máy tính dự phòng để ứng dụng không bao giờ bị gián đoạn).*

---

### Cách 2: Chạy toàn bộ hệ thống bằng Docker Compose

```bash
docker-compose up --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000`
- AI Microservice: `http://localhost:8000`
- Database: Kết nối trực tiếp máy chủ đám mây **Neon PostgreSQL** (không cần container PostgreSQL cục bộ)

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
