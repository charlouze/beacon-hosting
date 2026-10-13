/**
 * What this game's container prints on a start that succeeds, as
 * `probe/RESULTS.md`, section P, quotes it and in the order it measured it.
 * The two traps it names are both here: an `ERROR!` on a start that succeeds,
 * and a progress back at zero once the download is over.
 */
export const ENSHROUDED_OUTPUT = [
  "ERROR! Failed to install app '2278520' (Missing configuration)",
  'Update state (0x3) reconfiguring, progress: 0.00 (0 / 0)',
  'Update state (0x61) downloading, progress: 36.46 (3212988231 / 8811579458)',
  'Update state (0x81) verifying update',
  'Update state (0x81) verifying update',
  'Update state (0x81) verifying update',
  'Update state (0x0) unknown, progress: 0.00 (0 / 0)',
  "Success! App '2278520' fully installed.",
  'enshrouded-server: started',
  '[game_server] Switching state from Load to LoadEcsScene',
  '[game_server] Switching state from LoadEcsScene to Run',
] as const;
