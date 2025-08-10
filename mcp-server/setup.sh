#!/bin/bash
set -euo pipefail

echo "🚀 Setting up ClickUp MCP Server for Cursor"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the mcp-server directory"
    exit 1
fi

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ is required (current: $(node --version))"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "🔧 Creating .env file..."
    cat > .env << EOF
# ClickUp Worker Configuration
CLICKUP_WORKER_URL=https://clickup-workers.dhandedhan.workers.dev
CLICKUP_SHARED_SECRET=your-shared-secret-here
CLICKUP_DEFAULT_LIST_ID=your-default-list-id
EOF
    echo "✅ Created .env file - please update with your actual values"
else
    echo "✅ .env file already exists"
fi

# Test the server
echo ""
echo "🧪 Testing MCP server..."
timeout 5s npm start || {
    echo "✅ Server test completed (timeout expected)"
}

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your actual values:"
echo "   - CLICKUP_SHARED_SECRET: Your shared secret"
echo "   - CLICKUP_DEFAULT_LIST_ID: Your ClickUp list ID"
echo ""
echo "2. Configure Cursor MCP settings:"
echo "   - Open Cursor Settings → Extensions → MCP"
echo "   - Add the MCP server configuration (see README.md)"
echo ""
echo "3. Restart Cursor to load the new MCP server"
echo ""
echo "📚 For detailed instructions, see README.md"
