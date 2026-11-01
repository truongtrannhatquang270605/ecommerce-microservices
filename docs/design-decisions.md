# Quyết định thiết kế và giả định

Tài liệu yêu cầu không nêu rõ một số điểm; các quyết định dưới đây là giả định của dự án.

## Kiến trúc
1. Client chỉ nói REST với API Gateway. Gateway nói gRPC với 5 service. Service nói chuyện với nhau bằng gRPC (đồng bộ) hoặc Kafka (bất đồng bộ). Khi chạy bằng Docker Compose chỉ cổng 3000 của Gateway được mở ra máy chủ.
2. Database-per-Service: Auth, Customer, Order dùng PostgreSQL riêng; Product, Shipment dùng MongoDB riêng; Gateway dùng Redis. Không có khóa ngoại giữa các CSDL: `Order.uid` và `Shipment.oid` là tham chiếu logic.
3. Mỗi bounded context có file `.proto` riêng trong `shared/proto`. Trường kiểu số nguyên là `int32`; giá trị như 1.5 bị cắt thành 1 trước khi tới service, nên Gateway từ chối số không nguyên (400) trước khi gọi gRPC.

## Dữ liệu và nghiệp vụ
4. ERD gộp được tách theo bounded context: `User` (Auth) không có `fullname`; `fullname` và `mid` thuộc `Customer` (Customer Service).
5. `email` của User là tùy chọn (TC-IAM-01 chỉ cần username và password). Đăng ký công khai luôn tạo role `member`; `admin` và `shipment_staff` được seed từ biến môi trường.
6. `score` thuộc bảng `MemberShip` (theo hạng), không thuộc từng khách. Hạng seed: Standard 0, Silver 100, Gold 500, Platinum 1000.
7. Discount là phần trăm: score < 100 → 0%; 100–499 → 5%; 500–999 → 10%; từ 1000 → 15%. Tài liệu không định nghĩa bảng này nên đây là giả định. `total_amount = tổng(qty × unit_price) × (1 − discount/100)`, tính bằng cent (số nguyên) để tránh sai số số thực, làm tròn 2 chữ số.
8. Giá lấy từ Product Service lúc đặt hàng và chốt vào `OrderDetail.unit_price`; không tin giá từ client. `uid` của đơn lấy từ JWT, không lấy từ body.
9. `POST /api/orders` trả `shipment: {status: "PENDING"}` không có `shipid`, vì Shipment được tạo bất đồng bộ từ event. `GET /api/orders/:oid` ghép thêm `shipid` và trạng thái từ Shipment Service.
10. `GetMembership` tự tạo hồ sơ mặc định nếu thiếu (bù cho event `user-registered` bị mất); `GetCustomer` thì không (TC-CUS-02 yêu cầu 404).
11. Chỉ `admin` được đổi `mid` của khách; nếu không, khách có thể tự nâng lên hạng giảm giá cao hơn.
12. Trạng thái giao hàng: PENDING → SHIPPING → DELIVERED, và CANCELLED từ PENDING hoặc SHIPPING. Không nhảy cóc, không quay lui, DELIVERED và CANCELLED là trạng thái cuối. Gửi lại đúng trạng thái hiện tại được chấp nhận (idempotent).
13. Shipment không lưu `uid`. Khi khách xem shipment, Gateway hỏi Order Service (`GetOrder`) để xác nhận khách là chủ đơn. `admin` và `shipment_staff` không bị kiểm tra này.

## Độ tin cậy
14. Transactional Outbox: Order, OrderDetail và OutboxEvent được lưu trong cùng một transaction; một tiến trình nền gửi event sang Kafka rồi đánh dấu `publishedAt`. Việc gửi là "ít nhất một lần", nên consumer phải idempotent (Shipment dùng `UNIQUE(oid)`).
15. Đặt hàng: lấy hạng thành viên trước (chưa có tác dụng phụ), rồi trừ kho (`ReserveStock`, nguyên tử theo từng sản phẩm), rồi lưu đơn. Nếu lưu đơn lỗi thì gọi `ReleaseStock` để hoàn kho. Nếu một sản phẩm trong đơn thiếu hàng thì các sản phẩm đã trừ trước đó được hoàn lại.
16. Event hỏng (thiếu `oid`, JSON sai) được ghi vào `invalid_events` và bỏ qua để không chặn hàng đợi; lỗi hạ tầng thì ném lỗi để thử lại.

## Gateway
17. JWT ký HS256 bằng khóa chung giữa Auth và Gateway; Gateway tự xác thực, ép thuật toán HS256. Danh tính (uid, role) chỉ lấy từ token.
18. Phân quyền hai lớp: Gateway chặn thô theo vai trò; các service tự kiểm tra lại quyền sở hữu qua `requester_uid` và `requester_role`.
19. `GET /api/customers/:uid` chỉ cho chính chủ hoặc admin (thêm mã 403 ngoài đặc tả); response có thêm `mname` và `score`.
20. `PUT /api/products/:pid` dùng `update_mask` để sửa một phần mà không ghi đè tồn kho vừa bị đơn hàng thay đổi.
21. Cache Redis cho `GET /api/products` và `/:pid` (15 giây), xóa khi sản phẩm đổi hoặc khi có đơn hàng thành công. Không cache dữ liệu theo người dùng (đơn hàng, khách hàng).
22. Giới hạn tốc độ: 200 request/phút/IP cho `/api`, 10 request/phút/IP cho `/api/auth`, lưu bộ đếm trong Redis. Redis hỏng thì Gateway mở (không cache, không giới hạn) và `/api/health` trả 503.
23. Định dạng response bám đặc tả: `accessToken`, `tokenType`, `expiresIn` (camelCase) ở đăng nhập, `unit_price` (snake_case) ở chi tiết đơn.

## Kiểm thử
24. Kiểm thử là smoke test chạy trên hệ thống đang chạy (không phải unit test). `generate-test-report.ps1` ánh xạ các check sang 25 test case; mỗi test case cần bằng chứng ở cả tầng service và tầng Gateway khi áp dụng.