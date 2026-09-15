# Hướng Dẫn Tách Triển Khai: Backend (Render) + Frontend (Netlify)

Mô hình này là mô hình chuẩn mực và ổn định nhất:
- **Backend**: Chạy liên tục trên Render (hỗ trợ đầy đủ Node.js, AI OCR, sharp, tự động tạo hóa đơn ngày 10 hàng tháng và kết nối Neon PostgreSQL).
- **Frontend**: Chạy siêu tốc độ trên Netlify CDN dưới dạng Single Page Application (React Vite).

---

## BƯỚC 1: Triển khai Backend lên Render (https://render.com)

1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com).
2. Nhấn nút **New +** ở góc trên cùng bên phải → chọn **Web Service**.
3. Kết nối với kho lưu trữ GitHub của bạn chứa project này.
4. Điền các thông số cấu hình như sau:
   - **Name**: `nhatrothanhtam-backend` (hoặc tên tùy bạn thích)
   - **Language / Runtime**: `Node`
   - **Branch**: `main` (hoặc `master`)
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Chọn gói **Free**

5. Kéo xuống mục **Environment Variables** (Biến môi trường) và thêm các biến:

| Key (Tên biến) | Value (Giá trị) |
| :--- | :--- |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_bgpEdnH4Q5XK@ep-soft-unit-ayxcyazu-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `SESSION_SECRET` | `super_secure_rental_session_secret_key_2026_jwt_or_cookie` |
| `ADMIN_COOKIE_SECRET` | `admin_secret_key_long_and_cryptographically_strong_random_hash` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://nhatrothanhtam.netlify.app` |
| `COOKIE_SAMESITE` | `none` |
| `COOKIE_SECURE` | `true` |

6. Bấm **Deploy Web Service** và chờ Render triển khai trong khoảng 2-3 phút.
7. Khi Render báo **Live**, bạn sẽ nhận được đường link API của mình, có dạng:
   👉 `https://nhatrothanhtam-backend.onrender.com`

---

## BƯỚC 2: Kết nối Frontend trên Netlify với Backend Render

Sau khi đã có link Render từ Bước 1:

### Lựa chọn A: Nếu bạn kéo thả thư mục thủ công lên Netlify (Netlify Drop)
1. Mở file `.env` ở thư mục gốc `c:\rent_house\.env`:
   Sửa dòng:
   ```env
   VITE_API_URL=https://nhatrothanhtam-backend.onrender.com/api
   ```
   *(Thay bằng link Render thực tế của bạn, nhớ có đuôi `/api`)*
2. Mở terminal và chạy lệnh build frontend:
   ```powershell
   npm run build --workspace=rent-house-frontend
   ```
3. Kéo thả toàn bộ thư mục **`c:\rent_house\frontend\dist`** lên trang Netlify Deploys của bạn.

### Lựa chọn B: Nếu Netlify tự động build qua GitHub
1. Vào Netlify Dashboard → chọn trang **nhatrothanhtam**.
2. Vào **Site configuration** → **Environment variables**.
3. Thêm biến:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://nhatrothanhtam-backend.onrender.com/api`
4. Vào tab **Deploys** → bấm **Trigger deploy** → **Deploy site**.

---

## BƯỚC 3: Mở khóa quyền truy cập trên Netlify (Khắc phục lỗi 401)

1. Trong Netlify Dashboard, vào **Site configuration** → **Access management** → **Visitor access**.
2. Chuyển chế độ sang **Public** (Không cài Password / Team protection) để khách thuê và quản trị viên có thể truy cập tự do từ điện thoại và máy tính.
