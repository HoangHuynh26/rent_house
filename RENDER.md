# Hướng Dẫn Triển Khai: Backend + AI Service (Render) & Frontend (Netlify)

Hệ thống được thiết kế linh hoạt:
- **Frontend**: Triển khai trên Netlify CDN (tốc độ cao, không bao giờ nghẽn).
- **Backend**: Triển khai trên Render Web Service (Node.js).
- **AI Service**: Có thể chạy đồng thời trên **Render (Public)** và **Máy tính của bạn (Local)**!

---

## 🤖 Cách AI Service hoạt động ĐỒNG THỜI trên Public và Local

Backend Node.js được tích hợp cơ chế tự động tìm kiếm AI thông minh:
1. **Khi chạy Public (trên Render)**: Backend gọi trực tiếp link AI trên Render (ví dụ `https://nhatrothanhtam-ai.onrender.com`).
2. **Khi chạy Local (trên máy bạn)**: Backend trong máy bạn có thể kết nối thẳng vào link AI public trên Render mà **không cần cài Python trong máy tính**! Nếu máy bạn có bật Python local (`http://localhost:8000`), backend sẽ ưu tiên local.
3. **Cơ chế dự phòng an toàn (Fallback)**: Kể cả khi AI Service chưa bật hoặc mạng chập chờn, backend tự động chuyển sang bộ nhận diện OCR Tesseract & Perceptual Hash tích hợp sẵn trong Node.js, đảm bảo **không bao giờ bị lỗi hay dừng hệ thống**!

---

## BƯỚC 1: Triển khai Backend lên Render (https://render.com)

1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com).
2. Nhấn nút **New +** → chọn **Web Service**.
3. Chọn kho lưu trữ GitHub: **`HoangHuynh26/rent_house`**.
4. Cấu hình:
   - **Name**: `nhatrothanhtam-backend`
   - **Language / Runtime**: `Node`
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Thêm các **Environment Variables**:

| Key (Tên biến) | Value (Giá trị) |
| :--- | :--- |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_bgpEdnH4Q5XK@ep-soft-unit-ayxcyazu-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `SESSION_SECRET` | `super_secure_rental_session_secret_key_2026_jwt_or_cookie` |
| `ADMIN_COOKIE_SECRET` | `admin_secret_key_long_and_cryptographically_strong_random_hash` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://nhatrothanhtam.netlify.app` |
| `COOKIE_SAMESITE` | `none` |
| `COOKIE_SECURE` | `true` |
| `AI_SERVICE_URL` | `https://nhatrothanhtam-ai.onrender.com` *(nếu tạo thêm service AI ở Bước 1.1)* |

6. Bấm **Create Web Service** → Khi hoàn tất, bạn có link backend: `https://nhatrothanhtam-backend.onrender.com`.

---

## BƯỚC 1.1: Triển khai Python AI Service lên Render (Tùy chọn)

Nếu bạn muốn có một server Python OpenCV riêng trên Cloud để phục vụ phân tích ảnh công tơ:
1. Trên Render Dashboard, bấm **New +** → chọn **Web Service**.
2. Chọn repo: **`HoangHuynh26/rent_house`**.
3. Cấu hình:
   - **Name**: `nhatrothanhtam-ai`
   - **Language / Runtime**: `Python`
   - **Root Directory**: `ai-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free**
4. Bấm **Create Web Service** → Khi xong bạn sẽ có link: `https://nhatrothanhtam-ai.onrender.com`.
5. **Cách dùng cho cả Public lẫn Local**:
   - Gắn link `https://nhatrothanhtam-ai.onrender.com` vào biến `AI_SERVICE_URL` trên Render Backend.
   - Gắn link `AI_SERVICE_URL=https://nhatrothanhtam-ai.onrender.com` vào file `.env` trên máy bạn. Lúc này, backend ở máy tính của bạn cũng sẽ sử dụng được AI trên cloud mà không cần cài đặt Python!

---

## BƯỚC 2: Kết nối Frontend trên Netlify

1. Trong file `.env` trên máy bạn, cập nhật:
   ```env
   VITE_API_URL=https://nhatrothanhtam-backend.onrender.com/api
   ```
2. Chạy lệnh build:
   ```powershell
   npm run build --workspace=rent-house-frontend
   ```
3. Kéo thả thư mục `frontend/dist` lên Netlify Deploys (hoặc để Netlify tự build qua GitHub).

---

## BƯỚC 3: Mở khóa quyền truy cập Netlify (Tránh lỗi 401)
1. Netlify Dashboard → Site **nhatrothanhtam** → **Site configuration** → **Access management** → **Visitor access**.
2. Chuyển sang **Public**.
