const express = require('express');
const router = express.Router();
const { metrics } = require('@opentelemetry/api');
const { instrumentFunction } = require('../utils/auto-tracing');

// Criar métricas customizadas
const meter = metrics.getMeter('express-api');
const requestCounter = meter.createCounter('api_requests_total', {
    description: 'Total de requisições da API'
});

const responseTimeHistogram = meter.createHistogram('http_request_duration_seconds', {
    description: 'Duração das requisições HTTP em segundos',
    unit: 's'
});

// Middleware para métricas de API
router.use((req, res, next) => {
    const startTime = Date.now();

    // Contador de requisições
    requestCounter.add(1, {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode
    });

    // Hook para capturar tempo de resposta
    res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        responseTimeHistogram.record(duration, {
            method: req.method,
            route: req.route?.path || req.path,
            status_code: res.statusCode
        });
    });

    next();
});

// Funções de negócio com instrumentação automática
const getAllUsers = instrumentFunction((req, res) => {
    req.log.info('Buscando lista de usuários');

    // Gerar erro 500 aleatório (20% de chance)
    if (Math.random() < 0.2) {
        req.log.error('Erro interno simulado na busca de usuários');
        throw new Error('Falha na conexão com o banco de dados');
    }

    // Simular processamento
    setTimeout(() => {
        res.json([
            { id: 1, name: 'João Silva', email: 'joao@email.com' },
            { id: 2, name: 'Maria Santos', email: 'maria@email.com' }
        ]);
    }, 100);
}, 'user_lookup', { 'user.action': 'list_all' });

const getUserById = instrumentFunction((req, res) => {
    const { id } = req.params;
    req.log.info({ userId: id }, 'Buscando usuário específico');

    // Gerar erro 500 aleatório (15% de chance)
    if (Math.random() < 0.15) {
        req.log.error({ userId: id }, 'Erro de timeout na consulta do usuário');
        throw new Error('Timeout na consulta ao banco de dados');
    }

    if (id === '999') {
        req.log.warn({ userId: id }, 'Usuário não encontrado');
        throw new Error('Usuário não encontrado');
    }

    res.json({
        id: parseInt(id),
        name: `Usuário ${id}`,
        email: `user${id}@email.com`
    });
}, 'user_lookup', { 'user.action': 'get_by_id' });

const createUser = instrumentFunction((req, res) => {
    const { name, email } = req.body;
    req.log.info({ userData: { name, email } }, 'Criando novo usuário');

    // Validação básica
    if (!name || !email) {
        req.log.warn({ userData: { name, email } }, 'Dados de usuário inválidos');
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    // Gerar erro 500 aleatório (10% de chance)
    if (Math.random() < 0.1) {
        req.log.error({ userData: { name, email } }, 'Erro interno na criação do usuário');
        throw new Error('Falha na validação de duplicidade de email');
    }

    // Simular criação
    setTimeout(() => {
        const newUserId = Math.floor(Math.random() * 1000);
        req.log.info({ userId: newUserId, userData: { name, email } }, 'Usuário criado com sucesso');

        res.status(201).json({
            id: newUserId,
            name,
            email,
            createdAt: new Date().toISOString()
        });
    }, 200);
}, 'user_creation', { 'user.action': 'create' });

// Função para simular diferentes tipos de erros
const simulateErrors = instrumentFunction((req, res) => {
    const errorType = req.query.type || 'random';
    req.log.info({ errorType }, 'Simulando erros para teste');

    const random = Math.random();

    switch (errorType) {
        case 'database':
            if (random < 0.8) {
                req.log.error('Simulando erro de banco de dados');
                throw new Error('Conexão com banco de dados perdida');
            }
            break;
        case 'timeout':
            if (random < 0.7) {
                req.log.error('Simulando timeout');
                throw new Error('Timeout na operação externa');
            }
            break;
        case 'auth':
            if (random < 0.6) {
                req.log.error('Simulando erro de autenticação');
                return res.status(401).json({ error: 'Token inválido' });
            }
            break;
        case 'validation':
            if (random < 0.5) {
                req.log.warn('Simulando erro de validação');
                return res.status(400).json({ error: 'Dados inválidos fornecidos' });
            }
            break;
        default:
            // Erro aleatório (30% de chance)
            if (random < 0.3) {
                const errors = [
                    'Erro interno do servidor',
                    'Serviço temporariamente indisponível',
                    'Falha na comunicação com API externa',
                    'Limite de rate limit excedido'
                ];
                const errorMsg = errors[Math.floor(Math.random() * errors.length)];
                req.log.error({ errorMsg }, 'Simulando erro aleatório');
                throw new Error(errorMsg);
            }
    }

    // Se não houve erro
    req.log.info({ errorType, success: true }, 'Simulação concluída sem erros');
    res.json({
        message: 'Simulação executada com sucesso',
        errorType,
        timestamp: new Date().toISOString(),
        result: 'no_error'
    });
}, 'error_simulation', { 'operation.type': 'test' });

// Rotas usando as funções instrumentadas
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);

// Rota para simular erros
router.get('/simulate-errors', simulateErrors);

module.exports = router;
