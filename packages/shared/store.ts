// Persistence boundary. ALL persistence goes through this interface —
// no direct DB/file calls in business logic. JSON file for week 1,
// Postgres at launch; voting stays upgradeable behind votePoll().

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ItemKind, PolitechItem, PolitechPoll } from './contract';

export interface Store {
  /** Dedup: has this canonical URL already been processed? */
  hasSeen(canonicalUrl: string): Promise<boolean>;
  markSeen(canonicalUrl: string): Promise<void>;

  saveItem(item: PolitechItem): Promise<void>;
  listItems(opts?: { limit?: number; kind?: ItemKind }): Promise<PolitechItem[]>;

  savePoll(poll: PolitechPoll): Promise<void>;
  listPolls(): Promise<PolitechPoll[]>;
  /** One-FID-one-vote. A repeat vote by the same FID moves their vote. */
  votePoll(pollId: string, optionId: string, fid: number): Promise<PolitechPoll>;
}

interface StoreData {
  seen: string[];
  items: PolitechItem[];
  polls: PolitechPoll[];
  /** pollId -> fid -> optionId (internal; counts live on PollOption.votes) */
  votes: Record<string, Record<string, string>>;
}

const EMPTY: StoreData = { seen: [], items: [], polls: [], votes: {} };

export class JsonFileStore implements Store {
  private data: StoreData | null = null;

  constructor(private filePath: string) {}

  private async load(): Promise<StoreData> {
    if (this.data) return this.data;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.data = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      this.data = structuredClone(EMPTY);
    }
    return this.data!;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async hasSeen(canonicalUrl: string): Promise<boolean> {
    const data = await this.load();
    return data.seen.includes(canonicalUrl);
  }

  async markSeen(canonicalUrl: string): Promise<void> {
    const data = await this.load();
    if (!data.seen.includes(canonicalUrl)) {
      data.seen.push(canonicalUrl);
      await this.persist();
    }
  }

  async saveItem(item: PolitechItem): Promise<void> {
    const data = await this.load();
    const i = data.items.findIndex((x) => x.id === item.id);
    if (i >= 0) data.items[i] = item;
    else data.items.push(item);
    await this.persist();
  }

  async listItems(opts?: { limit?: number; kind?: ItemKind }): Promise<PolitechItem[]> {
    const data = await this.load();
    let items = [...data.items].sort(
      (a, b) => b.publishedAt.localeCompare(a.publishedAt),
    );
    if (opts?.kind) items = items.filter((x) => x.kind === opts.kind);
    if (opts?.limit) items = items.slice(0, opts.limit);
    return items;
  }

  async savePoll(poll: PolitechPoll): Promise<void> {
    const data = await this.load();
    const i = data.polls.findIndex((p) => p.id === poll.id);
    if (i >= 0) data.polls[i] = poll;
    else data.polls.push(poll);
    await this.persist();
  }

  async listPolls(): Promise<PolitechPoll[]> {
    const data = await this.load();
    return [...data.polls];
  }

  async votePoll(pollId: string, optionId: string, fid: number): Promise<PolitechPoll> {
    const data = await this.load();
    const poll = data.polls.find((p) => p.id === pollId);
    if (!poll) throw new Error(`Unknown poll: ${pollId}`);
    if (!poll.options.some((o) => o.id === optionId)) {
      throw new Error(`Unknown option ${optionId} for poll ${pollId}`);
    }
    const now = new Date().toISOString();
    if (now < poll.opensAt || now > poll.closesAt) {
      throw new Error(`Poll ${pollId} is not open`);
    }

    const votes = (data.votes[pollId] ??= {});
    votes[String(fid)] = optionId;

    // Recompute counts from the vote map — one FID, one vote.
    const tally = new Map<string, number>();
    for (const opt of Object.values(votes)) {
      tally.set(opt, (tally.get(opt) ?? 0) + 1);
    }
    for (const option of poll.options) {
      option.votes = tally.get(option.id) ?? 0;
    }

    await this.persist();
    return poll;
  }
}
