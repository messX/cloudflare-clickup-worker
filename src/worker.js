export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const requestId = generateRequestId();
    
    console.log(`[${requestId}] ${method} ${url.pathname} - Request started`);
    
    // Log request details (without sensitive data)
    console.log(`[${requestId}] Headers: ${JSON.stringify({
      'user-agent': request.headers.get('user-agent'),
      'content-type': request.headers.get('content-type'),
      'content-length': request.headers.get('content-length')
    })}`);

    const secret = request.headers.get("X-Webhook-Secret");
    if (!secret || secret !== env.PD_SHARED_SECRET) {
      console.log(`[${requestId}] Authentication failed - Invalid or missing secret`);
      return json({ 
        error: "unauthorized", 
        message: "Invalid or missing X-Webhook-Secret header",
        requestId 
      }, 401);
    }

    console.log(`[${requestId}] Authentication successful`);

    try {
      let response;
      
      if (url.pathname === "/health" && method === "GET") {
        console.log(`[${requestId}] Health check requested`);
        response = json({ ok: true, timestamp: new Date().toISOString(), requestId });
      } else if (url.pathname === "/clickup.me" && method === "GET") {
        console.log(`[${requestId}] ClickUp user info requested`);
        response = await handleMe(env, requestId);
      } else if (url.pathname === "/tasks.create" && method === "POST") {
        console.log(`[${requestId}] Task creation requested`);
        const body = await request.json();
        console.log(`[${requestId}] Task creation payload: ${JSON.stringify({ title: body.title, list_id: body.list_id })}`);
        response = await handleCreate(body, env, requestId);
      } else if (url.pathname === "/tasks.list" && method === "GET") {
        console.log(`[${requestId}] Task listing requested`);
        const query = Object.fromEntries(url.searchParams.entries());
        console.log(`[${requestId}] Task listing query: ${JSON.stringify(query)}`);
        response = await handleList(query, env, requestId);
      } else if (url.pathname === "/tasks.update" && method === "POST") {
        console.log(`[${requestId}] Task update requested`);
        const body = await request.json();
        console.log(`[${requestId}] Task update payload: ${JSON.stringify({ id: body.id, title: body.title })}`);
        response = await handleUpdate(body, env, requestId);
      } else if (url.pathname === "/tasks.delete" && method === "POST") {
        console.log(`[${requestId}] Task deletion requested`);
        const body = await request.json();
        console.log(`[${requestId}] Task deletion payload: ${JSON.stringify({ id: body.id })}`);
        response = await handleDelete(body, env, requestId);
      } else if (url.pathname === "/learning/weekly" && method === "POST") {
        console.log(`[${requestId}] Weekly learning session creation requested`);
        const body = await request.json();
        console.log(`[${requestId}] Learning session payload: ${JSON.stringify({ objectives: body.objectives?.length })}`);
        response = await createWeeklyLearningTask(body, env, requestId);
      } else if (url.pathname === "/learning/track" && method === "POST") {
        console.log(`[${requestId}] Learning progress tracking requested`);
        const body = await request.json();
        console.log(`[${requestId}] Progress tracking payload: ${JSON.stringify({ time_spent: body.progress?.timeSpent })}`);
        response = await trackLearningProgress(body, env, requestId);
      } else if (url.pathname === "/learning/goals" && method === "GET") {
        console.log(`[${requestId}] Learning goals requested`);
        response = await getLearningGoals(env, requestId);
      } else if (url.pathname === "/learning/goals" && method === "POST") {
        console.log(`[${requestId}] Learning goals update requested`);
        const body = await request.json();
        console.log(`[${requestId}] Goals update payload: ${JSON.stringify({ goals_count: body.goals?.length })}`);
        response = await setLearningGoals(body, env, requestId);
      } else {
        console.log(`[${requestId}] Endpoint not found: ${url.pathname}`);
        response = json({ 
          error: "not found", 
          message: `Endpoint ${url.pathname} not found`,
          availableEndpoints: [
            "/health",
            "/clickup.me", 
            "/tasks.create",
            "/tasks.list",
            "/tasks.update",
            "/tasks.delete",
            "/learning/weekly",
            "/learning/track",
            "/learning/goals"
          ],
          requestId 
        }, 404);
      }
      
      console.log(`[${requestId}] Request completed successfully`);
      return response;
      
    } catch (e) {
      console.error(`[${requestId}] Request failed with error:`, e);
      console.error(`[${requestId}] Error stack:`, e.stack);
      
      // Safely stringify error details
      const errorDetails = process.env.NODE_ENV === 'development' ? safeStringifyError(e) : undefined;
      
      return json({ 
        error: "internal_server_error",
        message: "An unexpected error occurred",
        details: errorDetails,
        requestId,
        timestamp: new Date().toISOString()
      }, 500);
    }
  },
  // Scheduled function removed - using MCP server for direct control instead
  // async scheduled(event, env, ctx) {
  //   try { await createWeeklyTask(env); } catch (e) { console.log(`[cron] error:`, e); }
  // },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { 
    status, 
    headers: { 
      "Content-Type": "application/json",
      "X-Request-ID": data.requestId || "unknown"
    } 
  });
}

function generateRequestId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function handleMe(env, requestId) {
  console.log(`[${requestId}] Starting ClickUp user info request`);
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: /api/v2/user`);
    const resp = await fetch("https://api.clickup.com/api/v2/user", { 
      headers: { Authorization: token, "Content-Type": "application/json" } 
    });
    
    const data = await resp.json();
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to fetch user info from ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    console.log(`[${requestId}] ClickUp user info retrieved successfully`);
    return json({ 
      user: { 
        id: data.user?.id, 
        username: data.user?.username, 
        email: data.user?.email 
      },
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function handleCreate(body, env, requestId) {
  console.log(`[${requestId}] Starting task creation`);
  
  const listId = body.list_id || env.CLICKUP_DEFAULT_LIST_ID;
  if (!listId) {
    console.log(`[${requestId}] Error: list_id required`);
    return json({ 
      error: "validation_error", 
      message: "list_id required",
      requestId 
    }, 400);
  }
  
  if (!body.title) {
    console.log(`[${requestId}] Error: title required`);
    return json({ 
      error: "validation_error", 
      message: "title required",
      requestId 
    }, 400);
  }
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  const payload = { 
    name: body.title, 
    description: body.description, 
    status: body.status, 
    assignees: body.assignees, 
    priority: body.priority, 
    tags: body.tags, 
    custom_fields: body.custom_fields 
  };
  
  if (body.due_date !== undefined) payload.due_date = String(body.due_date);
  
  console.log(`[${requestId}] Task creation payload prepared:`, JSON.stringify(payload, null, 2));
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: POST /api/v2/list/${listId}/task`);
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, { 
      method: "POST", 
      headers: { Authorization: token, "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    const data = await resp.json();
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to create task in ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    console.log(`[${requestId}] Task created successfully with ID: ${data.id}`);
    return json({ 
      id: data.id, 
      url: data.url, 
      status: data.status?.status, 
      title: data.name,
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function handleList(query, env, requestId) {
  console.log(`[${requestId}] Starting task listing`);
  
  const listId = query.list_id || env.CLICKUP_DEFAULT_LIST_ID;
  if (!listId) {
    console.log(`[${requestId}] Error: list_id required`);
    return json({ 
      error: "validation_error", 
      message: "list_id required",
      requestId 
    }, 400);
  }
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  const params = new URLSearchParams();
  if (query.statuses) {
    const statuses = query.statuses.split(",").map((s) => s.trim()).filter(Boolean);
    statuses.forEach((s) => params.append("statuses[]", s));
    console.log(`[${requestId}] Filtering by statuses:`, statuses);
  }
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  
  console.log(`[${requestId}] Query parameters:`, params.toString());
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: GET /api/v2/list/${listId}/task`);
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${params}`, { 
      headers: { Authorization: token, "Content-Type": "application/json" } 
    });
    
    const data = await resp.json();
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to fetch tasks from ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    const tasks = (data.tasks || []).map((t) => ({ 
      id: t.id, 
      title: t.name, 
      status: t.status?.status, 
      due_date: t.due_date ? Number(t.due_date) : null, 
      assignees: (t.assignees || []).map((a) => a.id), 
      url: t.url 
    }));
    
    console.log(`[${requestId}] Retrieved ${tasks.length} tasks successfully`);
    return json({ 
      tasks,
      total: tasks.length,
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function handleUpdate(body, env, requestId) {
  console.log(`[${requestId}] Starting task update`);
  
  const taskId = body.id;
  if (!taskId) {
    console.log(`[${requestId}] Error: id required`);
    return json({ 
      error: "validation_error", 
      message: "id required",
      requestId 
    }, 400);
  }
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  const payload = {};
  if (body.title !== undefined) payload.name = body.title;
  if (body.description !== undefined) payload.description = body.description;
  if (body.status !== undefined) payload.status = body.status;
  if (body.due_date !== undefined) payload.due_date = String(body.due_date);
  if (body.assignees !== undefined) payload.assignees = body.assignees;
  if (body.priority !== undefined) payload.priority = body.priority;
  if (body.tags !== undefined) payload.tags = body.tags;
  if (body.custom_fields !== undefined) payload.custom_fields = body.custom_fields;
  
  console.log(`[${requestId}] Task update payload:`, JSON.stringify(payload, null, 2));
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: PUT /api/v2/task/${taskId}`);
    const resp = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, { 
      method: "PUT", 
      headers: { Authorization: token, "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    const data = await resp.json();
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to update task in ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    console.log(`[${requestId}] Task updated successfully`);
    return json({ 
      id: data.id, 
      url: data.url, 
      status: data.status?.status, 
      title: data.name,
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function handleDelete(body, env, requestId) {
  console.log(`[${requestId}] Starting task deletion`);
  
  const taskId = body.id;
  if (!taskId) {
    console.log(`[${requestId}] Error: id required`);
    return json({ 
      error: "validation_error", 
      message: "id required",
      requestId 
    }, 400);
  }
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: DELETE /api/v2/task/${taskId}`);
    const resp = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, { 
      method: "DELETE", 
      headers: { Authorization: token, "Content-Type": "application/json" } 
    });
    
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      let data;
      try {
        data = await resp.json();
      } catch (e) {
        data = { error: "Unknown error", status: resp.status };
      }
      
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to delete task in ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    console.log(`[${requestId}] Task deleted successfully`);
    return json({ 
      message: "Task deleted successfully", 
      id: taskId,
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function createWeeklyLearningTask(body, env, requestId) {
  console.log(`[${requestId}] Starting weekly learning session creation`);
  
  const listId = body.list_id || env.CLICKUP_DEFAULT_LIST_ID;
  if (!listId) {
    console.log(`[${requestId}] Error: list_id required`);
    return json({ 
      error: "validation_error", 
      message: "list_id required",
      requestId 
    }, 400);
  }
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  
  // Enhanced learning task with structured objectives
  const learningObjectives = body.objectives || [
    "🔍 Explore new LLM capabilities and use cases",
    "💻 Practice prompt engineering and optimization",
    "🚀 Build or improve a productivity tool/script",
    "📚 Research emerging AI/ML trends and applications",
    "🔄 Review and optimize existing workflows"
  ];
  
  const description = `## Weekly Learning Session ${yyyy}-${mm}-${dd}

### 🎯 Learning Objectives:
${learningObjectives.map(obj => `- ${obj}`).join('\n')}

### 📝 Session Notes:
- What did you learn today?
- What challenges did you encounter?
- What will you apply next week?

### 🔗 Resources:
- Add relevant links, articles, or tools here

### ✅ Action Items:
- [ ] Complete at least one learning objective
- [ ] Document key insights
- [ ] Plan next week's focus area

---
*Generated by Cloudflare ClickUp Worker*`;

  const payload = {
    name: `Weekly LLM Learning Session ${yyyy}-${mm}-${dd}`,
    description: description,
    status: "to do",
    tags: ["learning", "weekly", "llm", "productivity"],
    priority: 2 // High priority
  };
  
  console.log(`[${requestId}] Weekly learning session payload prepared:`, JSON.stringify(payload, null, 2));
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: POST /api/v2/list/${listId}/task`);
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await resp.json();
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to create weekly learning task in ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    console.log(`[${requestId}] Weekly learning task created successfully with ID: ${data.id}`);
    return json({
      id: data.id,
      url: data.url,
      status: data.status?.status,
      title: data.name,
      message: "Weekly learning task created successfully!",
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function trackLearningProgress(body, env, requestId) {
  console.log(`[${requestId}] Starting learning progress tracking`);
  
  const listId = body.list_id || env.CLICKUP_DEFAULT_LIST_ID;
  if (!listId) {
    console.log(`[${requestId}] Error: list_id required`);
    return json({ 
      error: "validation_error", 
      message: "list_id required",
      requestId 
    }, 400);
  }
  
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) {
    console.log(`[${requestId}] Error: CLICKUP_API_TOKEN not set`);
    return json({ 
      error: "configuration_error", 
      message: "CLICKUP_API_TOKEN not set",
      requestId 
    }, 400);
  }
  
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  
  const progressData = body.progress || {};
  const skills = progressData.skills || [];
  const timeSpent = progressData.timeSpent || 0;
  const achievements = progressData.achievements || [];
  
  const description = `## Learning Progress Log ${yyyy}-${mm}-${dd}

### ⏱️ Time Spent: ${timeSpent} minutes

### 🎯 Skills Practiced:
${skills.map(skill => `- ${skill}`).join('\n')}

### 🏆 Achievements:
${achievements.map(achievement => `- ${achievement}`).join('\n')}

### 📊 Progress Summary:
- Date: ${yyyy}-${mm}-${dd}
- Session Type: ${body.sessionType || 'General Learning'}
- Focus Area: ${body.focusArea || 'LLM & Productivity'}

### 🔄 Next Steps:
${body.nextSteps || '- Continue exploring current learning path'}

---
*Tracked via Cloudflare ClickUp Worker*`;

  const payload = {
    name: `Learning Progress - ${yyyy}-${mm}-${dd}`,
    description: description,
    status: "in progress",
    tags: ["learning", "progress", "tracking"],
    priority: 1
  };
  
  console.log(`[${requestId}] Learning progress tracking payload prepared:`, JSON.stringify(payload, null, 2));
  
  try {
    console.log(`[${requestId}] Calling ClickUp API: POST /api/v2/list/${listId}/task`);
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await resp.json();
    console.log(`[${requestId}] ClickUp API response status: ${resp.status}`);
    
    if (!resp.ok) {
      // Safely stringify ClickUp API error response
      let errorDetails;
      try {
        errorDetails = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { error: String(data) };
      } catch (stringifyError) {
        errorDetails = { error: "Error details could not be serialized", status: resp.status };
      }
      
      console.log(`[${requestId}] ClickUp API error:`, errorDetails);
      return json({ 
        error: "clickup_api_error",
        message: "Failed to track learning progress in ClickUp",
        details: errorDetails,
        requestId 
      }, resp.status);
    }
    
    console.log(`[${requestId}] Learning progress tracked successfully with ID: ${data.id}`);
    return json({
      id: data.id,
      url: data.url,
      status: data.status?.status,
      title: data.name,
      message: "Learning progress tracked successfully!",
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] ClickUp API call failed:`, error);
    return json({ 
      error: "network_error",
      message: "Failed to connect to ClickUp API",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function getLearningGoals(env, requestId) {
  console.log(`[${requestId}] Starting learning goals retrieval`);
  // For now, return default learning goals
  // In a real implementation, you might store these in a database or another service
  try {
    const goals = [
      {
        id: "llm-mastery",
        title: "LLM Mastery",
        description: "Become proficient in prompt engineering and LLM integration",
        progress: 0,
        targetDate: "2024-12-31"
      },
      {
        id: "productivity-automation",
        title: "Productivity Automation",
        description: "Build automated workflows and tools to boost productivity",
        progress: 0,
        targetDate: "2024-12-31"
      },
      {
        id: "emerging-tech",
        title: "Emerging Tech Tracking",
        description: "Stay updated with latest AI/ML developments and applications",
        progress: 0,
        targetDate: "2024-12-31"
      }
    ];
    console.log(`[${requestId}] Retrieved default learning goals successfully`);
    return json({
      goals,
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] Error retrieving default learning goals:`, error);
    return json({ 
      error: "internal_server_error",
      message: "Failed to retrieve default learning goals",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

async function setLearningGoals(body, env, requestId) {
  // This would typically save to a database
  // For now, just return success
  console.log(`[${requestId}] Starting learning goals update`);
  try {
    const updatedGoals = body.goals || [];
    console.log(`[${requestId}] Received goals for update:`, updatedGoals);
    return json({
      message: "Learning goals updated successfully!",
      goals: updatedGoals,
      requestId 
    });
  } catch (error) {
    console.error(`[${requestId}] Error updating learning goals:`, error);
    return json({ 
      error: "internal_server_error",
      message: "Failed to update learning goals",
      details: safeStringifyError(error),
      requestId 
    }, 500);
  }
}

// createWeeklyTask function removed - using MCP server for direct control instead
// The enhanced createWeeklyLearningTask function in the MCP server provides better functionality

function normalizeToken(t) {
  if (!t) return "";
  return String(t).replace(/^Bearer\s+/i, "").trim();
}

function safeStringifyError(error) {
  try {
    return {
      message: error.message || String(error),
      name: error.name,
      stack: error.stack
    };
  } catch (stringifyError) {
    return { message: "Error details could not be serialized" };
  }
}


