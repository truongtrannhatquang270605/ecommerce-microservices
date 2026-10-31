require('dotenv').config();
const path = require('path');

module.exports = {
    grpcPort: process.env.GRPC_PORT || '50055',
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27019/shipment_db',
    kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    kafkaGroupId: process.env.KAFKA_GROUP_ID || 'shipment-service',
    protoDir: process.env.PROTO_DIR || path.join(__dirname, '..', '..', '..', 'shared', 'proto'),
};