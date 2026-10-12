#!/usr/bin/env bash
# Local only, nothing billed. How long does a UDP query take to fail against a
# container that exists and listens on nothing — what the agent's readiness
# probe meets while a game is still downloading?
#
#   bash probe/setup-progress/udp-refusal.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

P=beaconudpprobe
NODE_IMAGE='node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32'

docker rm -f "$P-target" >/dev/null 2>&1
docker network rm "$P" >/dev/null 2>&1
docker network create "$P" >/dev/null
docker run -d --name "$P-target" --network "$P" "$NODE_IMAGE" sleep 120 >/dev/null

# A connected socket, as the agent's probe uses: the kernel hands an ICMP
# refusal back to it as an error.
docker run --rm --network "$P" "$NODE_IMAGE" node -e '
  const dgram = require("node:dgram");
  const started = Date.now();
  const socket = dgram.createSocket("udp4");
  const done = (what) => { console.log(what, "after", Date.now() - started, "ms"); socket.close(); process.exit(0); };
  socket.on("error", (error) => done("error " + error.code));
  socket.on("message", () => done("answer"));
  socket.connect(15637, process.argv[1], () => socket.send(Buffer.from("ping")));
  setTimeout(() => done("nothing"), 35000);
' "$P-target"

docker rm -f "$P-target" >/dev/null 2>&1
docker network rm "$P" >/dev/null 2>&1
