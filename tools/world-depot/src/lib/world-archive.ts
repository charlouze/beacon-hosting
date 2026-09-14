import { create as createArchive, t as listArchive } from 'tar';

/**
 * Packs what `fromDir` *contains* — never `fromDir` itself — and answers the
 * entries the archive actually holds, read back from the file just written.
 *
 * Both halves matter. The `cwd` is the measured trap: an archive built one
 * folder higher gives `Worlds/Worlds/<world>`, the server does not complain,
 * it generates a blank world, somebody plays there, and the evening's push
 * becomes the newest save (§8). And the listing is read from the archive
 * rather than from the directory walk, because what has to be judged is what
 * `tar` wrote, not what the caller believed it asked for.
 *
 * It judges nothing itself: the caller hands these entries to the catalogue,
 * which is where §4 keeps the knowledge of what each game's world looks like.
 */
export async function buildWorldArchive(fromDir: string, toFile: string): Promise<readonly string[]> {
  await createArchive({ file: toFile, cwd: fromDir, gzip: true, portable: true }, ['.']);

  const entries: string[] = [];
  await listArchive({
    file: toFile,
    onReadEntry: (entry) => {
      entries.push(entry.path);
    },
  });
  return entries;
}
