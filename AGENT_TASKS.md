# Worm — Deliverables

This is the authoritative ledger of work for the `worm` project. Status markers: `- [ ]` available, `- [~]` in progress, `- [x]` complete, `- [!]` blocked.

**Pickup rule:** select the lowest-numbered `- [ ]` task whose listed dependencies are all `- [x]`.

---

## D1 — Repo scaffolding & tooling

- [x] **D1**
- **Dependencies:** none
- **Scope:**
  - Initialise npm workspaces at the repo root with `packages/shared`, `packages/server`, `packages/web`.
  - Root `package.json` scripts: `dev`, `build`, `test`, `lint` (delegating to workspaces via `npm run -ws` or `concurrently` for `dev`).
  - Add `tsconfig.base.json` with strict TypeScript settings; per-package `tsconfig.json` extending it.
  - Add ESLint (TypeScript + Prettier compatible) and Prettier configs at the root.
  - Add `.editorconfig`.
  - Each package gets a stub `src/index.ts` (e.g. `export {};`) and its own `package.json` (private, with `name`, `version`, `main`/`module`, `types`, build script).
  - Do **not** add Express, Socket.IO, uPlot, Vite, or Vitest yet — those belong to their own deliverables. (Dev tooling: TypeScript, ESLint, Prettier are fine here.)
- **Files to touch:** `package.json`, `package-lock.json`, `tsconfig.base.json`, `.editorconfig`, `.eslintrc.cjs`, `.prettierrc`, `packages/{shared,server,web}/package.json`, `packages/{shared,server,web}/tsconfig.json`, `packages/{shared,server,web}/src/index.ts`.
- **Acceptance:**
  - `npm install` succeeds at the repo root.
  - `npm run lint` passes against the stubs.
  - `npm run build` succeeds (each workspace's `tsc` produces a `dist/`).
  - Workspaces are recognised: `npm run -w @worm/shared build` works.

---

## D2 — Shared event contract

- [x] **D2**
- **Dependencies:** D1
- **Scope:** in `packages/shared/src/`, export the wire contract used by both server and web.
  - `export type ReactionKind = 'up' | 'down';`
  - `export interface Reaction { kind: ReactionKind }` — server stamps its own time on receipt; clients never send timestamps.
  - `export interface Sample { t: number; value: number }` — `t` is unix ms; `value` is a real number in the closed interval `[-1, +1]` (i.e. any float between `-1` and `+1` inclusive, such as `0.42`).
  - `export const EVENTS = { reaction: 'reaction', sample: 'sample', history: 'history' } as const;`
  - `export interface ServerToClientEvents { sample(s: Sample): void; history(samples: Sample[]): void }`.
  - `export interface ClientToServerEvents { reaction(r: Reaction): void }`.
  - Re-export everything from `packages/shared/src/index.ts`.
- **Files to touch:** `packages/shared/src/*.ts`, `packages/shared/package.json` (ensure `types` and `main` resolve to built output).
- **Acceptance:**
  - `npm run build -w @worm/shared` produces `.d.ts` files.
  - `packages/server` and `packages/web` can declare `"@worm/shared": "*"` and import the types/values without TypeScript errors.

---

## D3 — Aggregator core + tests

- [x] **D3**
- **Dependencies:** D2
- **Scope:**
  - Add Vitest as a dev dependency in `packages/server`.
  - Implement `packages/server/src/aggregator.ts`:
    - `class RollingAggregator` with constructor options `{ windowMs?: number; historySize?: number }` defaulting to `10_000` and `60`.
    - `record(kind: ReactionKind, nowMs: number): void` — store events in an internal queue.
    - `tick(nowMs: number): Sample` — discard events older than `windowMs`, compute mean (`up` → `+1`, `down` → `-1`), append to a ring buffer of history capped at `historySize`, return the new sample.
    - `history(): Sample[]` — return a defensive copy of the history.
  - Pure: no timers, no I/O, no `Date.now()` inside the class.
- **Tests** (in `packages/server/src/aggregator.test.ts`):
  - Empty window returns `value: 0`.
  - Equal numbers of up/down → `0`.
  - All up → `1`; all down → `-1`.
  - Events older than `windowMs` are excluded.
  - History caps at `historySize` (oldest dropped first).
  - `history()` returns a copy (mutating it does not affect future ticks).
- **Files to touch:** `packages/server/src/aggregator.ts`, `packages/server/src/aggregator.test.ts`, `packages/server/package.json`, `packages/server/vitest.config.ts` (if needed).
- **Acceptance:**
  - `npm test -w @worm/server` is green with all the cases above.
  - No runtime dependencies added (Vitest is `devDependencies` only).

---

## D4 — HTTP + Socket.IO server

- [x] **D4**
- **Dependencies:** D3
- **Scope:**
  - Add `express` and `socket.io` as runtime deps in `packages/server`.
  - `packages/server/src/index.ts`:
    - Create an Express app; serve `packages/web/dist` statically at `/` (gracefully no-op if it does not exist yet — log a warning).
    - Attach a Socket.IO server to the same HTTP server, typed with the `ServerToClient`/`ClientToServer` interfaces from `@worm/shared`.
    - Instantiate one `RollingAggregator`.
    - On client connection: emit `EVENTS.history` with the current history.
    - `setInterval(1000)`: call `aggregator.tick(Date.now())` and broadcast the resulting sample as `EVENTS.sample`.
    - On `EVENTS.reaction` from a client: validate `kind` is `'up' | 'down'`; on success call `aggregator.record(kind, Date.now())`; otherwise drop silently.
    - Read `PORT` from env, default `3000`. Log the listening URL.
  - Provide an npm script `dev` in `packages/server` using `tsx` (or `ts-node`) watching `src/`.
- **Files to touch:** `packages/server/src/index.ts`, `packages/server/package.json`.
- **Acceptance:**
  - `npm run dev -w @worm/server` starts without errors.
  - Hitting `http://localhost:3000/` returns either the built web bundle or a clear placeholder when `web/dist` is absent.
  - A manual Socket.IO client receives one `history` event on connect and a `sample` every ~1s.
  - Sending a `reaction` event with `{ kind: 'up' }` shifts subsequent samples positive.

---

## D5 — Frontend skeleton & dark theme

- [x] **D5**
- **Dependencies:** D2
- **Scope:**
  - Add Vite + TypeScript to `packages/web`. No UI framework.
  - `packages/web/index.html`: a single `<div id="app">` filling the viewport.
  - `packages/web/src/main.ts`, `packages/web/src/styles.css`:
    - Black background (`#000`), no scrollbars, container fills `100vw` × `100dvh`.
    - Two large emoji buttons (👍 and 👎), fixed in the bottom-left corner, comfortably tappable (~64px font-size, generous padding, no default button chrome — just transparent background, visible focus ring).
    - Buttons call a stub `submit(kind: ReactionKind)` (logs to console for now).
  - Vite config: dev server proxies `/socket.io` to `http://localhost:3000` so D7 works seamlessly.
- **Files to touch:** `packages/web/index.html`, `packages/web/src/main.ts`, `packages/web/src/styles.css`, `packages/web/vite.config.ts`, `packages/web/package.json`, `packages/web/tsconfig.json`.
- **Acceptance:**
  - `npm run dev -w @worm/web` opens a black page with the two emoji buttons anchored bottom-left.
  - Resizing the window keeps the buttons anchored without layout jank.
  - `npm run build -w @worm/web` produces `packages/web/dist/index.html` plus assets.

---

## D6 — uPlot graph rendering

- [x] **D6**
- **Dependencies:** D5
- **Scope:**
  - Add `uplot` as a runtime dep in `packages/web`.
  - Create `packages/web/src/graph.ts` exporting `createGraph(container: HTMLElement)` returning `{ pushSample(s: Sample): void; setHistory(samples: Sample[]): void; destroy(): void }`.
  - Configuration:
    - Single series, stroke `#ff2a2a`, width `2.5`.
    - y-axis fixed scale `[-1, 1]`; x-axis is a trailing 60-second window (`[now - 60_000, now]`, advancing each push).
    - Background black; grid + tick stroke pale grey (`#444` or similar).
    - Gridlines: x every 5s, y every 0.2.
    - Bold horizontal midline at `y = 0` (slightly brighter than the rest of the grid).
    - Hide cursor/legend (no hover UI).
  - Use a `ResizeObserver` on the container to call `uplot.setSize` so the chart fills the container at all sizes.
  - Wire it up in `main.ts` so the graph occupies the whole viewport behind the buttons.
  - Until D7 lands, drive the chart with a small synthetic generator inside `main.ts` so the deliverable is verifiable standalone (this generator must be removed in D7).
- **Files to touch:** `packages/web/src/graph.ts`, `packages/web/src/main.ts`, `packages/web/src/styles.css`, `packages/web/package.json`.
- **Acceptance:**
  - With the synthetic generator, the worm scrolls smoothly across a 60-second window.
  - Resizing the browser redraws the chart cleanly with no overflow or distortion.
  - Gridlines appear at the specified intervals; midline at `y=0` is visibly bolder.

---

## D7 — Socket client wiring

- [x] **D7**
- **Dependencies:** D4, D6
- **Scope:**
  - Add `socket.io-client` as a runtime dep in `packages/web`.
  - Create `packages/web/src/socket.ts` that connects to the same origin (Vite proxy handles dev), typed with the `ServerToClient`/`ClientToServer` interfaces from `@worm/shared`.
  - In `main.ts`:
    - Remove the synthetic generator from D6.
    - On `EVENTS.history` → `graph.setHistory(samples)`.
    - On `EVENTS.sample` → `graph.pushSample(sample)`.
    - The `submit(kind)` stub now emits `EVENTS.reaction` with `{ kind }`.
  - Handle disconnect/reconnect: on reconnect, the next `history` event re-hydrates the chart (no extra logic needed beyond Socket.IO defaults).
- **Files to touch:** `packages/web/src/socket.ts`, `packages/web/src/main.ts`, `packages/web/package.json`.
- **Acceptance:**
  - With both `npm run dev -w @worm/server` and `npm run dev -w @worm/web` running, opening the web page shows the worm updating once per second.
  - Clicking 👍 in one browser tab visibly raises the worm in another tab within ~1s; 👎 lowers it.
  - A new tab joining mid-session immediately renders the last 60 seconds of history.

---

## D8 — Dockerfile

- [x] **D8**
- **Dependencies:** D4, D7
- **Scope:**
  - Multi-stage `Dockerfile` at the repo root:
    - **Build stage** (`node:20-alpine` or current LTS): copy the repo, run `npm ci` then `npm run build` (which builds shared, server, web).
    - **Runtime stage** (same base, slim): copy `packages/server/dist`, `packages/shared/dist`, `packages/web/dist`, and the production `node_modules` needed by the server. Set `NODE_ENV=production`, `EXPOSE 3000`, `CMD ["node", "packages/server/dist/index.js"]`.
  - Add a `.dockerignore` excluding `node_modules`, `dist`, `.git`, `*.log`, etc.
- **Files to touch:** `Dockerfile`, `.dockerignore`.
- **Acceptance:**
  - `docker build -t worm .` succeeds.
  - `docker run --rm -p 3000:3000 worm` serves the working app at `http://localhost:3000` — the worm renders, reactions submitted from one browser appear in another.
  - Final image does not contain dev dependencies or source TypeScript.

---

## Parallelism map

```
D1 → D2 → ┬─ D3 ─→ D4 ─┐
          │            ├─→ D7 → D8
          └─ D5 ─→ D6 ─┘
```

After D2 lands, **D3 and D5** can run in parallel. After they land, **D4 and D6** can run in parallel. D7 needs both. D8 is last.
