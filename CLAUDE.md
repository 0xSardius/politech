# CLAUDE.md — Politech

Project context for Claude Code. Read this before generating or changing code.

## What this is
Politech is a Farcaster agent (+ light mini app) for the **/politics** channel.
It ingests many trusted independent news sources, **clusters coverage of the same
event across sources**, and posts **concise comparative meta-analysis** in its own
voice. The source set is community-curated, so the editorial lens is decentralized.
See `docs/Politech_PRD.md` for the full vision and `docs/Politech_Implementation_Plan.md`
for the build order.

`docs/neynar-docs-full.txt.txt` (~2MB) and `docs/farcaster-docs.txt.txt` are offline
dumps of the Neynar and Farcaster docs — **Grep these for API shapes rather than
guessing** (endpoints, param names, response fields).

## Current scope (do NOT exceed without being asked)
Build only the **MVP**:
- **Agent (Tier 0):** ingest → filter → cluster → dedupe → commentary → publish.
- **Mini app (Tier 1):** a light Next.js feed of the agent's casts + one basic poll.

Out of scope right now: governance/quadratic voting, member profiles, the
tag-to-ask conversational agent, style-RAG, matchmaking/location, empire score,
rewards. Architect so these *can* be added later, but do not build them.

Build order (implementation plan §4): **M0** shared contract + Store → **M1**
publish a test cast → **M2** ingestion + filters → **M3** cluster + dedupe +
commentary → **M4** Policast + cron (agent is shippable alone here) → **M5** mini
app. Lock the contract (M0) before anything else.

## Architecture
Three parts separated by one shared contract (`packages/shared/contract.ts`):
- **Agent** writes `PolitechItem`/`PolitechPoll` to the **Store**.
- **Mini app** reads them from the Store via its API routes.
Treat the contract as the only coupling between agent and mini app.

## Stack
- Agent: Node + TypeScript (tsx), `@neynar/nodejs-sdk` **v3** (installed; the docs
  dump and implementation plan say v2 — v3 kept the same `publishCast` params:
  `signerUuid`, `text`, `embeds`, `channelId`, `idem`, `parent`), `rss-parser`,
  Anthropic SDK. npm workspaces monorepo.
- Store: JSON file for week 1, Postgres for launch — behind a `Store` interface.
- Mini app: Next.js 14 App Router + `@farcaster/miniapp-sdk` (official Farcaster
  SDK — do NOT use MiniKit/OnchainKit). wagmi/viem + `@farcaster/miniapp-wagmi-connector`
  are added only when Phase 2 wallet work begins.
- Hosting: Vercel (mini app + cron); PM2 box is the alt for the agent loop.

## Conventions
- TypeScript everywhere; ES modules.
- All persistence goes through the `Store` interface — no direct DB calls in
  business logic. This keeps JSON↔Postgres swappable and keeps voting upgradeable.
- The mini app must work inside Farcaster clients: call `sdk.actions.ready()` once
  loaded, read the user from `sdk.context`, and use `sdk.quickAuth`/`sdk.actions.signIn`
  for any write (e.g. poll votes) so the server gets a verified FID — no custom login.
- Keep modules single-purpose (one file per pipeline stage) for clean handoffs.

## Hard rules (these are correctness, not style)
1. **Farcaster replies:** filter on `parent_hash` (null = top-level), NEVER on
   `parent_url`. Channel posts have `parent_url` set but `parent_hash` null.
2. **Quote casts:** drop casts whose `embeds` contain a cast object (not a URL).
3. **Copyright:** commentary paraphrases and links out. Never reproduce article or
   cast text verbatim, including in meta-analysis. Quotes, if ever, are minimal.
4. **Prediction markets (Policast):** report the signal and invite discussion.
   Never phrase as betting/financial advice.
5. **Dedup is clustering:** the layer that prevents double-posting is the same one
   that groups sources for meta-analysis. Build it as clustering from the start.
6. **Casting target:** publish to the channel with
   `publishCast({ signerUuid, text, embeds:[{url}], channelId:'politics' })`;
   the source URL in `embeds` drives the rich preview.
7. **Idempotency:** set `idem: item.clusterId` on `publishCast` so a retry can't
   double-post the same story — cheap insurance on top of the dedup store.
8. **Ingestion endpoint:** use `client.fetchCastsForUser({ fid })`
   (`/v2/farcaster/feed/user/casts/`) — never `/feed/user/replies_and_recasts/`.
9. **Neynar SDK v3:** the reply param is `parent` (was `replyTo` in v1). Init:
   `new NeynarAPIClient(new Configuration({ apiKey }))`. The generated
   `PostCastReqBodyEmbeds` type wrongly requires `cast_id`+`castId`+`url`
   together (flattened anyOf) — cast a `{ url }` object to it; the API accepts
   `{ url }` alone.
10. **YouTube filter:** skip Shorts and livestream notices.

## Commands
Run from the repo root (npm workspaces):
- `npm run once` — single agent pass (cron mode)
- `npm run agent` — agent loop (every 15 min)
- `npm run typecheck` — typecheck all workspaces
- Mini app (M5): `npm run dev` / `npm run build` in `apps/miniapp`.

`POLITECH_DRY_RUN` defaults to true — the pipeline logs instead of casting.
Set it to `false` only when output is trustworthy. `POLITECH_CHANNEL_ID` lets
you point at a test channel while iterating.

## Env
See `.env.example`. Agent needs `NEYNAR_API_KEY`, `POLITECH_SIGNER_UUID`,
`ANTHROPIC_API_KEY`, `POLITECH_RUN_LOOP` (true=loop, false=single cron pass), and
`DATABASE_URL` once Postgres lands. The mini app needs no vendor API key — its
Farcaster identity is the `accountAssociation` in `/.well-known/farcaster.json` on
its domain, signed by the Politech account via the Farcaster developer tools.
