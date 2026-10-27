# 📱 Hướng Dẫn Cài Đặt & Sử Dụng Ứng Dụng Di Động (Android & iOS)

Hệ thống quản lý nhà trọ **Nhà Trọ Thông Minh - Thanh Tâm** đã được tích hợp đầy đủ phiên bản ứng dụng di động gốc (**Native Mobile App**) cho cả 2 hệ điều hành **Android** và **iOS**, cùng với phiên bản **PWA (Progressive Web App)** cài đặt tức thì.

---

## 📦 1. Tệp Cài Đặt Android (File APK Đã Biên Dịch Sẵn)

File APK đã được biên dịch thành công từ mã nguồn gốc và sẵn sàng cài đặt ngay lên điện thoại/máy tính bảng Android:

- **Đường dẫn file APK**: [`dist-mobile/NhaTroThanhTam-v1.0.0.apk`](file:///c:/rent_house/dist-mobile/NhaTroThanhTam-v1.0.0.apk)
- **Dung lượng**: ~12 MB
- **Phiên bản Android hỗ trợ**: Android 7.0 (API 24) đến Android 16 (API 36)
- **Tên hiển thị trên điện thoại**: **Nhà Trọ Thông Minh**
- **Biểu tượng (Icon)**: Ngôi nhà 3D isometric công tơ điện nước phát sáng sắc nét cao.

### Cách cài đặt lên điện thoại Android:
1. **Cách 1 (Qua dây cáp hoặc ADB)**:
   - Cắm điện thoại vào máy tính qua cáp USB và bật chế độ *Chuyển tệp (File Transfer)*.
   - Chép file `NhaTroThanhTam-v1.0.0.apk` vào thư mục *Download* của điện thoại.
   - Trên điện thoại, mở ứng dụng **Tệp (Files)** > bấm vào `NhaTroThanhTam-v1.0.0.apk` > chọn **Cài đặt**.
2. **Cách 2 (Gửi qua Zalo / Google Drive / Telegram)**:
   - Tải file `NhaTroThanhTam-v1.0.0.apk` lên Google Drive hoặc gửi qua Zalo File.
   - Mở trên điện thoại và bấm cài đặt (cho phép "Cài đặt ứng dụng từ nguồn không xác định" nếu máy hỏi).
3. **Lệnh biên dịch lại APK bất kỳ lúc nào**:
   - Chạy file: [`build-android-apk.bat`](file:///c:/rent_house/build-android-apk.bat)
   - Hoặc gõ lệnh: `npm run mobile:build`

---

## 🍏 2. Phiên Bản iOS (Dành Cho iPhone & iPad)

Dự án iOS đã được tạo và cấu hình đầy đủ bằng mã nguồn gốc Xcode và Swift Package Manager tại thư mục:
- **Thư mục dự án iOS**: [`frontend/ios/App`](file:///c:/rent_house/frontend/ios/App)
- **File mở dự án**: `frontend/ios/App/App.xcodeproj`

### A. Mở và biên dịch bằng Xcode (Trên máy Mac):
```bash
# Mở trực tiếp dự án trong Xcode
npm run mobile:ios
```
1. Mở file `frontend/ios/App/App.xcodeproj` trong Xcode.
2. Chọn thiết bị đích (iPhone thật hoặc iOS Simulator).
3. Đăng nhập tài khoản Apple ID tại tab *Signing & Capabilities*.
4. Bấm **Run (Cmd + R)** để nạp trực tiếp vào iPhone, hoặc đóng gói file `.ipa` đưa lên TestFlight / App Store.

### B. Cài đặt trực tiếp ngay trên iPhone không cần Mac (Qua PWA Safari):
Dành cho người thuê phòng hoặc chủ nhà dùng iPhone muốn dùng ngay mà không cần mở máy tính:
1. Mở trình duyệt **Safari** trên iPhone và truy cập: `https://nhatrothanhtam.netlify.app`
2. Bấm vào nút **Chia sẻ** (biểu tượng hình vuông có mũi tên chỉ lên ở giữa thanh công cụ Safari).
3. Cuộn xuống và chọn **"Thêm vào Màn hình chính" (Add to Home Screen)**.
4. Đổi tên thành **"Nhà Trọ"** và bấm **Thêm**.
5. Ứng dụng sẽ xuất hiện trên màn hình chính iPhone với icon riêng biệt, chạy toàn màn hình (không có thanh địa chỉ Safari), lưu session đăng nhập và tốc độ mở tức thì!

---

## 🛠️ 3. Các Tính Năng Di Động Được Tối Ưu

| Tính Năng | Chi Tiết Tối Ưu Trên Di Động |
|---|---|
| **Camera & Thư viện ảnh** | Tích hợp quyền máy ảnh gốc (`CAMERA`, `NSCameraUsageDescription`) để chụp đồng hồ điện nước trực tiếp phục vụ AI OCR. |
| **Ký hợp đồng cảm ứng** | Khung chữ ký số HTML5 Canvas hỗ trợ cảm ứng đa điểm, ngón tay hoặc bút cảm ứng Stylus cực nhạy. |
| **Giao diện thẻ thông minh** | Tự động chuyển toàn bộ bảng dữ liệu phức tạp thành các thẻ card trực quan trên màn hình nhỏ. |
| **Dock điều hướng Apple** | Thanh menu đáy *Liquid Glass Dock* nổi với hiệu ứng kính mờ frosted glass, cử chỉ vuốt mượt mà. |
| **Hỗ trợ Safe Area** | Tự động thụt lề an toàn (`env(safe-area-inset-top)` & `env(safe-area-inset-bottom)`) tương thích tai thỏ (Notch), Dynamic Island trên iPhone và thanh điều hướng cử chỉ Android. |
| **Nút Back phần cứng** | Hỗ trợ nút quay lại phần cứng trên Android: tự động quay lại trang trước hoặc thu nhỏ ứng dụng khi ở màn hình chính. |
| **Tự động kết nối Backend** | Khi chạy trong ứng dụng gốc di động, app tự động kết nối API đám mây `https://rent-house-3jm7.onrender.com/api` hoặc máy chủ tuỳ chọn. |

---

## ⚡ 4. Các Lệnh Hữu Ích

Từ thư mục gốc `c:\rent_house`:

```bash
# 1. Tự động biên dịch Web + Đồng bộ sang Android/iOS + Xuất APK
npm run mobile:build

# 2. Đồng bộ các thay đổi giao diện sang native app sau khi chỉnh sửa code
npm run mobile:sync

# 3. Mở dự án Android trong Android Studio
npm run mobile:android

# 4. Mở dự án iOS trong Xcode (trên macOS)
npm run mobile:ios
```
