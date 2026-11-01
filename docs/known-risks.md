# Rủi ro và giới hạn đã biết

## Dữ liệu và nhất quán
- **Auth: ghi kép (DB rồi Kafka).** Lưu User rồi mới phát `user-registered`, không cùng transaction. Nếu Kafka lỗi, user tồn tại nhưng chưa có hồ sơ Customer. Giảm thiểu: `GetMembership` tự tạo hồ sơ mặc định khi cần.
- **Order: giữ kho không bền.** Kho bị trừ ở Product Service trước khi đơn được lưu. Nếu Order Service chết giữa hai bước đó, kho vẫn bị trừ mà không có đơn. Hướng cho sản xuất: giữ chỗ có thời hạn hoặc saga có trạng thái lưu bền.
- **Product: không có transaction đa sản phẩm.** MongoDB chạy standalone (không replica set), nên `ReserveStock` nhiều sản phẩm hoàn lại thủ công; nếu việc hoàn lại cũng lỗi thì kho giữ nguyên bị giảm (có ghi log).
- **`ReleaseStock` không idempotent:** gọi hai lần sẽ cộng kho hai lần. Order Service chỉ gọi tối đa một lần cho mỗi đơn lỗi.
- **Outbox: giao nhận ít nhất một lần.** Nếu sập sau khi Kafka nhận event nhưng trước khi đặt `publishedAt`, event được gửi lại; Shipment khử trùng. Publisher giả định chỉ một bản Order Service; nhiều bản cần `SELECT ... FOR UPDATE SKIP LOCKED`.

## Bảo mật
- **JWT HS256 dùng khóa chung, không thu hồi được.** Không có đăng xuất hay thu hồi; token có hiệu lực đến khi hết hạn (1 giờ).
- **Redis hỏng thì "mở" (fail-open):** cache và giới hạn tốc độ tắt, tức là bảo vệ chống dò mật khẩu cũng tắt trong lúc đó.
- **Giới hạn tốc độ theo IP.** Nếu sau này đặt reverse proxy hoặc load balancer trước Gateway thì phải cấu hình `trust proxy`, nếu không mọi người dùng cùng một IP.
- **gRPC nội bộ không dùng TLS, hạ tầng không xác thực.** MongoDB, Redis, Kafka không có xác thực; gRPC dùng kênh không mã hóa. Chấp nhận được vì `docker-compose.yml` chỉ công bố cổng 3000; `docker-compose.dev-ports.yml` mở các cổng còn lại chỉ để kiểm thử trên máy phát triển và không được dùng cho triển khai thật.
- **Tài khoản mặc định.** `admin` và `staff` được seed từ `.env` với mật khẩu do người triển khai chọn; phải đặt mật khẩu mạnh, khác mẫu, cho mọi triển khai ngoài máy phát triển.

## Vận hành
- **Cache có thể cũ tối đa 15 giây.** Cache-aside có thể nạp lại giá trị cũ nếu một lần đọc xen vào giữa lúc ghi và lúc xóa cache; thời hạn 15 giây giới hạn độ cũ. Đơn hàng luôn kiểm tra tồn kho thật.
- **Phạm vi health check.** `/api/health` kiểm tra Redis và trạng thái 5 kênh gRPC; không kiểm tra CSDL hay kết nối Kafka của từng service.
- **Kafka báo `healthy` trước khi sẵn sàng hoàn toàn.** Consumer (Customer, Shipment) và producer (Auth, Order) thử lại khi khởi động thay vì thoát; đã kiểm tra bằng `cold-start-test.ps1`.
- **Kiểm thử là smoke test chạy trên hệ thống thật**, không phải unit test, và chưa có CI tự động.

## Phụ thuộc
- Kết quả `npm audit --omit=dev` ghi nhận ngày **01/11/2026**:
  - api-gateway: 0 vulnerabilities
  - auth-service: 3 high severity vulnerabilities (từ dependency deepmerge-ts của Prisma)
  - customer-service: 3 high severity vulnerabilities (từ dependency deepmerge-ts của Prisma)
  - product-service: 0 vulnerabilities
  - order-service: 3 high severity vulnerabilities (từ dependency deepmerge-ts của Prisma)
  - shipment-service: 0 vulnerabilities