# Repo SRE Dashboard

A GitHub Action that publishes a reliability dashboard for your repository to GitHub Pages, at `https://<owner>.github.io/<repository>/dashboard/`, and keeps it up to date.

It shows, on one page:

- **What needs attention.** An instrument panel, with each kind of figure on the instrument that reads best for it: an annunciator panel that lights only what is abnormal, a resolution-velocity dial of issues resolved a day by agents and people against issues arriving, the opened-per-closed ratio on a log scale centred on break-even, dials for bounded shares with known limits, a crew split of agents and people, and a sign key. Then the few things to act on first: issues past their time limits, CI failing on the default branch, a backlog growing faster than it is worked, and the audit's most valuable fixes.
- **Where it is heading.** The **project outlook**, simulated with [GSSK](https://github.com/energese-project/GSSK-Giannantoni) from Bayesian rate estimates. It gives a manageability index (the chance of staying in control), the date control would be lost with and without people's help, when the backlog could be cleared, whether AI agents are a benefit or a burden, and, once you set prices, what it costs. The forecast stops where it becomes no better than a guess, and it back-tests itself on the record.
- **Issues.** The backlog over time and, for each class (security, bugs, features and other), what is open, what is past its limit, and how fast issues are resolved. By default security issues have 7 days, bugs 30 and the rest 180. It also checks whether each closure references a fix: closures without one are shown, not hidden.
- **Pull requests and agents.** Who writes the changes: an AI agent's account, a person working with an agent (named in a `Co-Authored-By` trailer or a "Generated with" signature), or a person alone. It shows merge rates and time to merge, and who resolves the issues. Agents are recognised by account type and login (Copilot, Claude, Codex, Devin, any `[bot]`, and any logins you add). Dependency and CI bots are left out.
- **Delivery.** The four DORA metrics (deployment frequency, lead time, change failure rate, time to restore), each banded from low to elite. Beside them, CI health on the default branch: runs passing, run time, time back to green, and what is failing now.
- **The codebase.** Languages, files and test files, package ecosystems, workflows and what they run, and branch protection.
- **An audit**, on its own page, with a readiness dial: how far the repository is from the ideal set-up for AI agents to work in and for this dashboard to measure, which agent autonomy that supports (not ready, supervised, or ready), where adding the audit's file fixes in one pull request would take it, and a smaller dial for each group of checks. About 30 best-practice checks: CI and tests, branch rules, Dependabot updates with auto-merged patches, supply-chain scanning with Socket, dependency review, CodeQL, OpenSSF Scorecard, pinned actions, least-privilege tokens, a security policy, issue forms and labels, linked fixes, releases and incident labels, AGENTS.md and CLAUDE.md (read for what they cover: build and test commands, test-driven development, how to raise issues, commit rules, security and attribution), an agent triage workflow, and cost inputs. Each check says what was found and why it matters, and gives a fix to copy, written for your repository's languages and package managers.

It started as the [Developer Doomsday Clock](https://github.com/sholtomaud/aws-emulator-bug-tracker) for `aws/aws-emulator`.

## Quick start

1. In **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Add `.github/workflows/dashboard.yml` to your repository:

   ```yaml
   name: Dashboard
   on:
     push:
       branches: [main] # redeploy on every merge
     schedule:
       - cron: '17 */6 * * *' # and every 6 hours; the dashboard shows this schedule
     workflow_dispatch:
   permissions:
     contents: read
     pages: write # deploy to GitHub Pages
     id-token: write # deploy to GitHub Pages
     issues: read
     pull-requests: read
     actions: read # CI health
     deployments: read # delivery metrics
   concurrency:
     group: pages
     cancel-in-progress: false
   jobs:
     publish:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.dashboard.outputs.url }}
       steps:
         - id: dashboard
           uses: sholtomaud/repo-sre-dashboard@v1
   ```

3. Run it once from the Actions tab, or push to `main`.

The dashboard is then at `https://<owner>.github.io/<repository>/dashboard/`, and the site's root redirects to it. The run's summary and the `github-pages` environment link to it.

### Already publishing a site from a branch?

A Pages deployment replaces the whole site. To keep an existing site that is published from a branch, publish the dashboard into a folder of that branch instead:

```yaml
- uses: sholtomaud/repo-sre-dashboard@v1
  with:
    publish-to: branch # commits to gh-pages:/dashboard, leaving the rest alone
```

That needs `contents: write` instead of `pages` and `id-token`, and **Settings → Pages → Source** set to **Deploy from a branch**.

### Turning findings into issues

Set `audit-issues: true` (and give the job `issues: write`) to have the audit open an issue for each finding of medium impact or more, with the fix in it. The issues are labelled `repo-sre-audit`, updated as findings change, closed when the check passes, and reopened if it fails again. They are left out of the dashboard's issue figures, so the audit never moves the numbers it measures.

### Permissions

The Action only reads the repository; it writes nothing but the Pages site. Without `actions: read` or `deployments: read` it still runs, and the audit names the permission that would let it measure CI health or deliveries.

## How it works

Each run:

1. reads the repository's issues, pull requests, files, workflows, CI runs, releases and deployments through the GitHub API with the workflow's own token, runs the audit, and writes the dashboard's data (`data.csv`, `pulls.csv`, `status.json`, `config.json`);
2. puts the prebuilt dashboard beside it, a static site with no server, with a copy of the page for each route and a 404 page, so links straight to `/dashboard/audit` work;
3. deploys it with GitHub's own `upload-pages-artifact` and `deploy-pages` actions (or, with `publish-to: branch`, commits it to the Pages branch).

The runs need no `npm install`: the dashboard ships prebuilt in [`dist/`](dist/), and the tracker is TypeScript that Node runs directly. Each run rebuilds the data from the API, so nothing has to be kept between runs; a file-based queue's history is fetched back from the live dashboard.

### The data, for agents and other tools

The page is one reader of the data; agents, scripts and CI can read the same files without running it. Beside the dashboard, each run publishes:

- `data/status.json`, with the audit under `audit.checks`, and `data/config.json`, `data/data.csv` and `data/pulls.csv`;
- `schema/status-v1.json`, the JSON Schema for `status.json`. `status.json` says which version it follows in `schema_version`, and `run_url` links the run that wrote it. Fields may be added within a version; removing or changing one makes a new version;
- `llms.txt`, which lists the files and says how to read the audit. The site's root gets one pointing to it, unless the site already has its own.

The page links to the data as well (`<link rel="alternate">`, and a list of the files for browsers without JavaScript). The files describe the repository; they give agents no instructions. What an agent may do in the repository belongs in its own `AGENTS.md`.

## Inputs

| Input                                                                            | Default                | What it does                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`                                                                          | `github.token`         | Reads the repository and pushes to the Pages branch.                                                                                                                                                                                                 |
| `publish-to`                                                                     | `pages`                | `pages` uploads and deploys with GitHub's Pages actions; `artifact` uploads without deploying (for a separate `deploy-pages` job); `branch` commits to a folder of the Pages branch; `branch-artifact` commits to the branch, strips `.git`, and uploads the combined site as a Pages artifact. |
| `path`                                                                           | `dashboard`            | Folder of the site, so the page is at `/<repository>/<path>/`. `.` for the root.                                                                                                                                                                     |
| `branch`                                                                         | `gh-pages`             | With `publish-to: branch`, the Pages branch.                                                                                                                                                                                                         |
| `title`                                                                          | the repository's name  | The dashboard's title.                                                                                                                                                                                                                               |
| `agent-logins`                                                                   |                        | Extra logins to count as AI agents, comma separated.                                                                                                                                                                                                 |
| `audit-issues`                                                                   | `false`                | `true` opens, updates and closes an issue for each audit finding. Needs `issues: write`.                                                                                                                                                             |
| `audit-issues-impact`                                                            | `medium`               | The lowest impact that gets an issue: `high`, `medium` or `low`.                                                                                                                                                                                     |
| `why`, `why-url`                                                                 |                        | A note on why the repository is tracked, shown on the methodology page.                                                                                                                                                                              |
| `queue-open-dir`, `queue-resolved-dir`                                           |                        | For projects whose agents keep their own file-based queue: the folders of open and resolved issues. Adds a chart of that queue beside the pull requests.                                                                                             |
| `queue-repository`                                                               | this repository        | Where those folders live.                                                                                                                                                                                                                            |
| `queue-name`                                                                     | `Agents' own queue`    | The second queue's name.                                                                                                                                                                                                                             |
| `security-days`, `bug-days`, `feature-days`                                      | `7`, `30`, `180`       | How long a new issue of each class may wait before the repository counts as unmanageable. Decimals allowed (`0.5` is 12 hours).                                                                                                                      |
| `agent-cost-per-issue`, `human-hourly-rate`, `human-hours-per-issue`, `currency` | none, none, `2`, `USD` | Prices for the cost figures. Nothing about cost is shown until at least one price is set.                                                                                                                                                            |
| `monthly-human-budget`, `monthly-agentic-budget`                                 | none, none             | What people's time and what agents' API and CI spend may cost a month, e.g. `'5000'` and `'50'`. The outlook forecasts when keeping pace would exceed each. `monthly-budget` is deprecated and counts as `monthly-human-budget` until it is removed. |

The output `url` is the dashboard's address.

## Good to know

- **The dashboard is public** wherever your GitHub Pages site is public. It shows counts and rates, not issue titles or text, but consider that for private repositories.
- **It reflects your repository's habits.** If issues are not labelled, fixes are not linked or incidents are not recorded, the audit says so and gives the fix rather than guess. Checks that need history wait until there is enough, so a new repository is not marked down for being new.
- **No keys in the page.** The dashboard is a static page. Agents that act on its findings run in GitHub Actions with their API key stored as a repository secret: the audit's agent triage check gives a workflow for it.
- **Forecasts are simulations**, calibrated on the last week and labelled as such on the page. The outlook back-tests itself on the record and reports how often its past forecasts were right.
- **Related work.** [burnscope](https://github.com/asklar/burnscope) also forecasts whether an issue backlog converges, and also refuses to give a date when it does not. It runs locally and reports completeness; this Action adds agent attribution, closure verification, per-class limits, delivery metrics, the audit and a published dashboard.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Report security problems privately: [SECURITY.md](SECURITY.md).

## Developing

```bash
npm ci && npm test                 # the tracker, and the whole Action against a stand-in GitHub
cd dashboard && npm ci && npm run dev   # the dashboard, with sample data
```

After changing the dashboard, rebuild the shipped site with `npm run build:action` in `dashboard/` and commit `dist/`; CI checks it matches the source.

## Licence

MIT. The vendored GSSK kernel is MIT too (`dashboard/src/vendor/gssk/LICENSE`).
