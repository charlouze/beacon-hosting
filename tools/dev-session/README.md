# dev-session

One command for an evening of testing against a real game machine:

```bash
mise run session
```

It opens a tunnel, points `AGENT_ENDPOINT` at it, builds, starts the emulator
and its ui, seeds, proves the 401 through the tunnel, starts the pilot, and
holds the window until ctrl-c.

## The order is the product

`apps/functions/dist/.env` is a **copy**, laid down by the build, and the
emulator reads it once at startup. So the only order that works is: tunnel,
rewrite, build, emulator, seed, probe, pilot. Rewriting after the build, or
building after the emulator has started, provisions a billed machine that
reports to a dead url. That happened on 2026-09-08, and the two sessions it
cost are written up in
[the tranche 3 bis log](../../docs/superpowers/plans/2026-09-09-tranche-3-bis-session.md).

## What the 401 proves

One `POST` with a token that does not exist. `401` says three things at once:
the tunnel carries, the function is loaded, and the token barrier bites. Every
other answer says which of the three failed — `404` a wrong url, `502` nothing
listening behind the tunnel, `400` this command's own probe drifting from
`@beacon/agent-protocol`, and `200` an endpoint that guards nothing at all.

## What it does not do

- **It never refuses a branch.** It prints the branch, the commit and whether
  the tree is dirty, then carries on — including on `main`. It builds what is
  in the tree, so what is served and what is checked out are the same thing.
- **It touches nothing that is billed.** No provider api, no production
  database. It stops at the 401; opening a session is the human gesture that
  follows.
- **It knows no game and no save prefix.** It depends on no library in this
  repository.

## When something is left running

Every child is stopped in reverse order on the way out — pilot, emulator,
tunnel — and each one is confirmed dead rather than assumed. If a line says
`still alive`, a port is still held and the next run will fail on it.
