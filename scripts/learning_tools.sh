#!/bin/bash
set -euo pipefail

# Learning Tools for Cloudflare ClickUp Worker
# This script provides easy access to learning features

BASE_URL=${BASE_URL:-"https://clickup-workers.dhandedhan.workers.dev"}
SECRET=${SECRET:-""}

if [[ -z "$SECRET" ]]; then
    echo "❌ Error: SECRET environment variable is required"
    echo "Set it with: export SECRET='your-shared-secret'"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=${3:-""}
    
    if [[ -n "$data" ]]; then
        curl -sS -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-Webhook-Secret: $SECRET" \
            -d "$data" \
            "$BASE_URL$endpoint" | jq .
    else
        curl -sS -X "$method" \
            -H "X-Webhook-Secret: $SECRET" \
            "$BASE_URL$endpoint" | jq .
    fi
}

# Function to create a weekly learning session
create_weekly_session() {
    echo -e "${BLUE}📚 Creating Weekly Learning Session...${NC}"
    
    local objectives=(
        "🔍 Explore new LLM capabilities and use cases"
        "💻 Practice prompt engineering and optimization"
        "🚀 Build or improve a productivity tool/script"
        "📚 Research emerging AI/ML trends and applications"
        "🔄 Review and optimize existing workflows"
    )
    
    local data=$(cat <<EOF
{
    "objectives": $(printf '%s\n' "${objectives[@]}" | jq -R . | jq -s .)
}
EOF
)
    
    api_call "POST" "/learning/weekly" "$data"
}

# Function to track learning progress
track_progress() {
    echo -e "${GREEN}📊 Tracking Learning Progress...${NC}"
    
    read -p "⏱️  Time spent (minutes): " time_spent
    read -p "🎯 Skills practiced (comma-separated): " skills_input
    read -p "🏆 Achievements (comma-separated): " achievements_input
    read -p "📝 Session type: " session_type
    read -p "🎯 Focus area: " focus_area
    read -p "🔄 Next steps: " next_steps
    
    # Convert comma-separated strings to arrays
    local skills=($(echo "$skills_input" | tr ',' '\n' | jq -R . | jq -s .))
    local achievements=($(echo "$achievements_input" | tr ',' '\n' | jq -R . | jq -s .))
    
    local data=$(cat <<EOF
{
    "progress": {
        "timeSpent": $time_spent,
        "skills": $skills,
        "achievements": $achievements
    },
    "sessionType": "$session_type",
    "focusArea": "$focus_area",
    "nextSteps": "$next_steps"
}
EOF
)
    
    api_call "POST" "/learning/track" "$data"
}

# Function to view learning goals
view_goals() {
    echo -e "${PURPLE}🎯 Current Learning Goals:${NC}"
    api_call "GET" "/learning/goals"
}

# Function to create a custom learning task
create_custom_task() {
    echo -e "${CYAN}✏️  Creating Custom Learning Task...${NC}"
    
    read -p "📝 Task title: " title
    read -p "📄 Description: " description
    read -p "🏷️  Tags (comma-separated): " tags_input
    read -p "📅 Due date (YYYY-MM-DD, optional): " due_date
    
    local tags=($(echo "$tags_input" | tr ',' '\n' | jq -R . | jq -s .))
    
    local data=$(cat <<EOF
{
    "title": "$title",
    "description": "$description",
    "tags": $tags
EOF
)
    
    if [[ -n "$due_date" ]]; then
        data="$data,\n    \"due_date\": \"$due_date\""
    fi
    
    data="$data\n}"
    
    api_call "POST" "/tasks.create" "$data"
}

# Function to list learning tasks
list_learning_tasks() {
    echo -e "${YELLOW}📋 Learning Tasks:${NC}"
    api_call "GET" "/tasks.list?statuses=to%20do,in%20progress&limit=10"
}

# Function to check worker health
check_health() {
    echo -e "${GREEN}🏥 Checking Worker Health...${NC}"
    api_call "GET" "/health"
}

# Function to test ClickUp connection
test_clickup() {
    echo -e "${BLUE}🔗 Testing ClickUp Connection...${NC}"
    api_call "GET" "/clickup.me"
}

# Function to show learning resources
show_resources() {
    echo -e "${PURPLE}📚 Learning Resources & Ideas:${NC}"
    echo ""
    echo -e "${CYAN}🎯 LLM Learning Path:${NC}"
    echo "1. Prompt Engineering Fundamentals"
    echo "   - OpenAI Playground: https://platform.openai.com/playground"
    echo "   - Anthropic Claude: https://claude.ai/"
    echo "   - Learn prompting: https://www.promptingguide.ai/"
    echo ""
    echo "2. LLM Integration & APIs"
    echo "   - OpenAI API docs: https://platform.openai.com/docs"
    echo "   - LangChain: https://python.langchain.com/"
    echo "   - LlamaIndex: https://docs.llamaindex.ai/"
    echo ""
    echo "3. Productivity Automation"
    echo "   - GitHub Copilot: https://github.com/features/copilot"
    echo "   - Cursor IDE: https://cursor.sh/"
    echo "   - Zapier AI: https://zapier.com/ai"
    echo ""
    echo "4. Emerging Tech Tracking"
    echo "   - Papers With Code: https://paperswithcode.com/"
    echo "   - arXiv AI: https://arxiv.org/list/cs.AI/recent"
    echo "   - AI News: https://www.artificialintelligence-news.com/"
    echo ""
    echo -e "${YELLOW}💡 Weekly Learning Ideas:${NC}"
    echo "• Build a custom ChatGPT plugin"
    echo "• Create an automated email responder"
    echo "• Develop a code review assistant"
    echo "• Build a meeting summarizer"
    echo "• Create a document Q&A system"
    echo "• Develop a task prioritization tool"
}

# Function to show usage
show_usage() {
    echo -e "${BLUE}🚀 Learning Tools Usage:${NC}"
    echo ""
    echo "Available commands:"
    echo "  weekly     - Create a weekly learning session"
    echo "  track      - Track your learning progress"
    echo "  goals      - View learning goals"
    echo "  custom     - Create a custom learning task"
    echo "  list       - List learning tasks"
    echo "  health     - Check worker health"
    echo "  test       - Test ClickUp connection"
    echo "  resources  - Show learning resources"
    echo "  help       - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL   - Worker base URL (default: https://clickup-workers.dhandedhan.workers.dev)"
    echo "  SECRET     - Shared secret for authentication (required)"
    echo ""
    echo "Examples:"
    echo "  export SECRET='your-secret'"
    echo "  ./learning_tools.sh weekly"
    echo "  ./learning_tools.sh track"
}

# Main script logic
case "${1:-help}" in
    "weekly")
        create_weekly_session
        ;;
    "track")
        track_progress
        ;;
    "goals")
        view_goals
        ;;
    "custom")
        create_custom_task
        ;;
    "list")
        list_learning_tasks
        ;;
    "health")
        check_health
        ;;
    "test")
        test_clickup
        ;;
    "resources")
        show_resources
        ;;
    "help"|*)
        show_usage
        ;;
esac
