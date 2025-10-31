// Carregar tracing primeiro
require('./tracing');

const express = require('express');
const pino = require('pino-http');
const apiRoutes = require('./routes/api');
const { loggingMiddleware } = require('./middleware/logging');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de logging estruturado
app.use(pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: ['headers.authorization', 'body.password'],
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
}));

// Configurar métricas Prometheus
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Métricas customizadas
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register]
});

// Métricas de negócio adicionais
const userActivityCounter = new client.Counter({
    name: 'user_activity_total',
    help: 'Total user activity events',
    labelNames: ['activity_type', 'endpoint'],
    registers: [register]
});

const apiEndpointUsage = new client.Counter({
    name: 'api_endpoint_usage_total',
    help: 'API endpoint usage count',
    labelNames: ['endpoint', 'method'],
    registers: [register]
});

const errorRatesByType = new client.Counter({
    name: 'error_rates_by_type_total',
    help: 'Error rates categorized by type',
    labelNames: ['error_type', 'endpoint', 'status_code'],
    registers: [register]
});

const activeConnections = new client.Gauge({
    name: 'active_connections_current',
    help: 'Current number of active connections',
    registers: [register]
});

// Métricas por status HTTP (percentual e contagem)
const httpStatusDistribution = new client.Counter({
    name: 'http_status_distribution_total',
    help: 'HTTP status code distribution',
    labelNames: ['status_code', 'status_class'],
    registers: [register]
});

// Histograma específico por endpoint para P50/P95
const endpointResponseTime = new client.Histogram({
    name: 'endpoint_response_time_seconds',
    help: 'Response time per endpoint in seconds',
    labelNames: ['endpoint', 'method'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register]
});

// Middleware para coletar métricas HTTP
app.use((req, res, next) => {
    const start = Date.now();

    // Incrementar conexões ativas
    activeConnections.inc();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path || req.url;
        const cleanRoute = route.replace(/\/:[^\/]+/g, '/:id'); // Normalizar rotas dinâmicas

        const labels = {
            method: req.method,
            route: cleanRoute,
            status_code: res.statusCode
        };

        // Métricas existentes
        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, duration);

        // Novas métricas de negócio
        apiEndpointUsage.inc({
            endpoint: cleanRoute,
            method: req.method
        });

        // Distribuição de status HTTP
        const statusClass = Math.floor(res.statusCode / 100) + 'xx';
        httpStatusDistribution.inc({
            status_code: res.statusCode.toString(),
            status_class: statusClass
        });

        // Response time por endpoint
        endpointResponseTime.observe({
            endpoint: cleanRoute,
            method: req.method
        }, duration);

        // Rastrear atividade do usuário
        if (req.originalUrl.includes('/api/')) {
            userActivityCounter.inc({
                activity_type: 'api_call',
                endpoint: cleanRoute
            });
        }

        // Rastrear erros por tipo
        if (res.statusCode >= 400) {
            let errorType = 'client_error';
            if (res.statusCode >= 500) errorType = 'server_error';
            if (res.statusCode === 404) errorType = 'not_found';
            if (res.statusCode === 401 || res.statusCode === 403) errorType = 'auth_error';

            errorRatesByType.inc({
                error_type: errorType,
                endpoint: cleanRoute,
                status_code: res.statusCode.toString()
            });
        }

        // Decrementar conexões ativas quando resposta é enviada
        activeConnections.dec();
    });

    next();
});

// Middleware customizado para observabilidade
app.use(loggingMiddleware);

// Middleware padrão
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint de métricas para Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// Rotas
app.use('/api', apiRoutes);

// Health check com instrumentação automática
const { instrumentFunction } = require('./utils/auto-tracing');

const healthCheck = instrumentFunction((req, res) => {
    req.log.info('Health check executado');

    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'express-observability-app'
    });
}, 'health_check', { 'service.name': 'express-observability-app' });

app.get('/health', healthCheck);

// Rota para gerar métricas e traces de exemplo
app.get('/metrics-demo', async (req, res) => {
    const startTime = Date.now();
    req.log.info({ route: '/metrics-demo' }, 'Iniciando rota de demonstração');

    try {
        // Simular algum processamento
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

        // Simular chamada externa
        const axios = require('axios');
        const response = await axios.get('https://jsonplaceholder.typicode.com/users/1');

        const duration = Date.now() - startTime;
        req.log.info({ duration, status: 'success' }, 'Rota de demonstração concluída');

        res.json({
            message: 'Demonstração de observabilidade',
            user: response.data,
            processingTime: `${duration}ms`,
            metrics: [
                'http_requests_total',
                'http_request_duration_seconds',
                'active_connections'
            ]
        });
    } catch (error) {
        req.log.error({ error: error.message }, 'Erro na rota de demonstração');
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Middleware de erro
app.use((error, req, res, next) => {
    req.log.error({
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
    }, 'Erro não tratado');

    res.status(500).json({
        error: 'Internal Server Error',
        requestId: req.id
    });
});

// 404 handler
app.use('*', (req, res) => {
    req.log.warn({ url: req.originalUrl }, 'Rota não encontrada');
    res.status(404).json({ error: 'Rota não encontrada' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Demo metrics: http://localhost:${PORT}/metrics-demo`);
    console.log(`API Users: http://localhost:${PORT}/api/users`);
    console.log(`Jaeger UI: http://localhost:16686`);
    console.log(`Grafana: http://localhost:3000 (admin/admin)`);
    console.log(`Prometheus: http://localhost:9090`);
});

module.exports = app;
