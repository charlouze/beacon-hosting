import { t as listArchive } from 'tar';

export interface WorldIdentity {
  readonly name: string;
  readonly guid: string;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The name and GUID a world carries in its top-level folder — `<name>~<guid>`,
 * exactly what the entry point reads on the machine that restores it. Read
 * without extracting: the archive never has to touch disk twice for an
 * administrator only asking what it holds.
 *
 * Undefined rather than a guess when there is not exactly one candidate: both
 * callers print this next to a key, and a name printed for the wrong folder is
 * worse than no name at all — `retrieve` would misname what it just took, and
 * `adopt` would misname what it is about to cover.
 */
export async function worldIdentity(archive: string): Promise<WorldIdentity | undefined> {
  const names: string[] = [];
  await listArchive({
    file: archive,
    onReadEntry: (entry) => {
      // `tar` lists a directory as `./<name>/`, and neither end of that belongs
      // to the world's name: printed as-is the administrator reads `./Beacon's
      // World` where the server reads `Beacon's World`.
      if (entry.type === 'Directory') names.push(entry.path.replace(/^\.\//, '').replace(/\/$/, ''));
    },
  });

  const candidates = names
    .map((name) => {
      // Le dernier tilde, jamais le premier : le nom d'un monde peut en
      // porter un, et la machine coupe la aussi. Couper au premier imprimait
      // un nom tronque a cote de la cle.
      const separator = name.lastIndexOf('~');
      if (separator === -1) return null;
      const guid = name.slice(separator + 1);
      return GUID_PATTERN.test(guid) ? { name: name.slice(0, separator), guid } : null;
    })
    .filter((candidate): candidate is WorldIdentity => candidate !== null);

  return candidates.length === 1 ? candidates[0] : undefined;
}
