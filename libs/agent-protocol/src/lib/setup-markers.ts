import {
  isSetupActivity,
  isSetupStep,
  type SetupActivity,
  type SetupDeclaration,
  type SetupStep,
} from '@beacon/session';

/**
 * One thing a game prints that says where its setup is. The pattern is tried
 * on each line of the game's output; its first capture group, when it has
 * one, is the progress.
 */
export interface SetupMarker {
  readonly pattern: string;
  readonly step: SetupStep;
  readonly activity?: SetupActivity;
}

/**
 * What a game server declares of its setup once its own container runs: the
 * step it starts on, and what in the game's output moves it. The catalogue
 * writes it and the machine reads it, so both ends of that file live here.
 */
export interface AgentSetup {
  readonly startStep: SetupStep;
  readonly markers: readonly SetupMarker[];
}

/** One line, so that it sits in a block of a larger file. */
export function renderAgentSetup(setup: AgentSetup): string {
  return JSON.stringify({
    startStep: setup.startStep,
    markers: setup.markers.map(({ pattern, step, activity }) => ({
      pattern,
      step,
      ...(activity === undefined ? {} : { activity }),
    })),
  });
}

function markerFrom(value: unknown): SetupMarker | null {
  if (typeof value !== 'object' || value === null) return null;
  const { pattern, step, activity } = value as Record<string, unknown>;

  if (typeof pattern !== 'string' || pattern === '') return null;
  try {
    new RegExp(pattern);
  } catch {
    return null;
  }
  if (!isSetupStep(step)) return null;
  if (activity !== undefined && !isSetupActivity(activity)) return null;

  return { pattern, step, ...(activity === undefined ? {} : { activity }) };
}

/** Null when the text is not a file this protocol wrote. */
export function parseAgentSetup(text: string): AgentSetup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { startStep, markers } = raw as Record<string, unknown>;

  if (!isSetupStep(startStep) || !Array.isArray(markers)) return null;
  const read = markers.map(markerFrom);
  if (read.some((marker) => marker === null)) return null;

  return { startStep, markers: read as SetupMarker[] };
}

function progressFrom(captured: string | undefined): number | null {
  if (captured === undefined || captured.trim() === '') return null;
  const value = Number(captured);
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.floor(value)));
}

/**
 * What the game's output says of the setup: the last line that answers a
 * marker decides, and on a line that answers several the first of the list
 * wins. Null while no line answers.
 */
export function declaredByMarkers(setup: AgentSetup, output: string): SetupDeclaration | null {
  const markers = setup.markers.map((marker) => ({
    marker,
    expression: new RegExp(marker.pattern),
  }));
  const lines = output.split(/\r?\n/);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    for (const { marker, expression } of markers) {
      const match = expression.exec(lines[index]);
      if (match === null) continue;
      const progress = progressFrom(match[1]);
      return {
        step: marker.step,
        ...(marker.activity === undefined ? {} : { activity: marker.activity }),
        ...(progress === null ? {} : { progress }),
      };
    }
  }
  return null;
}
