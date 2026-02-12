# Behavioral Insights - Session Notes

## Session Date: February 11, 2026

---

## Issue Addressed: Password Reset Database Error

### Problem
When attempting to reset a password for a registered account, the app returned this error:

```
Failed query: select "id", "email", "password", "name", "email_verified", "created_at", "updated_at" from "users" "users" where "users"."email" = $1 limit $2 params: pritish.sai@gmail.com,1
```

### Root Cause
The codebase was using `@vercel/postgres` package which is designed specifically for **Vercel's native PostgreSQL** (powered by Neon). However, the database is actually hosted on **Supabase PostgreSQL**.

The `@vercel/postgres` driver is incompatible with Supabase connections, causing all database queries to fail.

### Solution Applied
Switched from `@vercel/postgres` to `postgres` (postgres.js) driver which is compatible with Supabase.

#### Changes Made:

**1. Installed `postgres` package:**
```bash
npm install postgres
```

**2. Updated `src/lib/db.ts`:**
```typescript
// Before (broken)
import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import * as schema from './schema';

export const db = drizzle(sql, { schema });
export { schema };

// After (fixed)
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.POSTGRES_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
```

**3. Removed `@vercel/postgres` package:**
```bash
npm uninstall @vercel/postgres
```

**Note:** The `{ prepare: false }` option is important for Supabase since it uses transaction pooling mode by default, which doesn't support prepared statements.

---

## Git Configuration

- **Account:** Electromau5
- **Email:** pritish.sai@gmail.com
- **Repository:** https://github.com/Electromau5/behavioral-insights

### Initial Commit Pushed
All files were committed and force-pushed to GitHub with the message:
```
Initial commit: Next.js app with Supabase PostgreSQL

- Authentication with NextAuth.js (credentials provider)
- Drizzle ORM with postgres.js driver for Supabase compatibility
- Password reset flow with email tokens
- User registration and login
```

---

## Environment Variables (Vercel)

The app uses Supabase PostgreSQL. Key environment variables on Vercel:
- `POSTGRES_URL` - Supabase connection string
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`

---

## Claude Code MCP Configuration

### File Location
```
~/.claude/settings.json
```

### Vercel MCP Updated
Changed from HTTP-based OAuth to token-based authentication:

```json
"vercel": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "vercel-mcp"],
  "env": {
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    "VERCEL_API_TOKEN": "<your-vercel-api-token>"
  }
}
```

**Restart Claude Code** after this change for it to take effect.

---

## Security Issue Identified (Not Yet Fixed)

In `src/app/api/auth/forgot-password/route.ts` (lines 44-48), the catch block returns raw error messages to the client, which can expose SQL queries and user emails:

```typescript
} catch (error) {
  console.error('Forgot password error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ error: errorMessage }, { status: 500 });
}
```

**Recommendation:** Return a generic error message instead of the actual error details.

---

## Session Update: February 12, 2026

### Vercel Deployment Error - Node.js Version

**Problem:** Vercel deployments failing with error:
```
Found invalid Node.js Version: "24.x". Please set Node.js Version to 22.x in your Project Settings to use Node.js 22.
```

**Fix Applied:** Added `engines` field to `package.json`:
```json
"engines": {
  "node": "22.x"
}
```

**Status:** The `package.json` fix was committed and pushed, but Vercel project settings are overriding it. The Node.js version setting needs to be updated via:
- Vercel Dashboard (Settings → General → Node.js Version) - *user couldn't find this setting*
- OR via Vercel MCP tools after restarting Claude Code
- OR via Vercel API

**Recent Failed Deployments:**
- `behavioral-insights-hffshn4fe` (Feb 11, 22:17) - Error
- `behavioral-insights-b8zauqid8` (Feb 11, 11:59) - Error

**Last Successful Deployment:** `behavioral-insights-5cnsry3kg` (19 days ago)

---

### Claude Config Files Cleanup

**Issue:** Multiple Claude config files existed in different locations causing confusion.

**Action Taken:**
1. Merged MCPs from `~/.config/claude/claude_desktop_config.json` into the official Claude Desktop config
2. Deleted the orphaned config file at `~/.config/claude/claude_desktop_config.json`

**Official Config Locations:**
| App | Config Path |
|-----|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code CLI | `~/.claude/settings.json` |

**Claude Desktop MCPs (9 total after merge):**
- filesystem, github, notebooklm, apify, reddit, prediction-markets (original)
- cursor-mcp-server, vercel, instagram (added from orphaned file)

**Claude Code MCPs (4 total):**
- vercel, zeroheight, railway, notebooklm

---

## Session Update: February 12, 2026 (Continued)

### Vercel MCP Connection Fix

**Problem:** Vercel MCP was not appearing in connected MCPs after restarting Claude Code.

**Root Cause:** The `vercel-mcp` package expects the API key as a **command-line argument**, not an environment variable.

**Fix Applied to `~/.claude/settings.json`:**
```json
// Before (broken)
"vercel": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "vercel-mcp"],
  "env": {
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    "VERCEL_API_TOKEN": "<token>"
  }
}

// After (fixed)
"vercel": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "vercel-mcp", "VERCEL_API_KEY=<token>"],
  "env": {
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
  }
}
```

---

### MCP Configuration Discovery

**Finding:** Magic MCP was showing as connected but wasn't in `~/.claude/settings.json`.

**Explanation:** Claude Code reads MCP configurations from multiple locations:
1. `~/.claude/settings.json` - Claude Code-specific settings
2. `~/.cursor/mcp.json` - **Shared with Cursor** (this is where Magic MCP is defined)

This allows MCP servers to be shared between Cursor and Claude Code automatically.

**Magic MCP Config (in `~/.cursor/mcp.json`):**
```json
"Magic MCP": {
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest", "API_KEY=\"<key>\""]
}
```

---

### Node.js Version - Local Config Found

**Discovery:** The `.vercel/project.json` file in the project has `nodeVersion: "24.x"` hardcoded:
```json
{
  "projectId": "prj_6YkqN6EZ8WhZD6awgr8BA7FULdcA",
  "settings": {
    "nodeVersion": "24.x"
  }
}
```

This local config may be overriding both the package.json `engines` field and Vercel dashboard settings.

---

## Session Update: February 12, 2026 (Continued - Part 2)

### Vercel MCP Still Not Connecting

**Problem:** Despite correct config format, Vercel MCP was still not appearing after multiple Claude Code restarts.

**Troubleshooting Performed:**
1. Verified MCP command works: `npx -y vercel-mcp VERCEL_API_KEY=<token>`
2. Tested API token validity via curl - token authenticated successfully
3. **Root Cause Found:** The old token (`vck_...`) had **limited permissions** - it could authenticate but returned 0 projects

**API Test Results:**
```bash
# Token authenticated but showed no projects
curl -H "Authorization: Bearer <old-token>" "https://api.vercel.com/v9/projects"
# Response: {"projects":[],"pagination":{"count":0}}

# User info showed defaultTeamId exists
curl -H "Authorization: Bearer <old-token>" "https://api.vercel.com/v2/user"
# Response showed: "defaultTeamId": "team_Wl69zG5JVXG5AeXwCvvKSiSt"

# But team/project queries failed with forbidden/not_found
```

**Solution:** Generated a new Vercel API token with **Full Account** scope at https://vercel.com/account/tokens

**Updated Config (`~/.claude/settings.json`):**
```json
"vercel": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "vercel-mcp", "VERCEL_API_KEY=<new-full-access-token>"],
  "env": {
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
  }
}
```

**Status:** New token configured. Awaiting Claude Code restart to verify MCP connection.

---

## Next Steps

1. **Restart Claude Code** to activate Vercel MCP with new token
2. **Verify Vercel MCP is connected** (should see `mcp__vercel__*` tools)
3. **Fix Node.js version** via Vercel MCP or `.vercel/project.json`
4. **Trigger new deployment** and verify it succeeds
5. **Test password reset flow** after deployment
6. **Fix security issue** - sanitize error messages in API routes
7. **Run database migrations** if tables don't exist: `npm run db:push`

### Resume Instructions
After restarting Claude Code, say:
> "Is the Vercel MCP connected now? If so, update the Node.js version to 22.x and trigger a new deployment"

---

## Shortcut Commands

| Command | Action |
|---------|--------|
| `Update MD and sync GitHub` | Update SESSION_NOTES.md with current conversation progress, commit, and push to GitHub |

---

## Session Update: February 12, 2026 (Continued - Part 3)

### Vercel MCP Stdio Transport Failure

**Problem:** Vercel MCP still not connecting after multiple Claude Code restarts, despite correct configuration in `~/.claude/settings.json`.

**Diagnosis:**
1. Tested MCP server directly - it responds correctly to JSON-RPC initialize requests
2. API token works (verified in previous session)
3. The stdio transport in `~/.claude/settings.json` silently fails to connect

**Test Result (MCP server works directly):**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | npx -y vercel-mcp "VERCEL_API_KEY=<token>"
# Response: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"vercel-mcp","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
```

**Solution Applied:** Switched to HTTP transport at the project level.

---

### Claude Code Configuration Files

| File | Purpose |
|------|---------|
| `~/.claude/settings.json` | Global MCP settings (all projects) - stdio transport for Vercel (not working) |
| `~/.claude.json` | User/project-specific config - where project-level MCP overrides go |

**Fix Applied to `~/.claude.json`:**
Added Vercel MCP with HTTP transport for this project:
```json
"/Users/prits6/Desktop/Wealth/Artemis Design Labs/AI Projects/behavioral-insights": {
  "mcpServers": {
    "vercel": {
      "type": "http",
      "url": "https://mcp.vercel.com/mcp"
    }
  },
  ...
}
```

**Note:** HTTP transport uses Vercel's official MCP endpoint and authenticates via OAuth in the browser (not API token).

---

### Next Steps (Updated)

1. **Restart Claude Code** to load new HTTP-based Vercel MCP config
2. **Authenticate via browser** when prompted by Vercel OAuth
3. **Verify Vercel MCP tools** are available (should see `mcp__vercel__*` tools)
4. Continue with Node.js version fix and deployment

---

## Session Update: February 12, 2026 (Continued - Part 4)

### Vercel MCP Configuration Fix

**Problem:** Vercel MCP still not connecting after trying both stdio and HTTP transport approaches.

**Discovery:** Upon reviewing the global settings (`~/.claude/settings.json`), found that the API key was being passed incorrectly:

```json
// Before (broken - API key as command line argument)
"vercel": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "vercel-mcp", "VERCEL_API_KEY=<token>"],
  "env": {
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
  }
}

// After (fixed - API key as environment variable)
"vercel": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "vercel-mcp"],
  "env": {
    "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    "VERCEL_API_KEY": "<token>"
  }
}
```

**Root Cause:** The `vercel-mcp` package reads the API key from the `VERCEL_API_KEY` **environment variable**, not from command line arguments. Passing it as an argument was causing the MCP server to fail authentication.

**Status:** Configuration fixed. Requires Claude Code restart to take effect.

---

## Tech Stack Reference

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16.1.1 |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM 0.45.1 |
| DB Driver | postgres.js |
| Auth | NextAuth.js v5 (beta) |
| Email | Resend |
| AI | Anthropic Claude API |
| Styling | Tailwind CSS v4 |

---

## Key Files

| Purpose | File Path |
|---------|-----------|
| Database connection | `src/lib/db.ts` |
| Database schema | `src/lib/schema.ts` |
| Drizzle config | `drizzle.config.ts` |
| Auth config | `src/lib/auth.ts` |
| Forgot password API | `src/app/api/auth/forgot-password/route.ts` |
| Reset password API | `src/app/api/auth/reset-password/route.ts` |
| Registration API | `src/app/api/auth/register/route.ts` |
| Email service | `src/lib/email.ts` |
