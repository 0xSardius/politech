// Stage 1: pull raw candidates from every configured source.

import type { SourceRef } from '@politech/shared';
import type { SourceConfig } from './config/sources';

/** A raw pre-pipeline item. Internal to the agent — not part of the contract. */
export interface Candidate {
  source: SourceRef;
  title: string;
  url: string;          // target URL (article / video / cast)
  publishedAt: string;  // ISO
  /** Farcaster-only fields the filter stage needs (hard rules 1–2). */
  castHash?: string;
  parentHash?: string | null;
  hasCastEmbed?: boolean;
  /** YouTube-only hints for the Shorts/livestream filter (hard rule 10). */
  isShort?: boolean;
  isLivestream?: boolean;
}

export async function ingestAll(sources: SourceConfig[]): Promise<Candidate[]> {
  // TODO(M2): rss-parser for rss + youtube; client.fetchCastsForUser({ fid })
  // for farcaster outlets (NEVER /feed/user/replies_and_recasts/); Policast fetch.
  void sources;
  return [];
}
