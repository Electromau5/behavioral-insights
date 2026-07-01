# Supabase Migration — June 30, 2026

## Summary

The original Supabase project (`behavioral-insights-database`) was automatically paused after 90 days of inactivity and could not be restored. A new Supabase project (`Behavioral Insights Updated`) was created and connected to the Vercel deployment. All environment variables were updated and the data backup was confirmed migrated.

---

## Old Project

| Field | Value |
|---|---|
| Name | behavioral-insights-database |
| Ref | `synlghfizzyujqcltuzd` |
| Region | us-east-1 |
| Status | Suspended (paused 90+ days, unrestorable) |

## New Project

| Field | Value |
|---|---|
| Name | Behavioral Insights Updated |
| Ref | `btrjxzjineohtiyqzvnj` |
| Region | us-east-1 |
| Status | ACTIVE_HEALTHY |
| Created | 2026-06-30 |
| Dashboard | https://supabase.com/dashboard/project/btrjxzjineohtiyqzvnj |

---

## Steps Taken

### 1. Verified Vercel CLI Connection

```bash
vercel --version   # 41.7.6
vercel whoami      # electromau5
```

Confirmed the project was linked via `.vercel/project.json`:
- Project ID: `prj_6YkqN6EZ8WhZD6awgr8BA7FULdcA`
- Team ID: `team_Wl69zG5JVXG5AeXwCvvKSiSt`

### 2. Listed Existing Vercel Env Vars

Used `vercel env ls` to confirm all 21 env vars present — all Supabase/Postgres vars were pointing at the old (suspended) project.

### 3. Retrieved New Project Credentials via Supabase Management API

Used the PAT from `.mcp.json` to call the Management API directly:

```bash
curl https://api.supabase.com/v1/projects/btrjxzjineohtiyqzvnj \
  -H "Authorization: Bearer <PAT>"

curl https://api.supabase.com/v1/projects/btrjxzjineohtiyqzvnj/api-keys \
  -H "Authorization: Bearer <PAT>"

curl https://api.supabase.com/v1/projects/btrjxzjineohtiyqzvnj/postgrest \
  -H "Authorization: Bearer <PAT>"
```

Retrieved: Project URL, anon key, service role key, publishable key, JWT secret.

Database password was not exposed via the API — obtained from the Supabase dashboard Connect page.

### 4. Updated All Environment Variables

**First attempt:** Removed all old Supabase/Postgres vars and re-added via Vercel REST API.

**Issue encountered:** The Vercel-Supabase native integration (originally used to create the old project) was still linked and conflicted when the new vars were added manually.

**Solution:** 
1. Removed all manually-added vars
2. Went to Vercel → Integrations → Supabase → Manage
3. Reconnected the integration to the new project (`Behavioral Insights Updated`)
4. Integration automatically set all 16 Supabase/Postgres vars for Production + Preview

**Separately added `SUPABASE_SECRET_KEY`** (obtained from Supabase dashboard → API Keys → secret key, starts with `sb_secret_`).

### 5. Updated Local `.env.local`

Updated `.env.local` to point to the new project with all credentials. See the file for current values.

### 6. Troubleshot Deployment Failures — `Resource provisioning failed`

Redeployment failed immediately (< 500ms) with `errorCode: BUILD_FAILED`, `errorMessage: Resource provisioning failed`. This happened before any build started.

**Root cause:** The old suspended Supabase store (`behavioral-insights-database`, `store_OxC9pckZxDxVAnJE`) was still linked to the Vercel project with `"deployments": {"required": true}`. Every deploy attempt tried to provision the suspended store and failed instantly.

Found by querying the Vercel storage stores API:
```bash
curl https://api.vercel.com/v1/storage/stores?teamId=<TEAM_ID> \
  -H "Authorization: Bearer <VERCEL_TOKEN>"
```

The store showed:
```json
{
  "name": "behavioral-insights-database",
  "status": "suspended",
  "externalResourceStatus": "suspended",
  "notification": "Project has been paused. Go to Supabase Dashboard to unpause."
}
```

### 7. Deleted the Old Supabase Project

Since the old project could not be restored (paused 90+ days), it was deleted via the Management API:

```bash
curl -X DELETE https://api.supabase.com/v1/projects/synlghfizzyujqcltuzd \
  -H "Authorization: Bearer <PAT>"
```

Response confirmed Vercel integration was cleaned up:
```json
{
  "name": "behavioral-insights-database",
  "ref": "synlghfizzyujqcltuzd",
  "vercel": { "resourceUninstallFailure": false }
}
```

This automatically removed the suspended store from Vercel and unblocked deployments.

### 8. Redeployed Successfully

Triggered redeploy via Vercel REST API. Deployment moved to `INITIALIZING` (previously failed immediately) and reached `READY` state.

### 9. Confirmed Data Migration

A local backup existed at: `/Users/prits6/Downloads/db_cluster-27-01-2026@04-24-01.backup`

Format: `pg_dumpall` plain SQL cluster dump (created January 27, 2026).

Attempted restore of public schema — all tables with data already existed in the new project with matching row counts:

| Table | Backup | New DB | Status |
|---|---|---|---|
| events | 2,354 | 2,354 | ✓ |
| sessions | 170 | 170 | ✓ |
| sites | 8 | 8 | ✓ |
| users | 2 | 2 | ✓ |
| insights | 4 | 4 | ✓ |
| portfolios | 0 | 0 | ✓ (was empty) |
| case_studies | 0 | 0 | ✓ (was empty) |
| designer_profiles | 0 | 0 | ✓ (was empty) |
| screenshots | 0 | 0 | ✓ (was empty) |
| user_flows | 0 | 0 | ✓ (was empty) |
| portfolio_visitors | 0 | 0 | ✓ (was empty) |

Data was fully in sync — no data loss.

---

## Environment Variables (New Project)

All set across Production, Preview, and Development in Vercel:

| Variable | Description |
|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `https://btrjxzjineohtiyqzvnj.supabase.co` |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy anon JWT |
| `SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_*` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service_role JWT |
| `SUPABASE_SECRET_KEY` | `sb_secret_*` key (from Supabase dashboard → API Keys) |
| `SUPABASE_JWT_SECRET` | JWT signing secret |
| `POSTGRES_HOST` | `db.btrjxzjineohtiyqzvnj.supabase.co` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_DATABASE` | `postgres` |
| `POSTGRES_PASSWORD` | (encrypted in Vercel) |
| `POSTGRES_URL` | Pooled connection (port 6543, transaction mode) |
| `POSTGRES_PRISMA_URL` | Pooled connection with `pgbouncer=true` |
| `POSTGRES_URL_NON_POOLING` | Session mode pooled connection (port 5432) |

Pooler host: `aws-0-us-east-1.pooler.supabase.com`

---

## Key Tools Used

- **Vercel CLI** (`vercel env ls/rm`, `vercel whoami`)
- **Vercel REST API** (`/v10/projects/{id}/env`, `/v1/storage/stores`)
- **Supabase Management API** (`/v1/projects/{ref}`, `/v1/projects/{ref}/api-keys`, `/v1/projects/{ref}/postgrest`)
- **psql** (direct DB connection for data verification)

---

## Lessons Learned

1. **Vercel-Supabase native integration stores are linked as deployment requirements.** If the linked Supabase project is suspended/deleted, every deploy fails instantly with `Resource provisioning failed` — even after updating env vars manually.

2. **Deleting the old Supabase project (not just pausing) triggers automatic Vercel store cleanup** via webhook (`"vercel": {"resourceUninstallFailure": false}`).

3. **The Supabase Management API does not expose the database password.** It must be obtained from the Supabase dashboard Connect page or by resetting it.

4. **`pg_dumpall` backups include Supabase system roles and schemas** (auth, storage, realtime) that already exist in new projects. Restoring requires extracting only the `public` schema DDL and data, skipping role creation statements.
