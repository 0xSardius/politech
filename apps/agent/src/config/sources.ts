// The curated source list — Politech's editorial lens. Community-curated
// in Phase 2; owner-curated for MVP.

export type SourceKind = 'rss' | 'youtube' | 'farcaster' | 'policast';

export interface SourceConfig {
  name: string;
  kind: SourceKind;
  /** Feed URL (rss/youtube/policast). YouTube uses the per-channel RSS:
   *  https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID> */
  url?: string;
  /** Farcaster outlet account (ingested via fetchCastsForUser). */
  fid?: number;
}

export const SOURCES: SourceConfig[] = [
  { name: 'Drop Site News', kind: 'rss', url: 'https://www.dropsitenews.com/feed' },

  // TODO(M2): fill real values —
  // { name: 'Breaking Points', kind: 'youtube',
  //   url: 'https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>' },
  // { name: '<outlet>', kind: 'farcaster', fid: <fid> },
  // { name: 'Policast', kind: 'policast', url: '<endpoint>' },
];
