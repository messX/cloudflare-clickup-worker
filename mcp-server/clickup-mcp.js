#!/usr/bin/env node

/**
 * ClickUp MCP Server for Cursor
 * 
 * This MCP server provides ClickUp task management tools directly in Cursor,
 * integrating with your Cloudflare ClickUp Worker.
 * 
 * Usage:
 * 1. Install: npm install -g @modelcontextprotocol/sdk
 * 2. Run: node clickup-mcp.js
 * 3. Configure in Cursor MCP settings
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Configuration
const CONFIG = {
  WORKER_URL: process.env.CLICKUP_WORKER_URL || 'https://clickup-workers.dhandedhan.workers.dev',
  SHARED_SECRET: process.env.CLICKUP_SHARED_SECRET || '',
  DEFAULT_LIST_ID: process.env.CLICKUP_DEFAULT_LIST_ID || '',
};

// Helper function to make API calls to the worker
async function callWorker(endpoint, method = 'GET', data = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': CONFIG.SHARED_SECRET,
  };

  const options = {
    method,
    headers,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Worker API error: ${result.error || response.statusText}`);
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to call worker: ${error.message}`);
  }
}

// MCP Server setup
const server = new Server(
  {
    name: 'clickup-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool: Create a new ClickUp task
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_task',
        description: 'Create a new task in ClickUp',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title',
            },
            description: {
              type: 'string',
              description: 'Task description (supports markdown)',
            },
            status: {
              type: 'string',
              description: 'Task status (e.g., "to do", "in progress", "done")',
              enum: ['to do', 'in progress', 'done'],
            },
            priority: {
              type: 'number',
              description: 'Task priority (1=urgent, 2=high, 3=normal, 4=low)',
              enum: [1, 2, 3, 4],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for the task',
            },
            due_date: {
              type: 'string',
              description: 'Due date in YYYY-MM-DD format',
            },
            list_id: {
              type: 'string',
              description: 'ClickUp list ID (optional, uses default if not provided)',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'list_tasks',
        description: 'List tasks from ClickUp',
        inputSchema: {
          type: 'object',
          properties: {
            statuses: {
              type: 'string',
              description: 'Comma-separated list of statuses to filter by',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return',
              default: 10,
            },
            page: {
              type: 'number',
              description: 'Page number for pagination',
              default: 0,
            },
            list_id: {
              type: 'string',
              description: 'ClickUp list ID (optional, uses default if not provided)',
            },
          },
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing ClickUp task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID to update',
            },
            title: {
              type: 'string',
              description: 'New task title',
            },
            description: {
              type: 'string',
              description: 'New task description',
            },
            status: {
              type: 'string',
              description: 'New task status',
              enum: ['to do', 'in progress', 'done'],
            },
            priority: {
              type: 'number',
              description: 'New task priority',
              enum: [1, 2, 3, 4],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'New tags for the task',
            },
            due_date: {
              type: 'string',
              description: 'New due date in YYYY-MM-DD format',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a ClickUp task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID to delete',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_learning_session',
        description: 'Create a structured learning session task',
        inputSchema: {
          type: 'object',
          properties: {
            objectives: {
              type: 'array',
              items: { type: 'string' },
              description: 'Learning objectives for the session',
            },
            list_id: {
              type: 'string',
              description: 'ClickUp list ID (optional, uses default if not provided)',
            },
          },
        },
      },
      {
        name: 'track_learning_progress',
        description: 'Track learning progress and create a progress log',
        inputSchema: {
          type: 'object',
          properties: {
            time_spent: {
              type: 'number',
              description: 'Time spent learning in minutes',
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skills practiced during the session',
            },
            achievements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Achievements or milestones reached',
            },
            session_type: {
              type: 'string',
              description: 'Type of learning session',
              default: 'General Learning',
            },
            focus_area: {
              type: 'string',
              description: 'Main focus area for the session',
              default: 'LLM & Productivity',
            },
            next_steps: {
              type: 'string',
              description: 'Next steps or follow-up actions',
            },
            list_id: {
              type: 'string',
              description: 'ClickUp list ID (optional, uses default if not provided)',
            },
          },
          required: ['time_spent'],
        },
      },
      {
        name: 'get_learning_goals',
        description: 'Get current learning goals and objectives',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'check_worker_health',
        description: 'Check if the ClickUp worker is healthy and accessible',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'test_clickup_connection',
        description: 'Test the connection to ClickUp and verify authentication',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_task': {
        const result = await callWorker('/tasks.create', 'POST', {
          title: args.title,
          description: args.description,
          status: args.status,
          priority: args.priority,
          tags: args.tags,
          due_date: args.due_date,
          list_id: args.list_id || CONFIG.DEFAULT_LIST_ID,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Task created successfully!\n\n**Title:** ${result.title}\n**ID:** ${result.id}\n**Status:** ${result.status}\n**URL:** ${result.url}`,
            },
          ],
        };
      }

      case 'list_tasks': {
        const params = new URLSearchParams();
        if (args.statuses) params.append('statuses', args.statuses);
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.page) params.append('page', args.page.toString());
        if (args.list_id) params.append('list_id', args.list_id);
        else if (CONFIG.DEFAULT_LIST_ID) params.append('list_id', CONFIG.DEFAULT_LIST_ID);

        const result = await callWorker(`/tasks.list?${params.toString()}`);
        
        if (result.tasks && result.tasks.length > 0) {
          const taskList = result.tasks.map(task => 
            `- **${task.title}** (${task.status}) - ${task.url}`
          ).join('\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `📋 Found ${result.tasks.length} tasks:\n\n${taskList}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: '📋 No tasks found matching the criteria.',
              },
            ],
          };
        }
      }

      case 'update_task': {
        const result = await callWorker('/tasks.update', 'POST', {
          id: args.id,
          title: args.title,
          description: args.description,
          status: args.status,
          priority: args.priority,
          tags: args.tags,
          due_date: args.due_date,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Task updated successfully!\n\n**Title:** ${result.title}\n**ID:** ${result.id}\n**Status:** ${result.status}\n**URL:** ${result.url}`,
            },
          ],
        };
      }

      case 'delete_task': {
        const result = await callWorker('/tasks.delete', 'POST', {
          id: args.id,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `🗑️ Task deleted successfully!\n\n**ID:** ${result.id}\n**Message:** ${result.message}`,
            },
          ],
        };
      }

      case 'create_learning_session': {
        const result = await callWorker('/learning/weekly', 'POST', {
          objectives: args.objectives,
          list_id: args.list_id || CONFIG.DEFAULT_LIST_ID,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `📚 Learning session created successfully!\n\n**Title:** ${result.title}\n**ID:** ${result.id}\n**URL:** ${result.url}\n\n${result.message}`,
            },
          ],
        };
      }

      case 'track_learning_progress': {
        const result = await callWorker('/learning/track', 'POST', {
          progress: {
            timeSpent: args.time_spent,
            skills: args.skills || [],
            achievements: args.achievements || [],
          },
          sessionType: args.session_type,
          focusArea: args.focus_area,
          nextSteps: args.next_steps,
          list_id: args.list_id || CONFIG.DEFAULT_LIST_ID,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `📊 Learning progress tracked successfully!\n\n**Title:** ${result.title}\n**ID:** ${result.id}\n**URL:** ${result.url}\n\n${result.message}`,
            },
          ],
        };
      }

      case 'get_learning_goals': {
        const result = await callWorker('/learning/goals');
        
        const goalsList = result.goals.map(goal => 
          `- **${goal.title}**: ${goal.description} (Target: ${goal.targetDate})`
        ).join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `🎯 Current Learning Goals:\n\n${goalsList}`,
            },
          ],
        };
      }

      case 'check_worker_health': {
        const result = await callWorker('/health');
        
        return {
          content: [
            {
              type: 'text',
              text: `🏥 Worker Health Check: ${result.ok ? '✅ Healthy' : '❌ Unhealthy'}`,
            },
          ],
        };
      }

      case 'test_clickup_connection': {
        const result = await callWorker('/clickup.me');
        
        return {
          content: [
            {
              type: 'text',
              text: `🔗 ClickUp Connection Test:\n\n**User:** ${result.user.username}\n**Email:** ${result.user.email}\n**Status:** ✅ Connected`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('ClickUp MCP Server started');
