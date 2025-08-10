#!/bin/bash
set -euo pipefail

echo "🔐 Setting up GitHub Secrets for CI/CD"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

echo "📋 Required Secrets:"
echo "1. CF_API_TOKEN - Cloudflare API token for deployment"
echo "2. PD_SHARED_SECRET - Shared secret for request authentication"
echo "3. CLICKUP_API_TOKEN - ClickUp personal token"
echo "4. CLICKUP_DEFAULT_LIST_ID - Default ClickUp list ID"
echo "5. WORKER_BASE_URL - Base URL for smoke testing"
echo ""

echo "🚀 Let's set them up one by one:"
echo ""

# CF_API_TOKEN
echo "1️⃣  CF_API_TOKEN (Cloudflare API Token)"
echo "   - Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "   - Create a token with 'Cloudflare Workers' permissions"
echo "   - Copy the token and paste it below:"
read -s -p "   Enter CF_API_TOKEN: " cf_token
echo ""
if [ -n "$cf_token" ]; then
    echo "$cf_token" | gh secret set CF_API_TOKEN
    echo "   ✅ CF_API_TOKEN set"
else
    echo "   ⚠️  Skipped CF_API_TOKEN"
fi
echo ""

# PD_SHARED_SECRET
echo "2️⃣  PD_SHARED_SECRET (Shared Secret)"
echo "   - This should be a secure random string for authentication"
echo "   - Generate one with: openssl rand -hex 32"
echo "   - Or use any secure random string"
read -s -p "   Enter PD_SHARED_SECRET: " pd_secret
echo ""
if [ -n "$pd_secret" ]; then
    echo "$pd_secret" | gh secret set PD_SHARED_SECRET
    echo "   ✅ PD_SHARED_SECRET set"
else
    echo "   ⚠️  Skipped PD_SHARED_SECRET"
fi
echo ""

# CLICKUP_API_TOKEN
echo "3️⃣  CLICKUP_API_TOKEN (ClickUp Personal Token)"
echo "   - Go to: https://app.clickup.com/settings/apps"
echo "   - Create a new app or use existing personal token"
echo "   - Copy the token and paste it below:"
read -s -p "   Enter CLICKUP_API_TOKEN: " clickup_token
echo ""
if [ -n "$clickup_token" ]; then
    echo "$clickup_token" | gh secret set CLICKUP_API_TOKEN
    echo "   ✅ CLICKUP_API_TOKEN set"
else
    echo "   ⚠️  Skipped CLICKUP_API_TOKEN"
fi
echo ""

# CLICKUP_DEFAULT_LIST_ID
echo "4️⃣  CLICKUP_DEFAULT_LIST_ID (ClickUp List ID)"
echo "   - Go to your ClickUp list"
echo "   - The list ID is in the URL: https://app.clickup.com/[workspace]/v/li/[list-id]"
echo "   - Copy the list ID and paste it below:"
read -p "   Enter CLICKUP_DEFAULT_LIST_ID: " list_id
if [ -n "$list_id" ]; then
    echo "$list_id" | gh secret set CLICKUP_DEFAULT_LIST_ID
    echo "   ✅ CLICKUP_DEFAULT_LIST_ID set"
else
    echo "   ⚠️  Skipped CLICKUP_DEFAULT_LIST_ID"
fi
echo ""

# WORKER_BASE_URL
echo "5️⃣  WORKER_BASE_URL (Worker Base URL)"
echo "   - This will be: https://clickup-workers.[your-subdomain].workers.dev"
echo "   - Or your custom domain if you have one"
echo "   - The worker will be deployed to: clickup-workers"
read -p "   Enter WORKER_BASE_URL: " worker_url
if [ -n "$worker_url" ]; then
    echo "$worker_url" | gh secret set WORKER_BASE_URL
    echo "   ✅ WORKER_BASE_URL set"
else
    echo "   ⚠️  Skipped WORKER_BASE_URL"
fi
echo ""

echo "🎉 Secret setup complete!"
echo ""
echo "📋 Summary of secrets set:"
gh secret list
echo ""
echo "🚀 Next steps:"
echo "1. Push a change to the main branch to trigger deployment"
echo "2. Check the Actions tab in your GitHub repository"
echo "3. Monitor the deployment logs"
echo ""
echo "💡 To test locally:"
echo "1. Copy .dev.vars.example to .dev.vars"
echo "2. Fill in your local values"
echo "3. Run: wrangler dev"
