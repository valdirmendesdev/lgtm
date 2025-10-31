const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Configuração do teste de carga
const CONFIG = {
    duration: 600, // 5 minutos
    concurrency: 20, // 10 requisições simultâneas
    interval: 300, // 1 segundo entre batches
};

// Endpoints para testar
const ENDPOINTS = [
    { method: 'GET', url: '/health', weight: 25 },
    { method: 'GET', url: '/api/users', weight: 20 },
    { method: 'GET', url: '/api/users/1', weight: 15 },
    { method: 'GET', url: '/api/users/2', weight: 10 },
    { method: 'GET', url: '/metrics-demo', weight: 10 },
    { method: 'POST', url: '/api/users', weight: 5, data: { name: 'Test User', email: 'test@email.com' } },
    // Endpoints que geram erros intencionalmente
    { method: 'GET', url: '/api/users/999999', weight: 5 }, // 404
    { method: 'GET', url: '/api/nonexistent', weight: 3 }, // 404
    { method: 'POST', url: '/api/users', weight: 3, data: { invalid: 'data' } }, // 400
    { method: 'DELETE', url: '/api/users/999999', weight: 2 }, // 404
    { method: 'PUT', url: '/api/users/1', weight: 2, data: { name: '' } } // 400
];

// Estatísticas
const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
    responseTimes: [],
    errorsByEndpoint: {},
    requestsByEndpoint: {},
    startTime: Date.now()
};

// Função para escolher endpoint baseado no peso
function selectEndpoint() {
    const totalWeight = ENDPOINTS.reduce((sum, endpoint) => sum + endpoint.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of ENDPOINTS) {
        random -= endpoint.weight;
        if (random <= 0) {
            return endpoint;
        }
    }
    return ENDPOINTS[0]; // fallback
}

// Função para fazer uma requisição
async function makeRequest() {
    const endpoint = selectEndpoint();
    const startTime = Date.now();

    try {
        const config = {
            method: endpoint.method,
            url: `${BASE_URL}${endpoint.url}`,
            timeout: 10000,
        };

        if (endpoint.data) {
            config.data = endpoint.data;
            config.headers = { 'Content-Type': 'application/json' };
        }

        const response = await axios(config);
        const responseTime = Date.now() - startTime;

        // Atualizar estatísticas
        stats.totalRequests++;
        stats.successfulRequests++;
        stats.totalResponseTime += responseTime;
        stats.responseTimes.push(responseTime);

        // Contar por endpoint
        const endpointKey = `${endpoint.method} ${endpoint.url}`;
        stats.requestsByEndpoint[endpointKey] = (stats.requestsByEndpoint[endpointKey] || 0) + 1;

        console.log(`✅ ${endpoint.method} ${endpoint.url} - ${response.status} - ${responseTime}ms`);

    } catch (error) {
        const responseTime = Date.now() - startTime;
        stats.totalRequests++;
        stats.failedRequests++;

        const endpointKey = `${endpoint.method} ${endpoint.url}`;
        stats.errorsByEndpoint[endpointKey] = (stats.errorsByEndpoint[endpointKey] || 0) + 1;

        console.log(`❌ ${endpoint.method} ${endpoint.url} - ${error.response?.status || 'TIMEOUT'} - ${responseTime}ms`);
    }
}

// Função para executar batch de requisições
async function executeBatch() {
    const promises = [];
    for (let i = 0; i < CONFIG.concurrency; i++) {
        promises.push(makeRequest());
    }
    await Promise.all(promises);
}

// Função para calcular percentis
function calculatePercentile(arr, percentile) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
}

// Função para exibir estatísticas
function printStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rps = stats.totalRequests / elapsed;
    const avgResponseTime = stats.totalResponseTime / stats.totalRequests || 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 ESTATÍSTICAS DO TESTE DE CARGA');
    console.log('='.repeat(60));
    console.log(`⏱️  Tempo decorrido: ${elapsed.toFixed(1)}s`);
    console.log(`📈 Total de requisições: ${stats.totalRequests}`);
    console.log(`✅ Sucessos: ${stats.successfulRequests} (${((stats.successfulRequests/stats.totalRequests)*100).toFixed(1)}%)`);
    console.log(`❌ Falhas: ${stats.failedRequests} (${((stats.failedRequests/stats.totalRequests)*100).toFixed(1)}%)`);
    console.log(`🚀 Requisições/segundo: ${rps.toFixed(2)}`);
    console.log(`⏱️  Tempo médio de resposta: ${avgResponseTime.toFixed(0)}ms`);

    if (stats.responseTimes.length > 0) {
        console.log(`📊 P95: ${calculatePercentile(stats.responseTimes, 95).toFixed(0)}ms`);
        console.log(`📊 P99: ${calculatePercentile(stats.responseTimes, 99).toFixed(0)}ms`);
    }

    console.log('\n📋 Requisições por endpoint:');
    Object.entries(stats.requestsByEndpoint).forEach(([endpoint, count]) => {
        console.log(`   ${endpoint}: ${count}`);
    });

    if (Object.keys(stats.errorsByEndpoint).length > 0) {
        console.log('\n❌ Erros por endpoint:');
        Object.entries(stats.errorsByEndpoint).forEach(([endpoint, count]) => {
            console.log(`   ${endpoint}: ${count}`);
        });
    }
    console.log('='.repeat(60) + '\n');
}

// Função principal
async function runLoadTest() {
    console.log('🚀 Iniciando teste de carga...');
    console.log(`⚙️  Configuração: ${CONFIG.concurrency} requisições simultâneas por ${CONFIG.duration}s`);
    console.log(`🎯 Endpoints: ${ENDPOINTS.length} diferentes`);
    console.log('='.repeat(60));

    const endTime = Date.now() + (CONFIG.duration * 1000);

    // Intervalos para estatísticas
    const statsInterval = setInterval(printStats, 30000); // A cada 30 segundos

    while (Date.now() < endTime) {
        await executeBatch();
        await new Promise(resolve => setTimeout(resolve, CONFIG.interval));
    }

    clearInterval(statsInterval);
    printStats();
    console.log('✅ Teste de carga concluído!');
}

// Verificar se o servidor está rodando
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/health`);
        console.log('✅ Servidor detectado em http://localhost:3001');
        return true;
    } catch (error) {
        console.log('❌ Servidor não está rodando em http://localhost:3001');
        console.log('💡 Execute: npm start');
        return false;
    }
}

// Executar o teste
async function main() {
    if (await checkServer()) {
        await runLoadTest();
    }
}

main().catch(console.error);
