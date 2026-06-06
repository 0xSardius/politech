// Stage 2: filter -> cluster -> dedupe.
// NOTE: dedup IS clustering — the same layer that prevents double-posting
// groups sources for meta-analysis. Don't split them.

import type { Store } from '@politech/shared';
import type { Candidate } from './ingest';

/** A group of candidates covering the same event. */
export interface Cluster {
  id: string;            // stable hash — also the publishCast idem key
  candidates: Candidate[];
}

export function filter(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => {
    // Hard rule 1: top-level casts only — parent_hash, NEVER parent_url.
    if (c.parentHash !== undefined && c.parentHash !== null) return false;
    // Hard rule 2: drop quote casts (embedded cast, not URL embed).
    if (c.hasCastEmbed) return false;
    // Hard rule 10: skip YouTube Shorts and livestream notices.
    if (c.isShort || c.isLivestream) return false;
    return true;
  });
}

/** Normalize a URL to its canonical form for dedup/cluster matching. */
export function canonicalUrl(url: string): string {
  // TODO(M3): strip tracking params, resolve redirects, normalize host.
  return url;
}

export function cluster(candidates: Candidate[]): Cluster[] {
  // TODO(M3): group by canonical-URL match or title overlap within a time
  // window. Embeddings are the later upgrade.
  return candidates.map((c) => ({ id: canonicalUrl(c.url), candidates: [c] }));
}

/** Drop clusters whose canonical URLs have all been cast already. */
export async function dedupe(clusters: Cluster[], store: Store): Promise<Cluster[]> {
  const fresh: Cluster[] = [];
  for (const cl of clusters) {
    const seen = await Promise.all(
      cl.candidates.map((c) => store.hasSeen(canonicalUrl(c.url))),
    );
    if (seen.some((s) => !s)) fresh.push(cl);
  }
  return fresh;
}
