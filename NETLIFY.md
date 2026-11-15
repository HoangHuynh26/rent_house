# Hướng Dẫn Triển Khai Toàn Bộ Frontend & Backend Trên Netlify (Netlify Functions + Neon PostgreSQL)

Hệ thống Nhà Trọ Thanh Tâm chạy toàn bộ Frontend React (Vite) và Backend Express API trực tiếp trên **Netlify** thông qua **Netlify Serverless Functions** (`backend/netlify/functions/api.mjs` và cron tự động lập hóa đơn `monthly-billing.mjs`), kết nối cơ sở dữ liệu đám mây **Neon PostgreSQL**. Mọi ảnh công tơ được lưu nhị phân trực tiếp trong Neon PostgreSQL (`meter_images`) nên không phụ thuộc bộ nhớ tạm serverless.

---

## 1. Cấu hình biến môi trường trên Netlify Dashboard (BẮT BUỘC)

Để Netlify Functions kết nối được cơ sở dữ liệu Neon PostgreSQL và xử lý đăng nhập, bạn cần thêm các biến môi trường vào Netlify:

1. Mở [Netlify Console](https://app.netlify.com).
2. Chọn trang: **nhatrothanhtam** (hoặc `nhatrothanhtam.netlify.app`).
3. Vào **Site configuration** → **Environment variables** (Biến môi trường).
4. Thêm các biến sau:

| Tên biến (Key) | Giá trị (Value) | Ghi chú |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_bgpEdnH4Q5XK@ep-soft-unit-ayxcyazu-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Kết nối Neon DB |
| `SESSION_SECRET` | `super_secure_rental_session_secret_key_2026_jwt_or_cookie` | Khóa bảo mật phiên |
| `ADMIN_COOKIE_SECRET` | `admin_secret_key_long_and_cryptographically_strong_random_hash` | Khóa cookie Admin |
| `NODE_ENV` | `production` | Môi trường production |
| `FRONTEND_URL` | `https://nhatrothanhtam.netlify.app` | Domain Netlify |

*(Lưu ý: Không cần đặt `VITE_API_URL` hoặc đặt là `/api` vì API chạy chung domain).*

---

## 2. Cấu hình Build & Deploy trên Netlify

Kiểm tra **Build settings** trong Netlify Site configuration để deploy đồng bộ cả Frontend lẫn Backend Functions từ [`netlify.toml`](netlify.toml):
- **Base directory**: để trống (thư mục gốc repo `.`)
- **Build command**: `npm run build`
- **Publish directory**: `frontend/dist`
- **Functions directory**: `backend/netlify/functions` (tự động đọc từ `netlify.toml`)

Sau khi lưu các biến môi trường:
1. Vào tab **Deploys** trên Netlify.
2. Bấm vào nút **Trigger deploy** → chọn **Deploy site** (hoặc `git push` nếu dự án liên kết với GitHub).
3. Chờ quá trình build hoàn tất (khoảng 1 phút).

---

## 3. Thông tin Đăng nhập Khách Thuê Phòng 1

Khi mở trang `https://nhatrothanhtam.netlify.app/tenant/login`:
- **Số điện thoại**: `0912345678`
- **Tên người thuê**: Nguyễn Văn An
- **Phòng**: Phòng 1
- Bấm **Đăng nhập** để vào trực tiếp trang Quản lý Người thuê Phòng 1 (Hợp đồng, Số điện, Số nước 12.000đ/m3, Hóa đơn).

---

## 4. Thông tin Đăng nhập Quản Trị Viên (Admin)

Khi mở trang `https://nhatrothanhtam.netlify.app/admin/login`:
- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `Admin@123456`
