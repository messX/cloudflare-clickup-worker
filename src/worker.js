export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    const secret = request.headers.get("X-Webhook-Secret");
    if (!secret || secret !== env.PD_SHARED_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }

    try {
      if (url.pathname === "/health" && method === "GET") return json({ ok: true });
      if (url.pathname === "/clickup.me" && method === "GET") return await handleMe(env);
      if (url.pathname === "/tasks.create" && method === "POST") return await handleCreate(await request.json(), env);
      if (url.pathname === "/tasks.list" && method === "GET") return await handleList(Object.fromEntries(url.searchParams.entries()), env);
      if (url.pathname === "/tasks.update" && method === "POST") return await handleUpdate(await request.json(), env);
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    try { await createWeeklyTask(env); } catch (e) { console.log(`[cron] error:`, e); }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function handleMe(env) {
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) return json({ error: "CLICKUP_API_TOKEN not set" }, 400);
  const resp = await fetch("https://api.clickup.com/api/v2/user", { headers: { Authorization: token, "Content-Type": "application/json" } });
  const data = await resp.json();
  if (!resp.ok) return json({ error: data }, resp.status);
  return json({ user: { id: data.user?.id, username: data.user?.username, email: data.user?.email } });
}

async function handleCreate(body, env) {
  const listId = body.list_id || env.CLICKUP_DEFAULT_LIST_ID;
  if (!listId) return json({ error: "list_id required" }, 400);
  if (!body.title) return json({ error: "title required" }, 400);
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) return json({ error: "CLICKUP_API_TOKEN not set" }, 400);
  const payload = { name: body.title, description: body.description, status: body.status, assignees: body.assignees, priority: body.priority, tags: body.tags, custom_fields: body.custom_fields };
  if (body.due_date !== undefined) payload.due_date = String(body.due_date);
  const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await resp.json();
  if (!resp.ok) return json({ error: data }, resp.status);
  return json({ id: data.id, url: data.url, status: data.status?.status, title: data.name });
}

async function handleList(query, env) {
  const listId = query.list_id || env.CLICKUP_DEFAULT_LIST_ID;
  if (!listId) return json({ error: "list_id required" }, 400);
  const token = normalizeToken(env.CLICKUP_API_TOKEN);
  if (!token) return json({ error: "CLICKUP_API_TOKEN not set" }, 400);
  const params = new URLSearchParams();
  if (query.statuses) query.statuses.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => params.append("statuses[]", s));
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task?${params}`, { headers: { Authorization: token, "Content-Type": "application/json" } });
  const data = await resp.json();
  if (!resp.ok) return json({ error: data }, resp.status);
  const tasks = (data.tasks || []).map((t) => ({ id: t.id, title: t.name, status: t.status?.status, due_date: t.due_date ? Number(t.due_date) : null, assignees: (t.assignees || []).map((a) => a.id), url: t.url }));
  return json({ tasks });
}

async function handleUpdate(body, env) {
  const taskId = body.id; if (!taskId) return json({ error: "id required" }, 400);
  const token = normalizeToken(env.CLICKUP_API_TOKEN); if (!token) return json({ error: "CLICKUP_API_TOKEN not set" }, 400);
  const payload = {}; if (body.title !== undefined) payload.name = body.title; if (body.description !== undefined) payload.description = body.description; if (body.status !== undefined) payload.status = body.status; if (body.due_date !== undefined) payload.due_date = String(body.due_date); if (body.assignees !== undefined) payload.assignees = body.assignees; if (body.priority !== undefined) payload.priority = body.priority; if (body.tags !== undefined) payload.tags = body.tags; if (body.custom_fields !== undefined) payload.custom_fields = body.custom_fields;
  const resp = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, { method: "PUT", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await resp.json(); if (!resp.ok) return json({ error: data }, resp.status);
  return json({ id: data.id, url: data.url, status: data.status?.status, title: data.name });
}

async function createWeeklyTask(env) {
  const token = normalizeToken(env.CLICKUP_API_TOKEN); const listId = env.CLICKUP_DEFAULT_LIST_ID; if (!token || !listId) { console.log(`[cron] missing token or CLICKUP_DEFAULT_LIST_ID; skipping`); return; }
  const now = new Date(); const yyyy = now.getUTCFullYear(); const mm = String(now.getUTCMonth() + 1).padStart(2, "0"); const dd = String(now.getUTCDate()).padStart(2, "0");
  const payload = { name: `Weekly LLM Session ${yyyy}-${mm}-${dd}`, status: "to do", tags: ["learning", "weekly"] };
  const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!resp.ok) { console.log(`[cron] create failed: ${resp.status} ${await resp.text()}`); return; }
  const data = await resp.json(); console.log(`[cron] created weekly task id=${data.id}`);
}

function normalizeToken(t) { if (!t) return ""; return String(t).replace(/^Bearer\s+/i, "").trim(); }


