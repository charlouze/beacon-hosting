import { statSync } from 'node:fs';
import {
  isPlausibleSaveSize,
  Save,
  type Game,
  type LocalPath,
  type SaveDraft,
  type SaveStore,
} from '@beacon/session';
import { objectKeyFor, parseObjectKey } from './keys.js';
import type { ObjectApi } from './object-api.js';

/**
 * `SaveStore` over Scaleway Object Storage. The s3 vocabulary — bucket, key,
 * prefix — stops here and never enters `session` (§4).
 *
 * It has no delete, because the port has none, because the system has none
 * (§8). What prunes is a lifecycle rule of the bucket, and it is posed by a
 * human once.
 */
export class ScalewaySaveStore implements SaveStore {
  constructor(private readonly api: ObjectApi) {}

  async list(game: Game): Promise<Save[]> {
    // A failure propagates, deliberately. An empty list means "this game has
    // never been saved" and a caller acts on it by generating a fresh world;
    // a bucket that cannot answer must never be able to say that.
    const summaries = await this.api.list(`saves/${game}/`);

    const saves: Save[] = [];
    for (const summary of summaries) {
      const parsed = parseObjectKey(summary.key);
      // Two skips, one reason: what this cannot vouch for, it does not offer.
      // A key it did not write, or an object under the floor, would each hand a
      // restore something that is not a world.
      if (parsed === null) continue;
      if (parsed.game !== game) continue;
      if (!isPlausibleSaveSize(summary.sizeBytes)) continue;
      saves.push(
        Save.of({
          createdAt: parsed.createdAt,
          game: parsed.game,
          objectKey: summary.key,
          sizeBytes: summary.sizeBytes,
          origin: parsed.origin,
        }),
      );
    }

    // Newest first, from the key and not from `lastModified`: the key carries
    // the instant the world was *saved*, the metadata carries the instant it
    // was *uploaded*, and a retry would make the second lie about the first.
    return saves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async fetch(save: Save, toFile: LocalPath): Promise<void> {
    await this.api.get(save.objectKey, toFile);
  }

  async deposit(fromFile: LocalPath, draft: SaveDraft): Promise<Save> {
    // Built before the upload, and that ordering is the point: `Save.of` is the
    // floor, so an implausible archive is refused before a byte leaves the
    // machine rather than after (§8).
    const save = Save.of({
      createdAt: draft.createdAt,
      game: draft.game,
      objectKey: objectKeyFor(draft),
      sizeBytes: statSync(fromFile).size,
      origin: draft.origin,
    });
    await this.api.put(save.objectKey, fromFile);
    return save;
  }
}
