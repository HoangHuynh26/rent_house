# Hướng Dẫn Triển Khai Public Toàn Diện: Backend (Render) & Frontend (Netlify / Render) - Không Dùng Nginx

Hệ thống được thiết kế theo kiến trúc hiện đại, linh hoạt, **hoàn toàn loại bỏ Nginx**:
- **Frontend**: Triển khai trên **Netlify CDN** (hoặc Render Static Site) - tải siêu nhanh, hỗ trợ SPA rewrite tự động.
- **Backend**: Triển khai trên **Render Web Service** (Node.js Express API) kết nối cơ sở dữ liệu đám mây **Neon PostgreSQL**.
- **Không dùng Nginx**: Frontend phục vụ file tĩnh trực tiếp qua CDN Netlify hoặc Node.js server (`serve`), cấu hình nhẹ nhàng, không lo bảo trì web server Nginx.

---

## ⚠️ QUAN TRỌNG: Khắc phục lỗi Render chạy ở chế độ "in_memory"

Nếu bạn kiểm tra link `https://rent-house-3jm7.onrender.com/health` mà thấy:
```json
"database": { "connected": false, "mode": "in_memory" }
```
**Nguyên nhân:** Trên Render Dashboard, biến `DATABASE_URL` chưa được lưu giá trị kết nối thực tế tới Neon DB.

**Cách kích hoạt kết nối Neon PostgreSQL trên Render (chỉ mất 30 giây):**
1. Mở [Render Dashboard](https://dashboard.render.com).
2. Bấm vào Web Service Backend của bạn (ví dụ: `rent-house-3jm7` hoặc `nhatrothanhtam-backend`).
3. Chọn mục **Environment** ở menu bên trái.
4. Kiểm tra và thêm / cập nhật biến:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://neondb_owner:npg_bgpEdnH4Q5XK@ep-soft-unit-ayxcyazu-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
5. Nhấn **Save Changes**. Render sẽ tự động redeploy trong 1 phút.
6. Mở lại link `https://rent-house-3jm7.onrender.com/health`, bạn sẽ thấy:
   ```json
   "database": { "connected": true, "mode": "neon_postgresql", "active_rooms": 5 }
   ```

---

## BẢNG BIẾN MÔI TRƯỜNG ĐẦY ĐỦ TRÊN RENDER BACKEND

Vào **Render Dashboard** → Web Service Backend → **Environment** và đảm bảo các biến sau:

| Tên biến (Key) | Giá trị (Value) | Giải thích |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_bgpEdnH4Q5XK@ep-soft-unit-ayxcyazu-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Chuỗi kết nối Neon DB |
| `SESSION_SECRET` | `super_secure_rental_session_secret_key_2026_jwt_or_cookie` | Khóa bảo mật phiên |
| `ADMIN_COOKIE_SECRET` | `admin_secret_key_long_and_cryptographically_strong_random_hash` | Khóa mã hóa Cookie |
| `NODE_ENV` | `production` | Chạy chế độ Production tối ưu |
| `FRONTEND_URL` | `https://nhatrothanhtam.netlify.app` | Cho phép CORS từ Frontend Netlify |
| `ALLOWED_ORIGINS` | `https://nhatrothanhtam.netlify.app,http://localhost:5173,http://localhost:3000` | Danh sách domain được phép gọi API |
| `COOKIE_SAMESITE` | `none` | Bắt buộc để nhận Cookie khi khác domain |
| `COOKIE_SECURE` | `true` | Yêu cầu HTTPS cho Cookie Cross-Site |
| `AI_SERVICE_URL` | `http://localhost:8000` *(hoặc link AI service nếu có)* | Backend có OCR Tesseract tự động dự phòng |

---

## BƯỚC 2: Triển khai Frontend lên Netlify (Public CDN)

1. **Biến môi trường trên Netlify Dashboard**:
   - Vào [Netlify Console](https://app.netlify.com) → Chọn site `nhatrothanhtam`
   - Vào **Site configuration** → **Environment variables**
   - Đặt biến:
     - `VITE_API_URL`: `https://rent-house-3jm7.onrender.com/api` (hoặc `/api` nếu dùng Netlify reverse proxy).
2. **Build và Deploy**:
   - Chạy lệnh build trên máy tính:
     ```powershell
     npm run build --workspace=rent-house-frontend
     ```
   - Kéo thả thư mục `frontend/dist` vào tab **Deploys** trên Netlify, hoặc commit Git để Netlify tự động build.
3. **Mở khóa truy cập (Tránh 401)**:
   - Netlify Dashboard → Site **nhatrothanhtam** → **Site configuration** → **Access management** → **Visitor access** → Chọn **Public**.

---

## BƯỚC 3: Cơ chế Xác thực Kép (Cookie + Fallback Header)

Hệ thống đã được lập trình sẵn cơ chế tự thích ứng:
1. **Trình duyệt thông thường (Desktop Chrome, Firefox, Edge)**:
   - Sử dụng HTTP-Only Cookie an toàn `SameSite=None; Secure`.
2. **Trình duyệt di động hoặc chặn Cookie bên thứ ba (iOS Safari, Incognito, WebView)**:
   - Frontend tự động gắn header `x-admin-session` và `x-tenant-session` qua interceptor Axios.
   - Backend chấp nhận cả 2 phương thức, đảm bảo đăng nhập người thuê phòng và quản trị viên **không bao giờ bị văng session**.

---

## TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH

- **Khách thuê phòng 1**:
  - URL: `https://nhatrothanhtam.netlify.app/tenant/login`
  - Số điện thoại: `0912345678` (Nguyễn Văn An - Phòng 1)
- **Quản trị viên (Admin)**:
  - URL: `https://nhatrothanhtam.netlify.app/admin/login`
  - Username: `admin`
  - Mật khẩu: `Admin@123456`
