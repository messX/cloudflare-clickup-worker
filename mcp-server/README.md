# 🚀 ClickUp MCP Server for Cursor

This MCP (Model Context Protocol) server integrates your Cloudflare ClickUp Worker with Cursor, allowing you to manage ClickUp tasks directly within your IDE.

## 🎯 **What This Gives You**

With this MCP server, you can use ClickUp tools directly in Cursor:

- ✅ **Create tasks** while coding
- 📋 **List and view tasks** without leaving your IDE
- 🔄 **Update task status** and details
- 📚 **Create learning sessions** with structured objectives
- 📊 **Track learning progress** with detailed metrics
- 🎯 **View learning goals** and objectives
- 🏥 **Check worker health** and connection status

## 🛠️ **Setup Instructions**

### **1. Install Dependencies**

```bash
cd mcp-server
npm install
```

### **2. Configure Environment Variables**

Create a `.env` file in the `mcp-server` directory:

```bash
# ClickUp Worker Configuration
CLICKUP_WORKER_URL=https://clickup-workers.dhandedhan.workers.dev
CLICKUP_SHARED_SECRET=your-shared-secret-here
CLICKUP_DEFAULT_LIST_ID=your-default-list-id
```

### **3. Test the MCP Server**

```bash
# Test the server locally
npm start
```

You should see: `ClickUp MCP Server started`

### **4. Configure Cursor MCP Settings**

1. Open Cursor
2. Go to **Settings** → **Extensions** → **MCP**
3. Add a new MCP server configuration:

```json
{
  "mcpServers": {
    "clickup": {
      "command": "node",
      "args": ["/path/to/your/cloudflare-clickup-worker/mcp-server/clickup-mcp.js"],
      "env": {
        "CLICKUP_WORKER_URL": "https://clickup-workers.dhandedhan.workers.dev",
        "CLICKUP_SHARED_SECRET": "your-shared-secret-here",
        "CLICKUP_DEFAULT_LIST_ID": "your-default-list-id"
      }
    }
  }
}
```

**Replace the path** with the actual path to your `clickup-mcp.js` file.

### **5. Restart Cursor**

Restart Cursor to load the new MCP server configuration.

## 🎯 **Available Tools**

Once configured, you'll have access to these tools in Cursor:

### **Task Management**
- `create_task` - Create new ClickUp tasks
- `list_tasks` - List and filter tasks
- `update_task` - Update existing tasks

### **Learning Management**
- `create_learning_session` - Create structured learning sessions
- `track_learning_progress` - Track learning progress with metrics
- `get_learning_goals` - View current learning goals

### **System Tools**
- `check_worker_health` - Check worker status
- `test_clickup_connection` - Test ClickUp authentication

## 💡 **Usage Examples**

### **Creating a Task While Coding**

When you're working on a feature and want to create a task:

```
@cursor create a task for implementing the new authentication system
```

The AI will use the `create_task` tool to create a task in ClickUp.

### **Tracking Learning Progress**

After a learning session:

```
@cursor track my learning progress - I spent 90 minutes practicing prompt engineering and built a working API integration
```

The AI will use the `track_learning_progress` tool to log your progress.

### **Creating Learning Sessions**

```
@cursor create a learning session focused on LangChain and building AI agents
```

The AI will create a structured learning session with appropriate objectives.

### **Checking Task Status**

```
@cursor show me my current tasks
```

The AI will use the `list_tasks` tool to show your active tasks.

## 🔧 **Advanced Configuration**

### **Custom List IDs**

You can specify different list IDs for different types of tasks:

```json
{
  "mcpServers": {
    "clickup": {
      "command": "node",
      "args": ["/path/to/clickup-mcp.js"],
      "env": {
        "CLICKUP_WORKER_URL": "https://clickup-workers.dhandedhan.workers.dev",
        "CLICKUP_SHARED_SECRET": "your-secret",
        "CLICKUP_DEFAULT_LIST_ID": "901610333557"
      }
    }
  }
}
```

### **Multiple Environments**

You can set up different configurations for different environments:

```json
{
  "mcpServers": {
    "clickup-dev": {
      "command": "node",
      "args": ["/path/to/clickup-mcp.js"],
      "env": {
        "CLICKUP_WORKER_URL": "https://clickup-workers-staging.dhandedhan.workers.dev",
        "CLICKUP_SHARED_SECRET": "dev-secret",
        "CLICKUP_DEFAULT_LIST_ID": "dev-list-id"
      }
    },
    "clickup-prod": {
      "command": "node",
      "args": ["/path/to/clickup-mcp.js"],
      "env": {
        "CLICKUP_WORKER_URL": "https://clickup-workers.dhandedhan.workers.dev",
        "CLICKUP_SHARED_SECRET": "prod-secret",
        "CLICKUP_DEFAULT_LIST_ID": "prod-list-id"
      }
    }
  }
}
```

## 🚀 **Learning Workflow Integration**

### **Daily Learning Routine**

1. **Morning Planning**: Use `get_learning_goals` to review objectives
2. **Session Creation**: Use `create_learning_session` for focused learning
3. **Progress Tracking**: Use `track_learning_progress` after sessions
4. **Task Management**: Use `create_task` for follow-up items

### **Project-Based Learning**

1. Create learning tasks for each project phase
2. Track time spent on different skills
3. Document achievements and milestones
4. Plan next steps and follow-ups

## 🔍 **Troubleshooting**

### **Server Won't Start**

1. Check Node.js version (requires 18+)
2. Verify dependencies are installed: `npm install`
3. Check environment variables are set correctly

### **Tools Not Available in Cursor**

1. Verify MCP configuration in Cursor settings
2. Restart Cursor after configuration changes
3. Check server logs for errors

### **Authentication Errors**

1. Verify `CLICKUP_SHARED_SECRET` is correct
2. Check `CLICKUP_WORKER_URL` is accessible
3. Test worker health: `check_worker_health`

### **Task Creation Fails**

1. Verify `CLICKUP_DEFAULT_LIST_ID` is valid
2. Check ClickUp API token has proper permissions
3. Test connection: `test_clickup_connection`

## 📚 **Integration with Your Learning Setup**

This MCP server works seamlessly with your existing Cloudflare ClickUp Worker:

- **Automated weekly sessions** still run via cron
- **Manual tools** are now available in Cursor
- **Progress tracking** can be done contextually while coding
- **Task management** integrates with your development workflow

## 🎉 **Benefits for Learning**

- **Contextual task creation** while coding
- **Seamless progress tracking** without context switching
- **Integrated learning workflow** within your development environment
- **Real-time task management** without leaving your IDE
- **Structured learning sessions** with AI assistance

---

*This MCP server transforms your development workflow by bringing ClickUp task management directly into Cursor, making it easier to track learning progress and manage tasks while coding.*
