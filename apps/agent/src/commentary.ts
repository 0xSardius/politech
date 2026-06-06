// Stage 3: Politech's voice. 1 source -> short original take;
// >=2 sources in a cluster -> one comparative meta-analysis cast.
// Hard rule 3: paraphrase and link out — NEVER reproduce article/cast text.

import type { Cluster } from './pipeline';

export async function writeCommentary(cluster: Cluster): Promise<string> {
  // TODO(M3): Anthropic SDK + hand-written persona system prompt.
  // Until then, a labeled placeholder so dry runs are inspectable.
  const names = cluster.candidates.map((c) => c.source.name).join(', ');
  return `[draft] ${cluster.candidates[0]!.title} — via ${names}`;
}
