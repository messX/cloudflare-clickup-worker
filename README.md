## Cloudflare ClickUp Worker (Hosted, low/zero cost)

Hosted HTTP endpoints to manage ClickUp tasks without running a local server.

Endpoints
- POST /tasks.create → Create a task in a List
- GET /tasks.list → List tasks in a List
- POST /tasks.update → Update a task by id
- GET /clickup.me → Token check (returns user info)
- GET /health → Auth check (secret only)

Secrets
- CLICKUP_API_TOKEN: ClickUp personal token (no "Bearer ")
- PD_SHARED_SECRET: shared secret for requests
- CLICKUP_DEFAULT_LIST_ID (optional): default List ID for create/list/cron

Setup
1) Prereqs: `npm i -g wrangler`, Cloudflare account, `wrangler login`
2) Set secrets (prod):
```
echo -n '<your_token>' | wrangler secret put CLICKUP_API_TOKEN --name clickup-workers
echo -n '<your_secret>' | wrangler secret put PD_SHARED_SECRET --name clickup-workers
echo -n '<list_id>'     | wrangler secret put CLICKUP_DEFAULT_LIST_ID --name clickup-workers
```
3) Dev:
```
cp .dev.vars.example .dev.vars
# fill values
wrangler dev
```
4) Deploy:
```
wrangler deploy
```

Test
```
BASE='https://<your-worker>'
SECRET='<your_secret>'
bash scripts/smoke_test.sh
```

Cron
- ~~Defined in `wrangler.toml` (Mon 09:00 UTC). Adjust under `[triggers].crons`.~~
- **Removed** - Using MCP server for direct control instead


