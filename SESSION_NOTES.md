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

## Next Steps

1. **Restart Claude Code** to activate Vercel MCP tools
2. **Use Vercel MCP** to update Node.js version to 22.x in project settings
3. **Verify deployment succeeds** after Node.js version fix
4. **Test password reset flow** after deployment
5. **Fix security issue** - sanitize error messages in API routes
6. **Run database migrations** if tables don't exist: `npm run db:push`

### Resume Instructions
After restarting Claude Code, say:
> "Use the Vercel MCP to update the Node.js version to 22.x for the behavioral-insights project and check the deployment logs"

---

## Shortcut Commands

| Command | Action |
|---------|--------|
| `Update MD and sync GitHub` | Update SESSION_NOTES.md with current conversation progress, commit, and push to GitHub |

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
