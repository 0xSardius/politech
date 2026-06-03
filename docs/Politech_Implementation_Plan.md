# Politech — Implementation Plan (MVP)

Companion to the PRD. The PRD is the *what/why*; this is the *how/in-what-order*,
written to be handed to Claude Code to build from scratch.

**MVP scope:** the Agent (Tier 0) + a light mini app (Tier 1). Everything else in
the PRD roadmap (governance/QV, profiles, matchmaking) is explicitly out of scope
for this build — but the architecture must not foreclose it.

---

## 1. Architecture

Three pieces separated by one shared contract, so they can be built in parallel:

```
            shared contract (types)
                     │
   ┌─────────────────┼──────────────────┐
   AGENT          STORE              MINI APP
 writes items   the boundary       reads items
```

- **Agent** (Node service): `ingest → filter → cluster → dedupe → commentary → publish`.
- **Store** (Postgres; JSON file acceptable for first week): the only thing both
  sides touch. Agent writes, mini app reads.
- **Mini app** (Next.js + MiniKit/OnchainKit): renders the feed, runs one poll.

Lock the contract first; then the agent and mini app proceed independently.

---

## 2. Shared data contract

This is the keystone. Define it once and import it on both sides.

```ts
export type ItemKind = 'story' | 'meta_analysis' | 'market' | 'recast';

export interface SourceRef {
  name: string;
  url: string;
  kind: 'rss' | 'youtube' | 'farcaster' | 'policast';
}

export interface PolitechItem {
  id: string;            // hash of primaryUrl or clusterId
  kind: ItemKind;
  text: string;          // the cast body (Politech's commentary)
  sources: SourceRef[];  // 1 for a story, N for a meta_analysis
  primaryUrl: string;    // URL embedded in the cast (rich preview)
  clusterId?: string;    // groups items about the same event
  publishedAt: string;   // ISO
  castHash?: string;     // set after publish
  channelId: string;     // "politics"
}

export interface PollOption { id: string; label: string; votes: number; }

export interface PolitechPoll {
  id: string;
  question: string;
  options: PollOption[];
  opensAt: string;
  closesAt: string;
  mode: 'simple';        // Phase 2: 'quadratic' | 'plutocratic'
  relatedItemId?: string;
}
```

---

## 3. Recommended repo structure

```
politech/
├── CLAUDE.md
├── packages/shared/contract.ts
├── apps/agent/
│   └── src/{config/sources.ts, ingest.ts, pipeline.ts,
│            commentary.ts, publish.ts, store.ts, index.ts}
└── apps/miniapp/
    └── app/{layout.tsx, providers.tsx, page.tsx,
             api/casts/route.ts, api/polls/route.ts}
```

---

## 4. Milestones

### M0 — Contract + store (do first)
- Define `packages/shared/contract.ts`.
- Implement a `Store` interface (`hasSeen / markSeen / saveItem / listItems /
  listPolls / votePoll`) with a JSON-file impl for week 1, Postgres for launch.
- **Done:** both apps typecheck against the contract; agent write → mini app read works.

### M1 — Agent: account + posting
- Create a dedicated Politech account in the Neynar dev portal; get
  `NEYNAR_API_KEY` + `POLITECH_SIGNER_UUID`.
- `publish.ts`: `publishCast({ signerUuid, text, embeds:[{url}], channelId:'politics' })`.
- **Done:** a test cast appears in /politics from the Politech account.

### M2 — Agent: ingestion + filters
- `config/sources.ts`: curated list with per-source rules. Fill real values:
  Drop Site RSS, Breaking Points YouTube `channel_id`, any outlet fids, Policast endpoint.
- `ingest.ts`: RSS + YouTube (per-channel RSS) + Farcaster (`fetchCastsForUser`) + Policast.
- `pipeline.ts` `filter()`: YouTube skip Shorts/livestreams; Farcaster keep
  top-level only (`parent_hash === null`) and drop quote casts (embedded cast).
- **Done:** each source returns items; a known reply/Short is excluded.

### M3 — Agent: cluster + dedupe + commentary
- `pipeline.ts` `cluster()`: group same-event items (canonical-URL match or title
  overlap within a time window; embeddings are the later upgrade).
- Dedupe via `hasSeen(canonicalUrl)`.
- `commentary.ts`: persona prompt; 1 source → story take, ≥2 → comparative
  meta-analysis. Paraphrase only, link out, never reproduce text.
- **Done:** the same story from RSS + YouTube collapses to one cluster and posts a
  single comparative cast.

### M4 — Agent: Policast + schedule
- Frame markets as "the market is pricing X at Y — thoughts?" (signal, not advice).
- `index.ts` orchestrator runs the pass; deploy behind a serverless cron (every
  ~15 min) or a PM2 loop.
- **Done:** posts unattended for 24h with no duplicates. *Agent is now shippable alone.*

### M5 — Mini app (Tier 1)
- Bootstrap with the official scaffold: `npm create @farcaster/mini-app` (or add
  `@farcaster/miniapp-sdk` to a plain Next.js app). No MiniKit/OnchainKit.
- On load, call `sdk.actions.ready()` to dismiss the splash; read the user from
  `sdk.context` (`context.user.fid`, username, pfp).
- **Manifest:** host `/.well-known/farcaster.json` on the app's domain with the
  `accountAssociation` signed by the Politech account (Farcaster developer tools
  handle the signing). This is what makes it a real mini app.
- `page.tsx`: feed of item cards (kind badge, commentary, source chips, timestamp),
  reading `/api/casts`.
- `/api/polls` GET/POST: one-FID-one-vote. Use `sdk.quickAuth` / `sdk.actions.signIn`
  (SIWF) so the POST carries a *verified* FID token rather than trusting the
  client-supplied context.
- Deploy to Vercel.
- **Done:** mini app opens from a cast, shows the feed, and a poll members can vote in.

---

## 5. Stack

| Concern | Choice |
|---|---|
| Agent runtime | Node + tsx (TypeScript) |
| Farcaster | Neynar SDK (`@neynar/nodejs-sdk`) |
| Feeds | `rss-parser` (handles RSS + YouTube per-channel RSS) |
| Commentary | Anthropic SDK |
| Store | JSON file (week 1) → Postgres (launch) |
| Mini app | Next.js 14 App Router + `@farcaster/miniapp-sdk` (wagmi/viem + `@farcaster/miniapp-wagmi-connector` added in Phase 2) |
| Hosting | Vercel (cron + mini app); PM2 box is the agent-loop alt |
| Chain (Phase 2) | Base, for $POLITICS balance reads |

---

## 6. Environment variables

```
# Agent
NEYNAR_API_KEY=
POLITECH_SIGNER_UUID=
ANTHROPIC_API_KEY=
POLITECH_RUN_LOOP=false        # true=loop, false=single pass (cron)
DATABASE_URL=                  # Postgres for launch

# Mini app
NEXT_PUBLIC_URL=               # deployed domain (must match the manifest host)
```

The mini app needs no vendor API key. Its Farcaster identity lives in
`/.well-known/farcaster.json` (the `accountAssociation` signed by the Politech
account), hosted with the app — not in env vars.

---

## 7. Gotchas to get right (these cost time if missed)

- **Farcaster reply filter:** filter on `parent_hash`, NOT `parent_url`. Posting
  into a channel sets `parent_url` to the channel but leaves `parent_hash` null —
  filtering on `parent_url` wrongly drops legitimate channel posts.
- **Quote casts:** detect via an embedded *cast* in `embeds` (not a URL embed).
- **Copyright:** commentary must paraphrase and link out; never reproduce article
  text, even in meta-analysis.
- **Prediction markets:** report the signal and invite discussion; never advice.
- **Dedup = clustering:** build the dedup layer as clustering from day one — it's
  the same code that powers meta-analysis, so don't write a throwaway URL set.
- **Phase-2 readiness:** keep poll voting behind the `Store.votePoll` interface and
  call `sdk.actions.ready()` / read `sdk.context` from day one. When governance
  lands, add wagmi + `@farcaster/miniapp-wagmi-connector` (the host's wallet via
  `sdk.wallet.getEthereumProvider()`, EIP-1193) for $POLITICS `balanceOf` reads and
  signed votes — quadratic/token-gated voting then slots in without a rewrite.

---

## 8. Out of scope for this build (see PRD roadmap)
Governance/QV + plutocratic mode, member profiles, tag-to-ask conversational
agent, style-RAG voice, suggestion inbox, cross-spectrum matchmaking + location,
empire score, reward distribution, full catalog/curation UI.

---

## 9. Neynar API reference (the calls this build depends on)

SDK: `@neynar/nodejs-sdk` v2. Initialize once:

```ts
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
const client = new NeynarAPIClient(new Configuration({ apiKey: process.env.NEYNAR_API_KEY }));
```

**Publish to the channel** (the source URL in `embeds` drives the rich preview;
set `idem` to the cluster id so retries can't double-post):
```ts
const { cast } = await client.publishCast({
  signerUuid: process.env.POLITECH_SIGNER_UUID,
  text: item.text,
  embeds: [{ url: item.primaryUrl }],
  channelId: 'politics',
  idem: item.clusterId,            // idempotency key
});
// cast.hash -> store on the PolitechItem
```
*v2 note:* the reply param is `parent` (was `replyTo` in v1).

**Ingest an outlet's original casts** — use the user casts feed, then filter:
```ts
// endpoint: GET /v2/farcaster/feed/user/casts/
const res = await client.fetchCastsForUser({ fid, limit: 25 });
// keep originals: cast.parent_hash === null   (NOT parent_url)
// drop quotes:    cast.embeds.some(e => e.cast || e.cast_id)
```
Do **not** use `/feed/user/replies_and_recasts/` for ingestion — that's the
opposite of what we want. Cast objects expose `parent_hash`, `parent_url`,
`root_parent_url`, `embeds`, `channel`.

**Recast (hook-driven amplification):**
```ts
await client.publishReaction({
  signerUuid: process.env.POLITECH_SIGNER_UUID,
  reactionType: 'recast',
  target: castHash,
});
```

**Optional embed metadata** — `GET /v2/farcaster/cast/embed/crawl/` returns
preview metadata for a URL before you cast it.

**Signer setup** — for a dedicated bot account, clone Neynar's `managed-signers`
example for the quickstart; or use Sign-In-With-Neynar (SIWN), where Neynar pays
the onchain signer fee. See the docs' "Which signer should you use" guide.

### Phase 2/3 — already supported, wire later
- **Veto gating:** `GET /v2/farcaster/channel/member/list/` + the
  `author_channel_context.role` field expose moderator/lead for the /politics
  channel — gate the backstop veto to that, not a hardcoded admin.
- **Tag-to-ask agent:** create a Neynar **webhook** with a `cast.created`
  subscription filtered by `mentioned_fids` = Politech's fid; respond on the event.
- **Real-time outlet ingestion:** same webhook, filtered by outlets' `author_fids`,
  can supplement RSS for outlets active on Farcaster.
- **Token gating:** `GET /v2/farcaster/user/balance/` for current balances by FID
  (live gating); the QV snapshot still needs an onchain `balanceOf` at the block.
- **Mini app notifications:** `frame/notification_tokens` + the "send notifications
  to mini app users" guide.

```
