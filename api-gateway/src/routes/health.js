const router = require('express').Router();
const { isReady, names } = require('../clients/grpcClients');

router.get('/', async (req, res) => {
    const checks = await Promise.all(names.map((n) => isReady(n, 1000)));

    if (checks.every(Boolean)) {
        return res.json({ status: 'UP', message: 'E-commerce API is running' });
    }
    const dependencies = Object.fromEntries(names.map((n, i) => [n, checks[i] ? 'UP' : 'DOWN']));
    res.status(503).json({ status: 'DOWN', message: 'A required dependency is unhealthy', dependencies });
});

module.exports = router;