# 🚀 Express.js Observability Stack - Fully Automated

## 🎯 One-Command Setup

```bash
npm run setup
```

Esse comando automaticamente:
- ✅ Instala dependências
- ✅ Inicia infraestrutura (Grafana, Prometheus, Jaeger, Loki)
- ✅ Configura datasources automaticamente
- ✅ Importa dashboard pré-configurado
- ✅ Inicia aplicação Express.js
- ✅ Gera carga inicial para popular métricas
- ✅ Valida que tudo está funcionando

## 🛑 One-Command Stop

```bash
npm run stop
```

## 📊 O que você ganha automaticamente

### 🎯 **Dashboard Grafana Pronto para Produção**
- URL: http://localhost:3000
- Login: `admin` / Senha: `admin`
- Dashboard: **Express.js Observability** (já importado)

### 📈 **Métricas Essenciais (RED + Golden Signals)**
- **Request Rate**: RPS em tempo real
- **Error Rate**: Taxa de erros 4xx/5xx
- **Response Time**: P50, P95, P99, Average
- **Active Requests**: Conexões ativas
- **Success Rate**: Taxa de sucesso
- **Requests by Endpoint**: Volume por rota
- **HTTP Status Distribution**: Códigos de status
- **System Resources**: Memória e CPU

### 🔍 **Observabilidade Completa**
- **Traces**: Jaeger UI (http://localhost:16686)
- **Metrics**: Prometheus (http://localhost:9090)
- **Logs**: Loki integrado
- **Alerting**: Thresholds pré-configurados

## 🧪 Comandos de Teste

```bash
# Verificar saúde da aplicação
npm test

# Teste de carga rápido (1 minuto)
npm run load-test:light

# Teste de carga completo (5 minutos)
npm run load-test
```

## 📁 Estrutura Automatizada

```
project/
├── 🚀 setup-observability.sh      # Setup automático
├── 🛑 stop-observability.sh       # Stop automático
├── 📊 load-test.js                # Gerador de carga
├── grafana/                       # Configurações automáticas
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── prometheus.yml     # Prometheus + Jaeger + Loki
│   │   └── dashboards/
│   │       ├── dashboards.yml     # Config de dashboards
│   │       └── express-observability-dashboard.json
│   └── grafana.ini               # Configurações do Grafana
├── docker-compose.yml            # Infraestrutura completa
└── tracing.js                    # OpenTelemetry configurado
```

## 🔧 Configurações Automáticas

### ✅ **Grafana Provisioning**
- **Datasources**: Prometheus, Jaeger, Loki (auto-configurados)
- **Dashboard**: Importado automaticamente no startup
- **Alerting**: Habilitado
- **Tracing**: Integração com Jaeger
- **Logs**: Correlação com traces

### ✅ **Prometheus Scraping**
- **Express App**: Métricas OpenTelemetry
- **Node.js**: Métricas de sistema
- **Interval**: 30s
- **Retention**: 15d

### ✅ **OpenTelemetry**
- **Auto-instrumentação**: HTTP, Express
- **Exporters**: OTLP para Jaeger e Prometheus
- **Resource**: Service name configurado
- **Sampling**: 100% (desenvolvimento)

## 🚨 Thresholds de Produção

| Métrica | 🟢 Bom | 🟡 Atenção | 🔴 Crítico |
|---------|---------|------------|------------|
| **Error Rate** | < 1% | 1-5% | > 5% |
| **P95 Latency** | < 100ms | 100-500ms | > 500ms |
| **Success Rate** | > 99% | 95-99% | < 95% |
| **RPS** | Normal | > 10 req/s | > 50 req/s |

## 🔍 URLs Importantes

```bash
🏠 Express App:     http://localhost:3001
📊 Grafana:         http://localhost:3000 (admin/admin)
📈 Prometheus:      http://localhost:9090
🔍 Jaeger:          http://localhost:16686
📝 Loki:            http://localhost:3100
```

## 🧩 Endpoints da API

```bash
GET  /health              # Health check
GET  /metrics-demo        # Demo com external call
GET  /api/users           # Lista usuários
GET  /api/users/:id       # Usuário específico
POST /api/users           # Criar usuário
```

## 🛠️ Personalização

### Modificar Dashboard
1. Edite: `grafana/provisioning/dashboards/express-observability-dashboard.json`
2. Reinicie: `npm run stop && npm run setup`

### Adicionar Métricas
1. Modifique: `routes/api.js` ou `tracing.js`
2. Adicione queries no dashboard
3. Reinicie o sistema

### Configurar Alertas
1. Acesse Grafana → Alerting
2. Configure rules baseadas nas métricas
3. Defina notification channels

## 🚨 Troubleshooting

### Dashboard não aparece?
```bash
# Verificar logs do Grafana
docker compose logs grafana

# Re-provisionar
npm run stop && npm run setup
```

### Métricas vazias?
```bash
# Gerar carga
npm run load-test:light

# Verificar Prometheus targets
# http://localhost:9090/targets
```

### Aplicação não inicia?
```bash
# Verificar porta em uso
lsof -i :3001

# Verificar logs
cat app.log
```

## 🏆 Benefícios da Automação

- ⚡ **Setup em 1 comando**: Sem configuração manual
- 🔧 **Zero configuração**: Tudo pré-configurado
- 📊 **Dashboard pronto**: Métricas essenciais
- 🔍 **Observabilidade completa**: Traces + Metrics + Logs
- 🚀 **Production-ready**: Thresholds e alertas
- 🧪 **Teste incluído**: Load testing automatizado
- 📖 **Documentação completa**: Guias e troubleshooting

## 🎉 Resultado Final

Em **menos de 2 minutos**, você terá:
- ✅ Stack completa de observabilidade rodando
- ✅ Dashboard Grafana com 10+ visualizações
- ✅ Métricas fluindo automaticamente
- ✅ Traces correlacionados
- ✅ Sistema pronto para produção

**Comando único**: `npm run setup` 🚀