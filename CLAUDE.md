# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Pre-implementation.** This repo currently contains only documentation — no code has been scaffolded yet. The build should follow `docs/Politech_Implementation_Plan.md` (the *how*, written specifically to be handed to Claude Code) and `docs/Politech_PRD.md` (the *what/why*). Read the implementation plan before building anything.

Reference material: `docs/neynar-docs-full.txt.txt` (~2MB) and `docs/farcaster-docs.txt.txt` are offline dumps of the Neynar and Farcaster docs — search these (Grep) rather than guessing API shapes.

## What Politech is

A Farcaster agent for the /politics channel that ingests many sources (RSS, YouTube per-channel RSS, outlet Farcaster accounts, prediction markets), clusters same-event coverage, and posts **original comparative meta-analysis casts** instead of reposting links. MVP = the agent (Tier 0) + a light Next.js mini app (Tier 1). Governance/QV voting, profiles, tag-to-ask, and matchmaking are explicitly out of scope for this build but the architecture must not foreclose them.

## Architecture

Three pieces separated by one shared contract so they can be built in parallel:

- **Agent** (Node + tsx, `apps/agent/`): `ingest → filter → cluster → dedupe → commentary → publish`
- **Store** (the boundary; JSON file week 1 → Postgres at launch): agent writes, mini app reads. Interface: `hasSeen / markSeen / saveItem / listItems / listPolls / votePoll`
- **Mini app** (Next.js 14 App Router + `@farcaster/miniapp-sdk`, `apps/miniapp/`): renders the feed, runs one poll

The keystone is `packages/shared/contract.ts` (`PolitechItem`, `PolitechPoll`, `SourceRef` types — full definitions in the implementation plan §2). **Lock the contract first (milestone M0)**; both apps import it.

Build order: M0 contract+store → M1 publish → M2 ingestion+filters → M3 cluster+dedupe+commentary → M4 Policast+cron (agent shippable alone) → M5 mini app.

## Stack

| Concern | Choice |
|---|---|
| Agent runtime | Node + tsx (TypeScript) |
| Farcaster | `@neynar/nodejs-sdk` v2 |
| Feeds | `rss-parser` (RSS + YouTube per-channel RSS) |
| Commentary | Anthropic SDK |
| Mini app | Next.js 14 App Router + `@farcaster/miniapp-sdk` — **no MiniKit/OnchainKit** (wagmi/viem + `@farcaster/miniapp-wagmi-connector` only in Phase 2) |
| Hosting | Vercel (cron + mini app) |

Env vars: `NEYNAR_API_KEY`, `POLITECH_SIGNER_UUID`, `ANTHROPIC_API_KEY`, `POLITECH_RUN_LOOP` (true=loop, false=single cron pass), `DATABASE_URL`; mini app: `NEXT_PUBLIC_URL`. The mini app's Farcaster identity lives in `/.well-known/farcaster.json` (signed `accountAssociation`), not env vars.

## Gotchas (these cost time if missed)

- **Reply filter:** keep top-level casts via `parent_hash === null` — NOT `parent_url`. Channel posts set `parent_url` to the channel while `parent_hash` stays null; filtering on `parent_url` wrongly drops legitimate channel posts.
- **Quote casts:** detect via an embedded *cast* in `embeds` (`e.cast || e.cast_id`), not a URL embed.
- **Ingestion endpoint:** use `client.fetchCastsForUser({ fid })` (`/v2/farcaster/feed/user/casts/`) — never `/feed/user/replies_and_recasts/`.
- **Idempotency:** set `idem: item.clusterId` on `publishCast` so retries can't double-post; this stacks on top of the dedup store.
- **Neynar SDK v2 rename:** the reply param is `parent` (was `replyTo` in v1). Init: `new NeynarAPIClient(new Configuration({ apiKey }))`.
- **Dedup IS clustering:** build the dedup layer as same-event clustering from day one (canonical-URL match or title overlap in a time window) — it's the same code that powers meta-analysis. Don't write a throwaway URL set.
- **Copyright:** commentary must paraphrase in Politech's own voice and link out; never reproduce article text, even in meta-analysis. 1 source → story take, ≥2 sources in a cluster → one comparative cast.
- **Prediction markets:** frame as signal/discussion ("the market is pricing X at Y — thoughts?"), never betting advice.
- **YouTube filter:** skip Shorts and livestream notices.
- **Phase-2 readiness:** keep poll voting behind `Store.votePoll`; call `sdk.actions.ready()` and read `sdk.context` from day one; use `sdk.quickAuth` / `sdk.actions.signIn` so poll POSTs carry a *verified* FID, not client-supplied context.
