// The shared data contract — the ONLY coupling between the agent and the
// mini app. Both sides import from here; change with care.

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

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PolitechPoll {
  id: string;
  question: string;
  options: PollOption[];
  opensAt: string;       // ISO
  closesAt: string;      // ISO
  mode: 'simple';        // Phase 2: 'quadratic' | 'plutocratic'
  relatedItemId?: string;
}
