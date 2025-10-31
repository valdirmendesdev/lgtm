#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}\n"
}

# Stop Express application
stop_application() {
    print_status "Stopping Express application..."
    if [ -f app.pid ]; then
        APP_PID=$(cat app.pid)
        if kill $APP_PID 2>/dev/null; then
            print_success "Express application stopped (PID: $APP_PID)"
        else
            print_warning "Express application was not running or already stopped"
        fi
        rm -f app.pid
    else
        print_warning "No PID file found for Express application"
    fi
}

# Stop Docker services
stop_infrastructure() {
    print_status "Stopping observability infrastructure..."
    if docker compose down; then
        print_success "Infrastructure stopped successfully"
    else
        print_warning "Failed to stop infrastructure cleanly"
    fi
}

# Clean up resources
cleanup() {
    print_status "Cleaning up resources..."

    # Remove log files
    rm -f app.log

    # Kill any remaining node processes (be careful!)
    pkill -f "node.*app.js" 2>/dev/null || true
    pkill -f "node.*load-test.js" 2>/dev/null || true

    print_success "Cleanup completed"
}

# Display final message
display_final_message() {
    print_header "🛑 OBSERVABILITY STACK STOPPED"
    echo -e "${GREEN}✅ All services have been stopped${NC}"
    echo -e "${BLUE}💡 To restart: ./setup-observability.sh${NC}"
}

# Main execution
main() {
    print_header "🛑 STOPPING OBSERVABILITY STACK"

    stop_application
    stop_infrastructure
    cleanup
    display_final_message
}

# Run main function
main "$@"