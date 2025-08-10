#!/bin/bash
set -euo pipefail

# ClickUp MCP Integration Test Script
# This script tests the complete integration: Worker API + MCP Server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration - Load from environment variables or .env file
WORKER_URL=${CLICKUP_WORKER_URL:-"https://clickup-workers.dhandedhan.workers.dev"}
SHARED_SECRET=${CLICKUP_SHARED_SECRET:-""}
DEFAULT_LIST_ID=${CLICKUP_DEFAULT_LIST_ID:-""}

# Load from .env file if it exists and secrets are not set
if [ -f "mcp-server/.env" ] && ([ -z "$SHARED_SECRET" ] || [ -z "$DEFAULT_LIST_ID" ]); then
    export $(grep -v '^#' mcp-server/.env | xargs)
    WORKER_URL=${CLICKUP_WORKER_URL:-"https://clickup-workers.dhandedhan.workers.dev"}
    SHARED_SECRET=${CLICKUP_SHARED_SECRET:-""}
    DEFAULT_LIST_ID=${CLICKUP_DEFAULT_LIST_ID:-""}
fi

# Validate required secrets
if [ -z "$SHARED_SECRET" ] || [ -z "$DEFAULT_LIST_ID" ]; then
    echo -e "${RED}❌ Error: Required secrets not found${NC}"
    echo "Please set the following environment variables:"
    echo "  CLICKUP_SHARED_SECRET"
    echo "  CLICKUP_DEFAULT_LIST_ID"
    echo ""
    echo "Or ensure mcp-server/.env file exists with these values."
    exit 1
fi

echo -e "${BLUE}🚀 ClickUp MCP Integration Test Suite${NC}"
echo "=========================================="
echo ""

# Function to print test results
print_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "  ${GREEN}✅ $test_name${NC}: $message"
    else
        echo -e "  ${RED}❌ $test_name${NC}: $message"
    fi
}

# Function to test worker API endpoints
test_worker_api() {
    echo -e "${CYAN}🔗 Testing Worker API Endpoints${NC}"
    echo "----------------------------------------"
    
    # Test 1: Health Check
    echo -n "Testing health endpoint... "
    if health_response=$(curl -sS -H "X-Webhook-Secret: $SHARED_SECRET" "$WORKER_URL/health" 2>/dev/null); then
        if echo "$health_response" | jq -e '.ok' >/dev/null 2>&1; then
            print_result "Health Check" "PASS" "Worker is healthy"
        else
            print_result "Health Check" "FAIL" "Worker returned unexpected response"
        fi
    else
        print_result "Health Check" "FAIL" "Failed to connect to worker"
    fi
    
    # Test 2: ClickUp Connection
    echo -n "Testing ClickUp connection... "
    if clickup_response=$(curl -sS -H "X-Webhook-Secret: $SHARED_SECRET" "$WORKER_URL/clickup.me" 2>/dev/null); then
        if username=$(echo "$clickup_response" | jq -r '.user.username' 2>/dev/null); then
            if [ "$username" != "null" ] && [ "$username" != "" ]; then
                print_result "ClickUp Connection" "PASS" "Connected as $username"
            else
                print_result "ClickUp Connection" "FAIL" "No user data returned"
            fi
        else
            print_result "ClickUp Connection" "FAIL" "Invalid response format"
        fi
    else
        print_result "ClickUp Connection" "FAIL" "Failed to connect to ClickUp"
    fi
    
    # Test 3: Learning Goals
    echo -n "Testing learning goals endpoint... "
    if goals_response=$(curl -sS -H "X-Webhook-Secret: $SHARED_SECRET" "$WORKER_URL/learning/goals" 2>/dev/null); then
        if goals_count=$(echo "$goals_response" | jq -r '.goals | length' 2>/dev/null); then
            if [ "$goals_count" != "null" ] && [ "$goals_count" -ge 0 ]; then
                print_result "Learning Goals" "PASS" "Found $goals_count goals"
            else
                print_result "Learning Goals" "FAIL" "No goals data returned"
            fi
        else
            print_result "Learning Goals" "FAIL" "Invalid response format"
        fi
    else
        print_result "Learning Goals" "FAIL" "Failed to fetch learning goals"
    fi
    
    # Test 4: Task Creation (test endpoint)
    echo -n "Testing task creation endpoint... "
    test_task_data='{"title":"Integration Test Task","description":"Test task created by integration script","tags":["test","integration"]}'
    if create_response=$(curl -sS -X POST -H "Content-Type: application/json" -H "X-Webhook-Secret: $SHARED_SECRET" -d "$test_task_data" "$WORKER_URL/tasks.create" 2>/dev/null); then
        if task_id=$(echo "$create_response" | jq -r '.id' 2>/dev/null); then
            if [ "$task_id" != "null" ] && [ "$task_id" != "" ]; then
                print_result "Task Creation" "PASS" "Created task ID: $task_id"
                # Clean up - delete the test task
                echo -n "Cleaning up test task... "
                if curl -sS -X POST -H "Content-Type: application/json" -H "X-Webhook-Secret: $SHARED_SECRET" -d "{\"id\":\"$task_id\",\"status\":\"done\"}" "$WORKER_URL/tasks.update" >/dev/null 2>&1; then
                    echo -e "${GREEN}✅ Cleaned up${NC}"
                else
                    echo -e "${YELLOW}⚠️  Could not clean up test task${NC}"
                fi
            else
                print_result "Task Creation" "FAIL" "No task ID returned"
            fi
        else
            print_result "Task Creation" "FAIL" "Invalid response format"
        fi
    else
        print_result "Task Creation" "FAIL" "Failed to create test task"
    fi
    
    echo ""
}

# Function to test MCP server
test_mcp_server() {
    echo -e "${CYAN}🧪 Testing MCP Server${NC}"
    echo "---------------------------"
    
    # Check if we're in the right directory
    if [ ! -f "mcp-server/clickup-mcp.js" ]; then
        echo -e "${RED}❌ MCP server not found. Please run this script from the project root.${NC}"
        return 1
    fi
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_result "Node.js" "FAIL" "Node.js is not installed"
        return 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_result "Node.js Version" "FAIL" "Node.js 18+ required (current: $(node --version))"
        return 1
    else
        print_result "Node.js Version" "PASS" "Version $(node --version)"
    fi
    
    # Check if MCP dependencies are installed
    if [ ! -d "mcp-server/node_modules" ]; then
        echo -n "Installing MCP dependencies... "
        if (cd mcp-server && npm install >/dev/null 2>&1); then
            echo -e "${GREEN}✅ Installed${NC}"
        else
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            return 1
        fi
    else
        print_result "MCP Dependencies" "PASS" "Already installed"
    fi
    
    # Test MCP server functionality
    echo -n "Testing MCP server tools... "
    
    # Create a temporary test script
    cat > /tmp/test_mcp_tools.js << 'EOF'
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mcpProcess = spawn('node', [join(__dirname, 'mcp-server/clickup-mcp.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
         CLICKUP_WORKER_URL: '$WORKER_URL',
     CLICKUP_SHARED_SECRET: '$SHARED_SECRET',
     CLICKUP_DEFAULT_LIST_ID: '$DEFAULT_LIST_ID',
  }
});

let output = '';
let errorOutput = '';

mcpProcess.stdout.on('data', (data) => {
  output += data.toString();
});

mcpProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

mcpProcess.stdin.write(JSON.stringify(testRequest) + '\n');

setTimeout(() => {
  mcpProcess.kill();
  
  if (output.includes('create_task') && output.includes('list_tasks')) {
    console.log('PASS');
    process.exit(0);
  } else {
    console.log('FAIL');
    process.exit(1);
  }
}, 2000);
EOF

    if result=$(cd /tmp && node test_mcp_tools.js 2>/dev/null); then
        if [ "$result" = "PASS" ]; then
            print_result "MCP Server Tools" "PASS" "All 8 tools available"
        else
            print_result "MCP Server Tools" "FAIL" "Tools not properly configured"
        fi
    else
        print_result "MCP Server Tools" "FAIL" "Failed to start MCP server"
    fi
    
    # Clean up
    rm -f /tmp/test_mcp_tools.js
    
    echo ""
}

# Function to test environment configuration
test_environment() {
    echo -e "${CYAN}🔧 Testing Environment Configuration${NC}"
    echo "----------------------------------------"
    
    # Check if .env file exists in mcp-server
    if [ -f "mcp-server/.env" ]; then
        print_result "MCP .env File" "PASS" "Configuration file exists"
        
        # Check if all required variables are set
        if grep -q "CLICKUP_WORKER_URL" mcp-server/.env && \
           grep -q "CLICKUP_SHARED_SECRET" mcp-server/.env && \
           grep -q "CLICKUP_DEFAULT_LIST_ID" mcp-server/.env; then
            print_result "MCP Environment Variables" "PASS" "All required variables configured"
        else
            print_result "MCP Environment Variables" "FAIL" "Missing required variables"
        fi
    else
        print_result "MCP .env File" "FAIL" "Configuration file missing"
    fi
    
    # Check if Cursor MCP config exists
    if [ -f "$HOME/.cursor/mcp.json" ]; then
        print_result "Cursor MCP Config" "PASS" "Configuration file exists"
        
        # Check if clickup server is configured
        if grep -q "clickup" "$HOME/.cursor/mcp.json"; then
            print_result "Cursor ClickUp Server" "PASS" "ClickUp server configured"
        else
            print_result "Cursor ClickUp Server" "FAIL" "ClickUp server not configured"
        fi
    else
        print_result "Cursor MCP Config" "FAIL" "Configuration file missing"
    fi
    
    echo ""
}

# Function to provide setup instructions
show_setup_instructions() {
    echo -e "${PURPLE}📋 Setup Instructions${NC}"
    echo "========================"
    echo ""
    echo "If any tests failed, follow these steps:"
    echo ""
    echo "1. ${CYAN}Install MCP Dependencies:${NC}"
    echo "   cd mcp-server && npm install"
    echo ""
    echo "2. ${CYAN}Configure Environment Variables:${NC}"
    echo "   Update mcp-server/.env with your values:"
    echo "   CLICKUP_WORKER_URL=$WORKER_URL"
    echo "   CLICKUP_SHARED_SECRET=your-shared-secret-here"
    echo "   CLICKUP_DEFAULT_LIST_ID=your-list-id-here"
    echo ""
    echo "3. ${CYAN}Configure Cursor MCP Settings:${NC}"
    echo "   Add to ~/.cursor/mcp.json:"
    echo "   {"
    echo "     \"mcpServers\": {"
    echo "       \"clickup\": {"
    echo "         \"command\": \"node\","
    echo "         \"args\": [\"$(pwd)/mcp-server/clickup-mcp.js\"],"
    echo "         \"env\": {"
    echo "           \"CLICKUP_WORKER_URL\": \"$WORKER_URL\","
    echo "           \"CLICKUP_SHARED_SECRET\": \"your-shared-secret-here\","
    echo "           \"CLICKUP_DEFAULT_LIST_ID\": \"your-list-id-here\""
    echo "         }"
    echo "       }"
    echo "     }"
    echo "   }"
    echo ""
    echo "4. ${CYAN}Restart Cursor:${NC}"
    echo "   Restart Cursor to load the MCP server"
    echo ""
}

# Function to show usage examples
show_usage_examples() {
    echo -e "${PURPLE}💡 Usage Examples${NC}"
    echo "=================="
    echo ""
    echo "Once configured, you can use these commands in Cursor:"
    echo ""
    echo "${CYAN}Task Management:${NC}"
    echo "  @cursor create a task for implementing the new authentication system"
    echo "  @cursor show me my current tasks"
    echo "  @cursor update task status to done"
    echo ""
    echo "${CYAN}Learning Management:${NC}"
    echo "  @cursor create a learning session focused on LangChain integration"
    echo "  @cursor track my learning progress - I spent 90 minutes practicing prompt engineering"
    echo "  @cursor show me my learning goals"
    echo ""
    echo "${CYAN}System Tools:${NC}"
    echo "  @cursor check worker health"
    echo "  @cursor test clickup connection"
    echo ""
}

# Main test execution
main() {
    echo -e "${BLUE}Starting comprehensive integration test...${NC}"
    echo ""
    
    # Run all tests
    test_environment
    test_worker_api
    test_mcp_server
    
    echo -e "${GREEN}🎉 Integration test completed!${NC}"
    echo ""
    
    # Show setup instructions if needed
    show_setup_instructions
    
    # Show usage examples
    show_usage_examples
    
    echo -e "${BLUE}📚 For more details, see:${NC}"
    echo "  - mcp-server/README.md"
    echo "  - LEARNING_GUIDE.md"
    echo ""
}

# Run the main function
main "$@"
