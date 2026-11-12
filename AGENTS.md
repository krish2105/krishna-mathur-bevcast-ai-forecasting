<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (BEVCAST AI)

- The executed notebook in `notebook/` is the single source of truth. Never hand-edit `data/*.json`; re-run `scripts/export_results.py`.
- Every displayed number is labelled: reference (notebook), in-app engine, live, uploaded, simulated or proxy. Never mix reference and engine numbers.
- Secrets (GOOGLE_GENERATIVE_AI_API_KEY) are server-only and never committed.
