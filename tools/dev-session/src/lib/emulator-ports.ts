export interface EmulatorPorts {
  /** What the tunnel points at. */
  readonly functions: number;
  /** What answers whether the emulator has finished coming up. */
  readonly hub: number;
  /** Where the operator watches the database and the function logs. */
  readonly ui: number;
}

interface DeclaredPort {
  readonly port?: number;
  readonly enabled?: boolean;
}

/**
 * Read rather than copied. Three ports decide whether this command works at
 * all, and a default taken silently — `firebase-tools` has one for each — is
 * the failure that looks like a tunnel fault: the box carries, nothing is
 * behind it, and the verdict blames the wrong half.
 */
export function emulatorPortsFrom(configText: string): EmulatorPorts {
  const emulators = (JSON.parse(configText) as { emulators?: Record<string, DeclaredPort> }).emulators ?? {};

  const portOf = (name: string): number => {
    const declared = emulators[name];
    if (declared?.port === undefined) {
      throw new Error(`firebase.dev.json declares no port for the ${name} emulator, and this command will not guess one`);
    }
    return declared.port;
  };

  // Ports first: a config that declares no ui at all must be told which port is
  // missing, not that its ui is switched off — a message it cannot act on.
  const ports = { functions: portOf('functions'), hub: portOf('hub'), ui: portOf('ui') };

  if (emulators['ui']?.enabled !== true) {
    throw new Error('firebase.dev.json has the ui emulator switched off, and a session is conducted by watching it');
  }

  return ports;
}
