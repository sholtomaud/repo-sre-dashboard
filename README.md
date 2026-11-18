# Repo SRE Dashboard

A GitHub Action that publishes a reliability dashboard for your repository to GitHub Pages, at `https://<owner>.github.io/<repository>/dashboard/`, and keeps it up to date.

It shows, on one page:

- **What needs attention.** Key figures with a plain verdict on each, then the few things to act on first: issues past their time limits, CI failing on the default branch, a backlog growing faster than it is worked, and the audit's most valuable fixes.
- **Where it is heading.** The **project outlook**, simulated with [GSSK](https://github.com/energese-project/GSSK-Giannantoni) from Bayesian rate estimates. It gives a manageability index (the chance of staying in control), the date control would be lost with and without people's help, when the backlog could be cleared, whether AI agents are a benefit or a burden, and, once you set prices, what it costs. The forecast stops where it becomes no better than a guess, and it back-tests itself on the record.
- **Issues.** The backlog over time and, for each class (security, bugs, features and other), what is open, what is past its limit, and how fast issues are resolved. By default security issues have 7 days, bugs 30 and the rest 180. It also checks whether each closure references a fix: closures without one are shown, not hidden.
- **Pull requests and agents.** Who writes the changes: an AI agent's account, a person working with an agent (named in a `Co-Authored-By` trailer or a "Generated with" signature), or a person alone. It shows merge rates and time to merge, and who resolves the issues. Agents are recognised by account type and login (Copilot, Claude, Codex, Devin, any `[bot]`, and any logins you add). Dependency and CI bots are left out.
- **Delivery.** The four DORA metrics (deployment frequency, lead time, change failure rate, time to restore), each banded from low to elite. Beside them, CI health on the default branch: runs passing, run time, time back to green, and what is failing now.
- **The codebase.** Languages, files and test files, package ecosystems, workflows and what they run, and branch protection.
- **An audit**, on its own page. About 28 best-practice checks: CI and tests, branch rules, Dependabot updates with auto-merged patches, supply-chain scanning with Socket, dependency review, CodeQL, OpenSSF Scorecard, pinned actions, least-privilege tokens, a security policy, issue forms and labels, linked fixes, releases and incident labels, instructions and attribution for AI agents, an agent triage workflow, and cost inputs. Each check says what was found and why it matters, and gives a fix to copy, written for your repository's languages and package managers.

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
     issues: read
     pull-requests: read
     actions: read # CI health
     deployments: read # delivery metrics
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

### Permissions

The Action only reads, except for pushing to the Pages branch. Without `actions: read` or `deployments: read` it still runs, and the audit names the permission that would let it measure CI health or deliveries.

## How it works

Each run:

1. checks out the `gh-pages` branch (or starts it);
2. reads the repository's issues, pull requests, files, workflows, CI runs, releases and deployments through the GitHub API with the workflow's own token, runs the audit, and writes the dashboard's data (`data.csv`, `pulls.csv`, `status.json`, `config.json`) under `dashboard/data/`;
3. copies in the prebuilt dashboard, a static site with no server, and pushes.

Nothing else on the `gh-pages` branch is touched, so it can sit beside an existing site. The runs need no `npm install`: the dashboard ships prebuilt in [`dist/`](dist/), and the tracker is TypeScript that Node runs directly.

## Inputs

| Input                                                                                              | Default                      | What it does                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`                                                                                            | `github.token`               | Reads the repository and pushes to the Pages branch.                                                                                                     |
| `path`                                                                                             | `dashboard`                  | Folder on the Pages branch, so the page is at `/<repository>/<path>/`.                                                                                   |
| `branch`                                                                                           | `gh-pages`                   | The Pages branch.                                                                                                                                        |
| `title`                                                                                            | the repository's name        | The dashboard's title.                                                                                                                                   |
| `agent-logins`                                                                                     |                              | Extra logins to count as AI agents, comma separated.                                                                                                     |
| `why`, `why-url`                                                                                   |                              | A note on why the repository is tracked, shown on the methodology page.                                                                                  |
| `queue-open-dir`, `queue-resolved-dir`                                                             |                              | For projects whose agents keep their own file-based queue: the folders of open and resolved issues. Adds a chart of that queue beside the pull requests. |
| `queue-repository`                                                                                 | this repository              | Where those folders live.                                                                                                                                |
| `queue-name`                                                                                       | `Agents' own queue`          | The second queue's name.                                                                                                                                 |
| `security-days`, `bug-days`, `feature-days`                                                        | `7`, `30`, `180`             | How long a new issue of each class may wait before the repository counts as unmanageable. Decimals allowed (`0.5` is 12 hours).                          |
| `agent-cost-per-issue`, `human-hourly-rate`, `human-hours-per-issue`, `monthly-budget`, `currency` | none, none, `2`, none, `USD` | Prices for the cost figures. Nothing about cost is shown until at least one price is set.                                                                |

The output `url` is the dashboard's address.

## Good to know

- **The dashboard is public** wherever your GitHub Pages site is public. It shows counts and rates, not issue titles or text, but consider that for private repositories.
- **It reflects your repository's habits.** If issues are not labelled, fixes are not linked or incidents are not recorded, the audit says so and gives the fix rather than guess. Checks that need history wait until there is enough, so a new repository is not marked down for being new.
- **No keys in the page.** The dashboard is a static page. Agents that act on its findings run in GitHub Actions with their API key stored as a repository secret: the audit's agent triage check gives a workflow for it.
- **Forecasts are simulations**, calibrated on the last week and labelled as such on the page. The outlook back-tests itself on the record and reports how often its past forecasts were right.
- **Related work.** [burnscope](https://github.com/asklar/burnscope) also forecasts whether an issue backlog converges, and also refuses to give a date when it does not. It runs locally and reports completeness; this Action adds agent attribution, closure verification, per-class limits, delivery metrics, the audit and a published dashboard.

## Developing

```bash
npm ci && npm test                 # the tracker, and the whole Action against a stand-in GitHub
cd dashboard && npm ci && npm run dev   # the dashboard, with sample data
```

After changing the dashboard, rebuild the shipped site with `npm run build:action` in `dashboard/` and commit `dist/`; CI checks it matches the source.

## Licence

MIT. The vendored GSSK kernel is MIT too (`dashboard/src/vendor/gssk/LICENSE`).
