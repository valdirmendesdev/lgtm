const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { DiagConsoleLogger, DiagLogLevel, diag } = require('@opentelemetry/api');
const { logs } = require('@opentelemetry/api-logs');

// Configurar logging do OpenTelemetry (opcional)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'express-observability-app',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
});

const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

const metricExporter = new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
});

const logExporter = new OTLPLogExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/logs',
});

// Configurar provider de logs
const loggerProvider = new LoggerProvider({
    resource: resource,
});

loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(logExporter)
);

logs.setGlobalLoggerProvider(loggerProvider);

const sdk = new NodeSDK({
    resource: resource,
    traceExporter: traceExporter,
    metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000,
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-express': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-http': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-pino': {
                enabled: true,
                logSendingLevel: 'info',
                logHook: (span, record) => {
                    record['resource.service.name'] = resource.attributes['service.name'];
                },
            },
        })
    ],
});

try {
    sdk.start();
    console.log('OpenTelemetry SDK inicializado');
} catch (error) {
    console.error('Erro ao inicializar OpenTelemetry SDK', error);
}

process.on('SIGTERM', () => {
    Promise.all([
        sdk.shutdown(),
        loggerProvider.shutdown()
    ])
        .then(() => console.log('OpenTelemetry SDK finalizado'))
        .catch((error) => console.error('Erro ao finalizar OpenTelemetry SDK', error))
        .finally(() => process.exit(0));
});
