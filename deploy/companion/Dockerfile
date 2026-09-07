# Alpine, and pinned by digest — §10 forbids a moving tag on any image this
# system runs, ours included. Resolved 2026-09-06 from the upstream `22-alpine`
# tag; re-resolve by hand to move it, never by re-pulling the tag.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32

WORKDIR /app

# The esbuild bundle, and nothing else: no node_modules, no source, no manifest.
# What is not in the image cannot be a version this machine runs by surprise.
# `.mjs`, because the bundle is ESM and `restore.ts` ends on a top-level await.
# A `.js` here would be read as CommonJS — there is no manifest in this image to
# say otherwise — and the container would die on the first `import`.
COPY dist/ /app/

# The one thing this image does that a library cannot: give a restored folder to
# the uid the game server runs as. `chown` is in busybox; nothing else is needed.
USER root

ENTRYPOINT ["node"]
CMD ["/app/restore.mjs"]
