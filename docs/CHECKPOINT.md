# Politech — Checkpoint

_Last updated: 2026-06-17. Read this + recent git log to resume._

## TL;DR
**M0 is complete and pushed.** The monorepo is scaffolded, the shared contract +
Store are done and smoke-tested, and the agent pipeline skeleton runs end-to-end
in dry-run mode. Next up is **M1** (post a real test cast), which is blocked only
on you adding Neynar credentials to `.env`.

## Where things stand

| Milestone | Status |
|---|---|
| Docs (PRD, Implementation Plan, CLAUDE.md) | ✅ done |
| Git repo + remote (`github.com/0xSardius/politech`) | ✅ pushed to `main` |
| **M0** — shared contract + Store | ✅ **complete** |
| **M1** — agent account + posting | ⏳ blocked on Neynar creds in `.env` |
| M2 — ingestion + filters | ⬜ not started (RSS/YouTube need no creds) |
| M3 — cluster + dedupe + commentary | ⬜ needs `ANTHROPIC_API_KEY` |
| M4 — Policast + cron (agent shippable) | ⬜ |
| M5 — mini app (Tier 1) | ⬜ |

Latest commit: `f101ac4` — "M0: monorepo scaffold".

## What exists (verified working)
- `packages/shared/contract.ts` — `PolitechItem` / `PolitechPoll` / `SourceRef`.
- `packages/shared/store.ts` — `Store` interface + `JsonFileStore` impl.
  Smoke-tested: write→read across instances, dedup, one-FID-one-vote (re-vote moves).
- `apps/agent/src/`:
  - `publish.ts` — **fully implemented**, M1-ready (the only file touching the signer).
  - `pipeline.ts` — `filter()` enforces hard rules 1/2/10; cluster + dedupe wired.
  - `index.ts` — orchestrator, runs a full pass.
  - `ingest.ts`, `commentary.ts` — **stubs** (M2 / M3 TODOs inside).
  - `config/sources.ts` — Drop Site RSS in; TODO slots for YouTube/Farcaster/Policast.
- `npm run typecheck` ✅ passes. `npm run once` ✅ runs (empty, dry-run).

## Key facts to remember
- **Neynar SDK is v3** (plan/docs say v2). `publishCast` params unchanged. One
  codegen quirk: `PostCastReqBodyEmbeds` wrongly requires all fields — cast a
  `{ url }` object to it (see `publish.ts`). Documented in CLAUDE.md.
- `POLITECH_DRY_RUN` defaults to **true** — pipeline logs instead of casting.
- `POLITECH_CHANNEL_ID` lets you test off /politics before going live.
- `.env` exists but `NEYNAR_API_KEY` + `POLITECH_SIGNER_UUID` are **still blank**.

## To resume (do these in order)
1. Read this file + `git log --oneline -5`.
2. **Unblock M1:** at [dev.neynar.com](https://dev.neynar.com) create the Politech
   agent account, copy its API key → `NEYNAR_API_KEY` and the displayed
   `signer_uuid` → `POLITECH_SIGNER_UUID` in `.env`.
3. **M1 test:** set `POLITECH_DRY_RUN=false`, point `POLITECH_CHANNEL_ID` at a test
   channel, `npm run once`, confirm a cast appears. Then flip the channel to `politics`.
4. **Then M2:** real ingestion in `ingest.ts` (rss-parser for RSS + YouTube;
   `client.fetchCastsForUser({ fid })` for Farcaster outlets) + fill `sources.ts`.

## Open decisions parked for later
- **ERC-8004 identity** — considered (agent-to-agent discovery / x402 monetization).
  Decision: **defer to Phase 3, gated on a real consumer existing.** Not in scope now;
  architecture (synthesis decoupled from publish) keeps it addable without a rewrite.
- Initial real source list (outlet FIDs, Breaking Points YouTube channel_id, Policast endpoint).
