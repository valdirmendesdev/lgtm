const { context, trace } = require('@opentelemetry/api');
const { instrumentFunction } = require('../utils/auto-tracing');

const loggingMiddleware = instrumentFunction(function(req, res, next) {
    const span = trace.getSpan(context.active());

    if (span) {
        const traceId = span.spanContext().traceId;
        const spanId = span.spanContext().spanId;

        // Adicionar trace ID ao log
        req.log = req.log.child({
            traceId: traceId,
            spanId: spanId
        });

        // Adicionar atributos básicos ao span
        span.setAttributes({
            'http.method': req.method,
            'http.route': req.route?.path || req.path,
            'http.url': req.url,
            'http.user_agent': req.get('User-Agent') || ''
        });
    }

    // Log de início da requisição
    req.log.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    }, 'Requisição recebida');

    next();
}, 'middleware_execution', { 'middleware.name': 'logging' });

module.exports = {
    loggingMiddleware
};
