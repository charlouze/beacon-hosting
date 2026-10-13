/** Where the host keeps what the game prints, and what the agent mounts read-only. */
export const GAME_LOG_DIR = '/opt/beacon/log';
export const GAME_LOG_FILE = `${GAME_LOG_DIR}/game.log`;

/** Where the agent reads what it declares of this game's setup. */
export const SETUP_MARKERS_FILE = '/opt/beacon/setup-markers.json';

export const GAME_LOG_UNIT = 'beacon-game-log.service';

/**
 * The unit that copies the output of the game's service into a file. The agent
 * holds no docker socket, so a file is the only form that output can reach it
 * in.
 *
 * Measured, `probe/RESULTS.md` section P: this command follows a service
 * across its restarts and writes what `docker logs` gives, and launched before
 * the container exists it returns at once, without an error. So the unit is
 * started before the compose and calls the command again for as long as it
 * returns.
 */
export const gameLogUnit = (service: string): string => `[Unit]
Description=Copy the output of the game into a file
After=docker.service
# Never given up on: until the game's container exists the command returns at
# once, and this unit is what calls it again.
StartLimitIntervalSec=0
[Service]
# Each start writes the file again from its beginning, and the command begins
# by printing everything the container has said so far.
ExecStart=/bin/sh -c 'exec /usr/bin/docker compose -f /opt/beacon/docker-compose.yml --env-file /opt/beacon/.env logs -f --no-color --no-log-prefix ${service} > ${GAME_LOG_FILE}'
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
`;
