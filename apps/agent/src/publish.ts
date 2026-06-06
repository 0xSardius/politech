// Stage 4: the ONLY file that touches the Neynar signer.

import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';
import type { PostCastReqBodyEmbeds } from '@neynar/nodejs-sdk/build/api';
import type { PolitechItem } from '@politech/shared';

let client: NeynarAPIClient | null = null;

function getClient(): NeynarAPIClient {
  if (!client) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) throw new Error('NEYNAR_API_KEY is not set');
    client = new NeynarAPIClient(new Configuration({ apiKey }));
  }
  return client;
}

export function isDryRun(): boolean {
  return process.env.POLITECH_DRY_RUN !== 'false';
}

/**
 * Publish an item to the channel. The source URL in embeds drives the rich
 * preview; idem = clusterId so a retry can't double-post (hard rule 7).
 * Returns the cast hash, or null on a dry run.
 */
export async function publishItem(item: PolitechItem): Promise<string | null> {
  if (isDryRun()) {
    console.log(`[dry-run] would cast to /${item.channelId}:\n  ${item.text}\n  embed: ${item.primaryUrl}`);
    return null;
  }

  const signerUuid = process.env.POLITECH_SIGNER_UUID;
  if (!signerUuid) throw new Error('POLITECH_SIGNER_UUID is not set');

  const { cast } = await getClient().publishCast({
    signerUuid,
    text: item.text,
    // The generated PostCastReqBodyEmbeds type flattens an anyOf (url-embed
    // vs cast-embed) into all-required fields; the API accepts { url } alone.
    embeds: [{ url: item.primaryUrl } as PostCastReqBodyEmbeds],
    channelId: item.channelId,
    idem: item.clusterId ?? item.id,
  });
  return cast.hash;
}

/** Curated recast (hook-driven amplification). */
export async function recast(castHash: string): Promise<void> {
  if (isDryRun()) {
    console.log(`[dry-run] would recast ${castHash}`);
    return;
  }
  const signerUuid = process.env.POLITECH_SIGNER_UUID;
  if (!signerUuid) throw new Error('POLITECH_SIGNER_UUID is not set');

  await getClient().publishReaction({
    signerUuid,
    reactionType: 'recast',
    target: castHash,
  });
}
