# The dashboard

The site the Action publishes, built with [Boba](https://github.com/sholtomaud/boba) (native Web Components and TypeScript, no framework runtime or chart library). It reads its data from `data/` beside it: `data.csv`, `status.json` and `config.json`, written by the tracker in [`../tracker`](../tracker), plus `agent_queue.csv` when a file-based queue is configured. For development, `scripts/sync-data.ts` copies the sample data in [`sample-data/`](sample-data/) into `public/data/`; `npm run build:action` builds the shipped site into `../dist` without it.

## What it shows

| Component | What it is |
| --- | --- |
| `doomsday-clock` | The Developer Doomsday Clock: a 24-hour dial at `(1 − agent resolution share) × 24` hours to midnight, 00:00 with no agent closures and 24:00 when agents close everything. With a second queue the share is combined across both. In the forecast it shows the likely range as a fan and its hands fade out. |
| `doom-loop` | Issues opened per issue closed over 7 days, on a log meter around 1× break-even, with a doubling or clearing projection and a sparkline. Above 2× is a bug doom loop. With a second queue it appears three times: combined, then one per queue. |
| `velocity-gauge` | Issues resolved per day: the needle is everyone, the inner arc splits agents (orange) from humans (purple), a blue mark shows new issues per day, and the outer arc is the gap (green and solid when ahead, red and dashed when behind). An odometer shows the open backlog. |
| `trend-chart` | Running totals over time, with a crosshair tooltip (mouse or arrow keys), toggleable series and a table view. |
| `queue-compare` | The agents' own in-repository queue beside the public GitHub issues: open, resolved, and new and agent-resolved per day on a shared scale. |
| `closure-evidence` | Closed issues by how they were closed (fix referenced, no referenced fix, declined, withdrawn, duplicate) and open issues by type. |
| `practice-list` | The repository habits checklist from `status.json`: each check's status, what was found, and a recommendation with a link to GitHub's documentation. |
| `weight-slider` | Sets how the public issues and the agents' queue are weighted in the combined clock, dial and doom loop, with presets derived from the data. Remembered per browser. |
| `replay-control` | Play/pause and a scrubber that run the clock, dials and doom loops through the whole record and on into the forecast, interpolated between days. |
| `dashboard-page` | Lays them out with the stat tiles and threat-level status. |
| `methodology-page` | How each number is calculated. |

All calculations live in [`src/services/metrics.ts`](src/services/metrics.ts) and [`src/services/insights.ts`](src/services/insights.ts) , [`src/services/combined.ts`](src/services/combined.ts), [`src/services/replay.ts`](src/services/replay.ts) and [`src/services/forecast.ts`](src/services/forecast.ts), which have no DOM code and are unit-tested alongside. Panels whose data is missing (an older `data.csv`, no `agent_queue.csv`) show a note instead of failing.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Copy the data and start the Vite dev server |
| `npm run build` | Copy the data and build `dist/` (`-- --base /repo-name/` for Pages) |
| `npm test` | Unit tests (`node --test`) |
| `npm run e2e` | Playwright tests: dev server, production build and sub-path build |
| `npm run typecheck` / `npm run lint` | `tsc` and oxlint + Prettier |

Deployment is handled by [`.github/workflows/pages.yml`](../.github/workflows/pages.yml).

## Forecast

The forecast runs in the browser on [GSSK](https://github.com/energese-project/GSSK-Giannantoni), vendored as WebAssembly in [`src/vendor/gssk/`](src/vendor/gssk/) (MIT). [`src/lib/gssk-simulator.ts`](src/lib/gssk-simulator.ts) builds the two-queue model; [`src/services/forecast.ts`](src/services/forecast.ts) calibrates it, runs 200 simulations and decides where the forecast stops. The page's Content Security Policy allows `wasm-unsafe-eval` for this.
