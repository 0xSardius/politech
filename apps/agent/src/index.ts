// Orchestrator: one pass through ingest -> filter -> cluster -> dedupe ->
// commentary -> publish. Run once (cron) or with --loop / POLITECH_RUN_LOOP=true.

import 'dotenv/config';
import { JsonFileStore, type PolitechItem } from '@politech/shared';
import { SOURCES } from './config/sources';
import { ingestAll } from './ingest';
import { canonicalUrl, cluster, dedupe, filter } from './pipeline';
import { writeCommentary } from './commentary';
import { isDryRun, publishItem } from './publish';

const CHANNEL_ID = process.env.POLITECH_CHANNEL_ID ?? 'politics';
const LOOP_INTERVAL_MS = 15 * 60 * 1000;

const store = new JsonFileStore(process.env.POLITECH_DATA_FILE ?? './data/store.json');

async function runPass(): Promise<void> {
  console.log(`[politech] pass started ${new Date().toISOString()} (dry-run: ${isDryRun()})`);

  const candidates = await ingestAll(SOURCES);
  const kept = filter(candidates);
  const clusters = await dedupe(cluster(kept), store);
  console.log(`[politech] ${candidates.length} candidates -> ${kept.length} kept -> ${clusters.length} fresh clusters`);

  for (const cl of clusters) {
    const primary = cl.candidates[0]!;
    const item: PolitechItem = {
      id: cl.id,
      kind: cl.candidates.length > 1 ? 'meta_analysis' : 'story',
      text: await writeCommentary(cl),
      sources: cl.candidates.map((c) => c.source),
      primaryUrl: primary.url,
      clusterId: cl.id,
      publishedAt: new Date().toISOString(),
      channelId: CHANNEL_ID,
    };

    const castHash = await publishItem(item);
    if (castHash) item.castHash = castHash;

    await store.saveItem(item);
    for (const c of cl.candidates) {
      await store.markSeen(canonicalUrl(c.url));
    }
  }

  console.log(`[politech] pass complete — ${(await store.listItems()).length} items in store`);
}

const loop = process.argv.includes('--loop') || process.env.POLITECH_RUN_LOOP === 'true';

await runPass();
if (loop) {
  console.log(`[politech] looping every ${LOOP_INTERVAL_MS / 60000} min`);
  setInterval(() => runPass().catch(console.error), LOOP_INTERVAL_MS);
}
