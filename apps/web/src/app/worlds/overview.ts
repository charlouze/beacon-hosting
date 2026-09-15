import type { WorldSummary } from '@beacon/session-record/client';
import type { Announced } from '../format';

export function overview(worlds: readonly WorldSummary[]): Announced {
  const runningCount = worlds.filter((w) => w.server?.session.state === 'RUNNING').length;

  if (worlds.length === 0) {
    return { label: 'No world yet', tone: 'off' };
  }

  if (runningCount === 0) {
    return { label: 'Nothing running', tone: 'off' };
  }

  return { label: `${runningCount} in service`, tone: 'live' };
}

/**
 * Orders worlds by urgency: running, preparing, closing, failed, idle, then unreadable.
 * Breaks ties by name. Does not modify the original array.
 */
export function byUrgency(worlds: readonly WorldSummary[]): readonly WorldSummary[] {
  const statePriority = (w: WorldSummary): number => {
    const state = w.server?.session.state;
    switch (state) {
      case 'RUNNING':
        return 0;
      case 'PROVISIONING':
        return 1;
      case 'STOPPING':
        return 2;
      case 'FAILED':
        return 3;
      case 'IDLE':
        return 4;
      default:
        return 5;
    }
  };

  return [...worlds].sort((a, b) => {
    const aPriority = statePriority(a);
    const bPriority = statePriority(b);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return a.world.name.localeCompare(b.world.name);
  });
}
