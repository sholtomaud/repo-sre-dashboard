# Repo SRE Dashboard

A GitHub Action that publishes a reliability dashboard for your repository to GitHub Pages, at `https://<owner>.github.io/<repository>/dashboard/`, and keeps it up to date.

It answers:

- **Who resolves your issues?** The **Developer Doomsday Clock** reads 00:00 when people resolve everything and 24:00 (midnight) when AI agents do. Agents are recognised by account type and login: Copilot, Claude, Codex, Devin, any `[bot]`, and any logins you add.
- **How fast?** A velocity dial: issues resolved per day by agents and by humans, against new issues per day, and whether you are ahead or behind.
- **Is the backlog growing?** The **bug doom loop**: issues opened per issue closed, overall and for bug reports alone.
- **Were closed issues really fixed?** Every closure is checked for a referenced commit, pull request or release; closures without one are shown, not hidden.
- **How quickly do people get an answer?** Time to first response and time to resolution.
- **Where is it heading?** A replay of the whole record, then a forecast simulated with [GSSK](https://github.com/energese-project/GSSK-Giannantoni), which stops where it becomes no better than a guess.
- **Will it stay manageable?** The **project outlook**: a manageability index (the chance of staying in control), the date control would be lost, with and without people's help, when the backlog could be cleared, whether agents are a benefit or a burden, and what it costs. Each class of issue has a limit on how long a new issue may wait: 7 days for security by default, 30 for bugs, 180 for the rest.
- **How do you get more out of it?** A checklist of repository habits (issue forms, labels, linked fixes, a schedule), each with what was found and how to improve it.

It started as the [Developer Doomsday Clock](https://github.com/sholtomaud/aws-emulator-bug-tracker) for `aws/aws-emulator`.

## Quick start

1. Add `.github/workflows/dashboard.yml` to your repository:

   ```yaml
   name: Dashboard
   on:
     schedule:
       - cron: '17 */6 * * *' # every 6 hours; the dashboard shows this schedule
     workflow_dispatch:
   permissions:
     contents: write # to push the dashboard to the gh-pages branch
   concurrency:
     group: dashboard
   jobs:
     publish:
       runs-on: ubuntu-latest
       steps:
         - uses: sholtomaud/repo-sre-dashboard@v1
   ```

2. Run it once from the Actions tab. It creates a `gh-pages` branch if there is none.
3. In **Settings → Pages**, set **Source** to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.

The dashboard is then at `https://<owner>.github.io/<repository>/dashboard/`. The run's summary prints the address.

## How it works

Each run:

1. checks out the `gh-pages` branch (or starts it);
2. reads the repository's issues through the GitHub API with the workflow's own token, and writes the dashboard's data (`data.csv`, `status.json`, `config.json`) under `dashboard/data/`;
3. copies in the prebuilt dashboard, a static site with no server, and pushes.

Nothing else on the `gh-pages` branch is touched, so it can sit beside an existing site. The runs need no `npm install`: the dashboard ships prebuilt in [`dist/`](dist/), and the tracker is TypeScript that Node runs directly.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `token` | `github.token` | Reads the repository and pushes to the Pages branch. |
| `path` | `dashboard` | Folder on the Pages branch, so the page is at `/<repository>/<path>/`. |
| `branch` | `gh-pages` | The Pages branch. |
| `title` | `Developer Doomsday Clock` | The dashboard's title. |
| `agent-logins` | | Extra logins to count as AI agents, comma separated. |
| `why`, `why-url` | | A note on why the repository is tracked, shown on the methodology page. |
| `queue-open-dir`, `queue-resolved-dir` | | For projects whose agents keep their own file-based queue: the folders of open and resolved issues. Adds a second queue, a weighting slider, and combined figures. |
| `queue-repository` | this repository | Where those folders live. |
| `queue-name` | `Agents' own queue` | The second queue's name. |
| `public-weight` | `0.5` | With a second queue, the GitHub issues' weight in the combined clock. |
| `security-days`, `bug-days`, `feature-days` | `7`, `30`, `180` | How long a new issue of each class may wait before the repository counts as unmanageable. Decimals allowed (`0.5` is 12 hours). |
| `agent-cost-per-issue`, `human-hourly-rate`, `human-hours-per-issue`, `monthly-budget`, `currency` | none, none, `2`, none, `USD` | Prices for the cost figures. Nothing about cost is shown until at least one price is set. |

The output `url` is the dashboard's address.

## Good to know

- **The dashboard is public** wherever your GitHub Pages site is public. It shows counts and rates, not issue titles or text, but consider that for private repositories.
- **It reflects your repository's habits.** If issues are not labelled, fixes are not linked, or the workflow has no schedule, the dashboard says so and recommends what to change rather than guess.
- **Forecasts are simulations**, calibrated on the last week and labelled as such on the page. The outlook back-tests itself on the record and reports how often its past forecasts were right.
- **Related work.** [burnscope](https://github.com/asklar/burnscope) also forecasts whether an issue backlog converges, and also refuses to give a date when it does not. It runs locally and reports completeness; this Action adds agent attribution, closure verification, per-class limits and a published dashboard.

## Developing

```bash
npm ci && npm test                 # the tracker, and the whole Action against a stand-in GitHub
cd dashboard && npm ci && npm run dev   # the dashboard, with sample data
```

After changing the dashboard, rebuild the shipped site with `npm run build:action` in `dashboard/` and commit `dist/`; CI checks it matches the source.

## Licence

MIT. The vendored GSSK kernel is MIT too (`dashboard/src/vendor/gssk/LICENSE`).
