const { trace, SpanStatusCode } = require('@opentelemetry/api');
const path = require('path');

class AutoTracing {
    static getCallerInfo() {
        const originalPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, stack) => stack;
        const error = new Error();
        const stack = error.stack;
        Error.prepareStackTrace = originalPrepareStackTrace;

        // stack[0] é this function, stack[1] é o wrapper, stack[2] é o caller real
        const caller = stack[2];

        return {
            functionName: caller.getFunctionName() || caller.getMethodName() || 'anonymous',
            fileName: path.relative(process.cwd(), caller.getFileName()),
            lineNumber: caller.getLineNumber(),
            methodName: caller.getMethodName(),
            typeName: caller.getTypeName()
        };
    }

    static getErrorInfo(error) {
        const stackLines = error.stack ? error.stack.split('\n') : [];
        const errorLine = stackLines.find(line => line.includes('.js:') && !line.includes('node_modules'));

        if (errorLine) {
            const match = errorLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
            if (match) {
                return {
                    errorFunction: match[1] || 'unknown',
                    errorFile: path.relative(process.cwd(), match[2]),
                    errorLine: parseInt(match[3]),
                    errorColumn: parseInt(match[4])
                };
            }
        }

        return {
            errorFunction: 'unknown',
            errorFile: 'unknown',
            errorLine: 0,
            errorColumn: 0
        };
    }

    static instrumentFunction(fn, operationType = 'function_call', additionalAttributes = {}) {
        return function instrumentedFunction(...args) {
            const callerInfo = AutoTracing.getCallerInfo();
            const tracer = trace.getTracer('auto-instrumentation');

            const spanName = callerInfo.functionName ||
                           callerInfo.methodName ||
                           `${callerInfo.fileName}:${callerInfo.lineNumber}`;

            const span = tracer.startSpan(spanName, {
                attributes: {
                    'code.function': callerInfo.functionName,
                    'code.filepath': callerInfo.fileName,
                    'code.lineno': callerInfo.lineNumber,
                    'code.method': callerInfo.methodName,
                    'code.type': callerInfo.typeName,
                    'operation.type': operationType,
                    'instrumentation.automatic': true,
                    ...additionalAttributes
                }
            });

            try {
                // Se for função async
                if (fn.constructor.name === 'AsyncFunction') {
                    return fn.apply(this, args).then(result => {
                        span.setAttributes({
                            'operation.status': 'success',
                            'result.type': typeof result
                        });
                        span.end();
                        return result;
                    }).catch(error => {
                        const errorInfo = AutoTracing.getErrorInfo(error);

                        span.recordException(error);
                        span.setStatus({
                            code: SpanStatusCode.ERROR,
                            message: error.message
                        });
                        span.setAttributes({
                            'operation.status': 'error',
                            'error.type': error.constructor.name,
                            'error.message': error.message,
                            'error.function': errorInfo.errorFunction,
                            'error.file': errorInfo.errorFile,
                            'error.line': errorInfo.errorLine,
                            'error.column': errorInfo.errorColumn,
                            'error.stack': error.stack
                        });
                        span.end();
                        throw error;
                    });
                } else {
                    // Função síncrona
                    const result = fn.apply(this, args);
                    span.setAttributes({
                        'operation.status': 'success',
                        'result.type': typeof result
                    });
                    span.end();
                    return result;
                }
            } catch (error) {
                const errorInfo = AutoTracing.getErrorInfo(error);

                span.recordException(error);
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error.message
                });
                span.setAttributes({
                    'operation.status': 'error',
                    'error.type': error.constructor.name,
                    'error.message': error.message,
                    'error.function': errorInfo.errorFunction,
                    'error.file': errorInfo.errorFile,
                    'error.line': errorInfo.errorLine,
                    'error.column': errorInfo.errorColumn,
                    'error.stack': error.stack
                });
                span.end();
                throw error;
            }
        };
    }

    // Decorator para routes Express
    static instrumentRoute(method = 'GET', path = '') {
        return function(target, propertyKey, descriptor) {
            const originalMethod = descriptor.value;

            descriptor.value = function(req, res, next) {
                const callerInfo = AutoTracing.getCallerInfo();
                const tracer = trace.getTracer('route-instrumentation');

                const spanName = `${method} ${path} -> ${propertyKey}`;

                const span = tracer.startSpan(spanName, {
                    attributes: {
                        'code.function': propertyKey,
                        'code.filepath': callerInfo.fileName,
                        'code.lineno': callerInfo.lineNumber,
                        'http.method': method,
                        'http.route': path,
                        'route.handler': propertyKey,
                        'operation.type': 'route_handler',
                        'instrumentation.automatic': true
                    }
                });

                try {
                    const result = originalMethod.apply(this, [req, res, next]);

                    // Se for Promise
                    if (result && typeof result.then === 'function') {
                        return result.then(value => {
                            span.setAttributes({
                                'operation.status': 'success',
                                'http.status_code': res.statusCode
                            });
                            span.end();
                            return value;
                        }).catch(error => {
                            const errorInfo = AutoTracing.getErrorInfo(error);

                            span.recordException(error);
                            span.setStatus({
                                code: SpanStatusCode.ERROR,
                                message: error.message
                            });
                            span.setAttributes({
                                'operation.status': 'error',
                                'error.type': error.constructor.name,
                                'error.message': error.message,
                                'error.function': errorInfo.errorFunction,
                                'error.file': errorInfo.errorFile,
                                'error.line': errorInfo.errorLine,
                                'error.column': errorInfo.errorColumn,
                                'error.stack': error.stack,
                                'http.status_code': res.statusCode
                            });
                            span.end();
                            throw error;
                        });
                    } else {
                        span.setAttributes({
                            'operation.status': 'success',
                            'http.status_code': res.statusCode
                        });
                        span.end();
                        return result;
                    }
                } catch (error) {
                    const errorInfo = AutoTracing.getErrorInfo(error);

                    span.recordException(error);
                    span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: error.message
                    });
                    span.setAttributes({
                        'operation.status': 'error',
                        'error.type': error.constructor.name,
                        'error.message': error.message,
                        'error.function': errorInfo.errorFunction,
                        'error.file': errorInfo.errorFile,
                        'error.line': errorInfo.errorLine,
                        'error.column': errorInfo.errorColumn,
                        'error.stack': error.stack,
                        'http.status_code': res.statusCode
                    });
                    span.end();
                    throw error;
                }
            };

            return descriptor;
        };
    }

    // Helper para instrumentar automaticamente todas as funções de um objeto
    static instrumentObject(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'function') {
                obj[key] = this.instrumentFunction(value, `${prefix}${key}`, {
                    'object.method': key,
                    'object.prefix': prefix
                });
            }
        }
        return obj;
    }

    // Middleware automático para Express
    static createAutoMiddleware() {
        return (req, res, next) => {
            const callerInfo = AutoTracing.getCallerInfo();
            const tracer = trace.getTracer('middleware-auto');

            const span = tracer.startSpan('auto.middleware', {
                attributes: {
                    'code.filepath': callerInfo.fileName,
                    'code.lineno': callerInfo.lineNumber,
                    'middleware.type': 'auto_instrumentation',
                    'http.method': req.method,
                    'http.url': req.url,
                    'instrumentation.automatic': true
                }
            });

            // Interceptar o final da resposta
            const originalEnd = res.end;
            res.end = function(...args) {
                span.setAttributes({
                    'http.status_code': res.statusCode,
                    'operation.status': res.statusCode < 400 ? 'success' : 'error'
                });
                span.end();
                originalEnd.apply(this, args);
            };

            next();
        };
    }
}

// Export como função helper também
function autoTrace(operationType, additionalAttributes = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = AutoTracing.instrumentFunction(originalMethod, operationType, additionalAttributes);
        return descriptor;
    };
}

module.exports = {
    AutoTracing,
    autoTrace,
    instrumentFunction: AutoTracing.instrumentFunction.bind(AutoTracing),
    instrumentObject: AutoTracing.instrumentObject.bind(AutoTracing),
    instrumentRoute: AutoTracing.instrumentRoute.bind(AutoTracing)
};