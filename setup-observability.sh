#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}\n"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Stop and clean existing containers
cleanup_containers() {
    print_status "Cleaning up existing containers..."
    docker compose down -v 2>/dev/null || true
    docker system prune -f > /dev/null 2>&1 || true
    print_success "Cleanup completed"
}

# Start infrastructure
start_infrastructure() {
    print_status "Starting observability infrastructure..."
    if docker compose up -d; then
        print_success "Infrastructure started successfully"
    else
        print_error "Failed to start infrastructure"
        exit 1
    fi
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be ready..."

    # Wait for Grafana
    print_status "Waiting for Grafana..."
    timeout=120
    counter=0
    while [ $counter -lt $timeout ]; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            print_success "Grafana is ready"
            break
        fi

        # Check for Grafana configuration errors
        if [ $counter -gt 20 ]; then
            grafana_logs=$(docker compose logs grafana --tail 5 2>/dev/null || echo "")
            if echo "$grafana_logs" | grep -q "invalid setting"; then
                print_warning "Grafana configuration error detected, restarting..."
                docker compose restart grafana > /dev/null 2>&1
                sleep 5
            fi
        fi

        sleep 2
        counter=$((counter + 2))
        if [ $counter -ge $timeout ]; then
            print_error "Grafana failed to start within $timeout seconds"
            print_status "Checking Grafana logs..."
            docker compose logs grafana --tail 10
            exit 1
        fi
    done

    # Wait for Prometheus
    print_status "Waiting for Prometheus..."
    counter=0
    while [ $counter -lt $timeout ]; do
        if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
            print_success "Prometheus is ready"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        if [ $counter -ge $timeout ]; then
            print_error "Prometheus failed to start within $timeout seconds"
            exit 1
        fi
    done

    # Wait for Jaeger
    print_status "Waiting for Jaeger..."
    counter=0
    while [ $counter -lt $timeout ]; do
        if curl -s http://localhost:16686/ > /dev/null 2>&1; then
            print_success "Jaeger is ready"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        if [ $counter -ge $timeout ]; then
            print_error "Jaeger failed to start within $timeout seconds"
            exit 1
        fi
    done
}

# Install Node.js dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    if npm install > /dev/null 2>&1; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Start Express application
start_application() {
    print_status "Starting Express application in background..."
    npm start > app.log 2>&1 &
    APP_PID=$!
    echo $APP_PID > app.pid

    # Wait for app to start
    sleep 5
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Express application is running (PID: $APP_PID)"
    else
        print_error "Express application failed to start"
        exit 1
    fi
}

# Generate initial load
generate_load() {
    print_status "Generating initial load to populate metrics..."
    node -e "
        const axios = require('axios');
        const BASE_URL = 'http://localhost:3001';

        async function generateLoad() {
            const endpoints = ['/health', '/api/users', '/api/users/1', '/metrics-demo'];
            for (let i = 0; i < 50; i++) {
                try {
                    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
                    await axios.get(BASE_URL + endpoint);
                } catch (e) {
                    // Ignore errors for demo
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log('Initial load generation completed');
        }

        generateLoad();
    " > /dev/null 2>&1
    print_success "Initial metrics generated"
}

# Display final information
display_info() {
    print_header "🎉 OBSERVABILITY STACK READY!"

    echo -e "${GREEN}📊 Grafana Dashboard:${NC}"
    echo -e "   🌐 URL: http://localhost:3000"
    echo -e "   👤 Login: admin / admin"
    echo -e "   📋 Dashboard: Express.js Observability (auto-imported)"

    echo -e "\n${BLUE}🔍 Other Services:${NC}"
    echo -e "   📈 Prometheus: http://localhost:9090"
    echo -e "   🔍 Jaeger: http://localhost:16686"
    echo -e "   🏗️  Express App: http://localhost:3001"

    echo -e "\n${YELLOW}🧪 Test Commands:${NC}"
    echo -e "   npm test              # Health check"
    echo -e "   npm run load-test     # Full load test (5 min)"
    echo -e "   npm run load-test:light # Quick test (1 min)"

    echo -e "\n${YELLOW}🛑 To Stop:${NC}"
    echo -e "   ./stop-observability.sh"
    echo -e "   # or manually:"
    echo -e "   kill \$(cat app.pid) && docker compose down"

    echo -e "\n${GREEN}✅ All services are running and dashboard is auto-configured!${NC}"
}

# Main execution
main() {
    print_header "🚀 SETTING UP OBSERVABILITY STACK"

    check_docker
    check_docker_compose
    cleanup_containers
    install_dependencies
    start_infrastructure
    wait_for_services
    start_application
    generate_load

    # Give Grafana time to provision
    print_status "Waiting for Grafana to provision dashboard..."
    sleep 10

    display_info
}

# Run main function
main "$@"