# Politech — Product Requirements Document (v0.1)

*A community-curated, cross-source political news agent for the Farcaster /politics channel.*

---

## 1. Vision

Politech is a Farcaster agent (and, in time, a mini app) that turns the /politics channel into a **community-curated newsroom**. It ingests many trusted, independent sources at once, and instead of firehosing links, it posts **concise comparative meta-analysis** — how different outlets are covering the same story, where they agree, where they diverge, and what's being under-covered.

Think *"a concise Ground News, but its editorial lens is set by the community rather than a central bias-rating authority."* The source set is curated by token-holders, so the perspective is **decentralized by design**.

The longer-term ambition is to use that same engine to **disrupt echo chambers** — surfacing common ground between members who differ on the surface — but that is explicitly a later phase, gated behind opt-in consent.

---

## 2. Core differentiator

Most news bots repost. Politech **synthesizes**:

1. **Multi-source ingestion** — RSS, YouTube, outlet Farcaster accounts, prediction markets.
2. **Event clustering** — detect when several sources are covering the same event.
3. **Comparative commentary** — an LLM produces a short, original "here's the spread of coverage" cast, in Politech's own voice, linking out to each source.
4. **Decentralized preferences** — the community curates which sources count, so the lens is owned by the community, not a vendor.

The dedup layer required to avoid double-posting the same story *is* the seed of the clustering engine — the same work powers both.

---

## 3. Users

- **Channel owner / moderator** (the operator): owns /politics, controls the $POLITICS token rewards, holds final editorial + veto authority.
- **Core members**: active participants who curate sources, vote, and (later) get richer agent interaction.
- **Newcomers**: can tag the agent to get context and orientation.
- **Passive readers**: consume the synthesized feed in-channel or via the mini app.

---

## 4. Architecture (three layers, built MVP-first)

| Layer | Job | Stack | Phase |
|---|---|---|---|
| **Agent** | Ingest sources, cluster, comment, cast, recast, reply | Neynar SDK + LLM + scheduler + store | **MVP** |
| **Mini app** | Catalog of casts/recasts, polling, later the "home page" | Next.js + `@farcaster/miniapp-sdk` (+ wagmi/viem in Phase 2) | MVP (Tier 1) → grows |
| **Governance/Token** | QV/plutocratic voting, source curation, rewards | $POLITICS on Base + offchain tally w/ onchain snapshot | Phase 2 |

The agent is the engine and ships first. "MVP as just an agent" is a valid launch.

---

## 5. MVP scope

### Tier 0 — The agent (fully shippable alone)
- **Posting identity**: a dedicated, branded Politech account with a Neynar signer (`signer_uuid` + `NEYNAR_API_KEY`).
- **Source ingestion** from a configurable list:
  - RSS feeds (e.g., Drop Site).
  - YouTube (per-channel RSS: `youtube.com/feeds/videos.xml?channel_id=…`).
  - Outlet Farcaster accounts (via Neynar "casts for user").
- **Content-type filters** (per source):
  - Social sources: keep only top-level posts (`parent_hash === null`); drop quote posts (embeds containing a cast). *Filter on `parent_hash`, not `parent_url`, so channel posts aren't dropped.*
  - YouTube: skip Shorts and livestream notices.
- **Dedup / event-clustering**: normalize every candidate to its canonical target URL; collapse duplicates; keep a store of already-cast URLs. (This layer becomes the meta-analysis clustering engine.)
- **Casting to /politics** via `publishCast({ signerUuid, text, embeds:[{url}], channelId:"politics" })`.
- **Commentary / flair**: for main-line stories, the LLM writes a short original take (not a bare link). MVP voice = a hand-written persona/system prompt.
- **Basic meta-analysis**: when ≥2 sources cover the same clustered event, post a single comparative cast ("here's how X, Y, Z are framing this") instead of separate reposts.
- **Policast markets**: embed live political prediction markets as discussion bait ("here's where the market is pricing this — thoughts?").
- **Curated recasts**: recast items matching owner-defined hooks/rules.

### Tier 1 — Agent + mini app
- A mini app page listing all of Politech's casts and chosen recasts.
- **Basic polling** — native Farcaster poll casts or simple 1-FID-1-vote. (Token-weighting/QV deferred to Phase 2.)

### Deferred from MVP
Governance/QV, member profiles, conversational tag-to-ask, style-RAG voice, matchmaking, location, empire-score perks, reward distribution, full catalog/curation UI.

---

## 6. Phased roadmap

**Phase 2 — Governance & curation**
- $POLITICS-gated source curation: propose / vote / **remove** sources.
- **Quadratic voting by default** — voting power = √(snapshot balance), **gated to one verified FID** (with a verified address) as the anti-sybil layer. *Without FID-gating, QV is exploitable by wallet-splitting.*
- **Plutocratic (token-weighted) mode** as a per-poll option for low-stakes / "fun pump" votes.
- **Offchain tally + onchain balance snapshot**, architected so a fully-onchain voting module can drop in later.
- Per-proposal **voting duration** (open/close timestamps).
- **Backstop veto** gated to the /politics channel moderator/lead role (verifiable via Neynar channel roles), independent of vote outcome.

**Phase 3 — Conversational agent & profiles**
- **Tag-to-ask** (warpee-style): mention Politech → RAG-backed answer with source links; newcomer onboarding context.
- **Style-RAG**: learn the agent's voice from core members' *public* casts (public data; refines the Phase-1 commentary engine — no consent issue).
- Member profile pages for channel members (not followers).
- Suggestion inbox.
- **Empire score** drives interaction depth/responsiveness and poll-reward share. *Recommended: blend token holdings with earned participation, so newcomers have a ladder ("put in the time") rather than a wall.*
- Poll rewards proportional to empire score, funded from owner-controlled $POLITICS rewards.

**Phase 4 — Cross-spectrum connection (consent-first)**
- Suggested connections + political conversation-starters.
- FID-location-aware matching and mapping.
- **Bridging logic**: surface members who differ on surface affiliation but share underlying beliefs/interests — built to disrupt echo chambers, not reinforce them.
- **Hard requirement**: opt-in only; members control what's public; location stays coarse (city/region, never precise); no inferred political label is stored or broadcast without approval. This is the most sensitive data category in the product — done right it builds trust; done wrong it's a liability.

**Phase 5 — Catalog/curation polish**
- Full warpee-style cataloging/curation UI (specifics TBD — pending review of warpee's behaviors).

---

## 7. Tech stack

- **Social / agent backbone**: Neynar SDK (publish casts, fetch outlet casts, channel roles, webhooks for mentions).
- **Mini app**: Next.js + the official `@farcaster/miniapp-sdk` (no MiniKit/OnchainKit). The SDK provides the in-client runtime: `sdk.actions.ready()` (splash), `sdk.context` (user FID/username/pfp), `signIn`/Quick Auth for verified identity, and `sdk.wallet.getEthereumProvider()` (EIP-1193). For Phase 2 wallet work, pair it with wagmi/viem via `@farcaster/miniapp-wagmi-connector` (the docs' recommended setup) on Base — that covers $POLITICS balance reads and signed votes with zero vendor wrappers.
- **State / dedup**: Redis or Postgres.
- **RAG / synthesis**: LLM for commentary + meta-analysis + Q&A; vector DB (e.g., Pinecone/pgvector) for style-RAG and tag-to-ask.
- **Scheduling**: serverless cron (Vercel Cron / GitHub Actions / Cloudflare Workers) — cheaper than an always-on box for "poll feeds every N minutes."
- **Chain**: Base (token balance reads for governance).

### 7.1 Neynar integration (grounded in the docs)

The Neynar SDK (`@neynar/nodejs-sdk`, v2) covers nearly everything on the social
side. Init: `new NeynarAPIClient(new Configuration({ apiKey: NEYNAR_API_KEY }))`.

**MVP (Tier 0/1):**
- **Publish** — `publishCast({ signerUuid, text, embeds, channelId, idem })`. Two
  findings worth baking in: posting to a channel uses `channelId`; and `idem` is
  an **idempotency key** — set it to the cluster id so a retry can't double-post
  the same story (cheap insurance on top of our dedup store). Note v2 renamed the
  reply param `replyTo` → `parent`.
- **Ingest outlet posts** — use the **user casts feed** (`/v2/farcaster/feed/user/casts/`)
  for originals; do *not* use `/feed/user/replies_and_recasts/`. The returned cast
  object exposes `parent_hash`, `parent_url`, `root_parent_url`, `embeds`,
  `channel` — exactly the fields our reply/quote filter needs.
- **Recast** — `publishReaction({ signerUuid, reactionType: 'recast', target: hash })`.
- **Embed enrichment (optional)** — `/v2/farcaster/cast/embed/crawl/` returns
  metadata for a URL, handy for previewing/validating embeds before casting.
- **Signer** — see "Which signer should you use" in the docs. For a dedicated bot,
  the **managed-signers** example app is the quickstart; Sign-In-With-Neynar (SIWN)
  is the path where Neynar covers the onchain fee.

**Phase 2/3 hooks (not built now, but Neynar already supports them):**
- **Channel roles for the veto** — `/v2/farcaster/channel/member/list/` and the
  `author_channel_context.role` field expose moderator/lead, so the backstop veto
  can be gated to the real /politics moderator rather than a hardcoded key.
- **Tag-to-ask agent** — Neynar **webhooks** with a `cast.created` subscription
  filtered by `mentioned_fids` is the mention listener for the conversational
  agent (more real-time and cheaper than polling notifications).
- **Real-time outlet ingestion** — the same `cast.created` webhook filtered by the
  outlets' `author_fids` can supplement RSS for outlets active on Farcaster.
- **Token gating** — `/v2/farcaster/user/balance/` gives a user's current token
  balances by FID (good for live gating), but the QV *snapshot* still needs a
  direct onchain `balanceOf` at the snapshot block.

---

## 8. Open design decisions

1. **Empire score formula** — pure holdings vs. holdings + participation/reputation (recommendation: blended).
2. **Meta-analysis MVP depth** — basic same-event clustering only, or include lightweight source-lean tagging at launch.
3. **Reward mechanics** — exact emission/cap from the owner-controlled $POLITICS rewards pool.
4. **Source-lean tagging method** — if/when added, how lean is determined (and acknowledging it's inherently contestable; "decentralized preferences" framing is the mitigation).
5. **Launch shape** — ship agent-only (Tier 0) first, or agent + mini app (Tier 1) together.
6. **Token naming** — confirm token symbol ($POLITICS) vs. project name (Politech) for consistency.

---

## 9. Risks & safeguards

- **Editorial accountability**: the agent posts political commentary under the owner's channel — keep the voice clearly labeled as "Politech's take," and the owner owns tone.
- **Copyright**: commentary/synthesis must be original and in the agent's own words; link out to sources; never reproduce article text.
- **Prediction-market framing**: Policast casts are framed as discussion/signal, not betting advice.
- **Sybil resistance (governance)**: QV only resists whales if FID-gated; build that in from the start of Phase 2.
- **Privacy (Phase 4)**: opt-in consent, coarse location, no broadcast of inferred political labels — non-negotiable.
- **Spam perception**: throttle cadence; prefer one clustered meta-analysis cast over many duplicate reposts.

---

## 10. Success metrics (initial)

- Channel cast engagement (replies, recasts, reactions) on Politech casts.
- % of casts that are clustered meta-analysis vs. single reposts.
- Newcomer questions answered (Phase 3).
- Source list growth + governance participation (Phase 2).
- Member retention / active participants in /politics.

---

## 11. Glossary

- **Politech** — the agent/app/project.
- **$POLITICS** — the existing, owner-controlled governance/rewards token (on Base).
- **/politics** — the Farcaster channel, owned by the operator.
- **Empire score** — a per-member rank driving interaction depth and reward share (composition TBD).
- **Decentralized preferences** — the community-curated source set that defines Politech's editorial lens.
