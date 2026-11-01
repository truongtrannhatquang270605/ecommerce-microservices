# Sự kiện Kafka

Broker: Kafka (KRaft, một node). Trong mạng Docker: `kafka:9092`. Từ máy phát triển (qua `docker-compose.dev-ports.yml`): `localhost:29092`.

## Topic `user-registered`

- Producer: auth-service (sau khi lưu User thành công)
- Consumer: customer-service, consumer group `customer-service`
- Key: `uid`

```json
{ "eventId": "uuid", "uid": 1, "username": "john", "fullname": "john", "occurredAt": "2026-01-01T00:00:00.000Z" }
```

Customer Service tạo hồ sơ khách hàng với hạng có `score` thấp nhất. Xử lý idempotent: nhận lại cùng `uid` không tạo bản ghi mới.

## Topic `order-created`

- Producer: order-service, qua bảng `OutboxEvent` (Transactional Outbox)
- Consumer: shipment-service, consumer group `shipment-service`
- Key: `oid`

```json
{ "eventId": "uuid", "oid": 1001, "uid": 1, "occurredAt": "2026-01-01T00:00:00.000Z" }
```

Shipment Service tạo shipment `PENDING` cho `oid`. Xử lý idempotent nhờ chỉ mục `UNIQUE(oid)`.

## Quy tắc

- Giao nhận "ít nhất một lần": consumer phải idempotent (khử trùng theo `uid` hoặc `oid`).
- Consumer đọc từ đầu topic (`fromBeginning`) khi chưa có offset; sau đó tiếp tục từ offset đã lưu của nhóm.
- Event không hợp lệ: Shipment ghi vào collection `invalid_events` rồi bỏ qua; Customer ghi log rồi bỏ qua. Lỗi hạ tầng (ví dụ CSDL tạm thời không truy cập được) không bị bỏ qua mà được thử lại.
- Producer và consumer thử kết nối lại khi Kafka chưa sẵn sàng lúc khởi động.