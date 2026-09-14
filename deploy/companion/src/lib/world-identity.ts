import { readdirSync } from 'node:fs';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WorldIdentity {
  name: string;
  guid: string;
}

// Le dernier tilde, jamais le premier : le nom d'un monde peut en porter un,
// et la machine comme le catalogue coupent la aussi. Couper au premier rendait
// un guid qui n'en est pas un, donc `failed` sur un serveur bien demarre.
const parseCandidate = (entryName: string): WorldIdentity | null => {
  const separatorIndex = entryName.lastIndexOf('~');
  if (separatorIndex === -1) return null;

  const name = entryName.slice(0, separatorIndex);
  const guid = entryName.slice(separatorIndex + 1);
  if (!GUID_PATTERN.test(guid)) return null;

  return { name, guid };
};

export const readWorldIdentity = (saveDir: string): WorldIdentity | null => {
  let entries;
  try {
    entries = readdirSync(saveDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => parseCandidate(entry.name))
    .filter((candidate): candidate is WorldIdentity => candidate !== null);

  return candidates.length === 1 ? candidates[0] : null;
};
