const config = require('./config');
const { buildApp } = require('./app');

const app = buildApp();
const server = app.listen(config.port, () => console.log(`[gateway] listening on :${config.port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);