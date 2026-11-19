#!/usr/bin/env bash
# Puts the prebuilt dashboard into its folder in the site, beside the data
# the tracker just wrote, and points it at its own URL. Adds a copy of the
# page for each route, a 404 page that hands unknown paths to the app, and,
# for a Pages deployment, a root page that redirects to the dashboard. Also
# publishes the data's schema and an llms.txt, so agents and other tools can
# read the data without running the page.
set -euo pipefail
source "$GITHUB_ACTION_PATH/scripts/lib.sh"

dir="$RUNNER_TEMP/sre-pages"
path="$(dashboard_path)"
target="$dir${path:+/$path}"
site="$GITHUB_ACTION_PATH/dist"

# The previous build's files go; the data stays.
mkdir -p "$target"
find "$target" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
cp -R "$site/." "$target/"

pages_site
base="${PAGES_ROOT}${path:+$path/}"
sed -i "s|<base href=\"[^\"]*\"|<base href=\"${base}\"|" "$target/index.html"
for route in "${ROUTES[@]}"; do
  mkdir -p "$target/$route"
  cp "$target/index.html" "$target/$route/index.html"
done

# Any other path on the site loads the app, which shows its own not-found
# page. On a branch that holds another site, its own 404 page is kept.
marker='<!-- repo-sre-dashboard -->'
if [[ ! -e "$dir/404.html" ]] || grep -q "$marker" "$dir/404.html"; then
  { echo "$marker"; cat "$target/index.html"; } > "$dir/404.html"
fi

# A Pages deployment is the whole site: send its root to the dashboard.
if [[ "${SRE_PUBLISH_TO:-pages}" != "branch" && -n "$path" ]]; then
  cat > "$dir/index.html" <<HTML
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Repo SRE Dashboard</title>
<meta http-equiv="refresh" content="0; url=${path}/">
<link rel="canonical" href="${path}/">
<p><a href="${path}/">Open the dashboard</a></p>
</html>
HTML
fi

# Pages runs Jekyll on a branch unless told not to.
touch "$dir/.nojekyll"

url="${PAGES_URL}${path:+$path/}"

# The data's shape, for readers other than the dashboard.
mkdir -p "$target/schema"
cp "$GITHUB_ACTION_PATH"/tracker/schema/status-v*.json "$target/schema/"
schema="$(cd "$target/schema" && ls status-v*.json | sort -V | tail -1)"

# What the files are, for agents (https://llmstxt.org). It describes the
# data only: what an agent may do in the repository is for the repository's
# own AGENTS.md to say, not a published page.
queue_line=""
if [[ -e "$target/data/agent_queue.csv" ]]; then
  queue_line="- [agent_queue.csv](${url}data/agent_queue.csv): daily counts of the file-based issue queue."
fi
cat > "$target/llms.txt" <<TXT
# ${GITHUB_REPOSITORY}

> Repo SRE Dashboard for ${GITHUB_REPOSITORY}: issues and pull requests by AI agents and people, DORA delivery metrics and CI health, and a best-practice audit with fixes. The dashboard page needs JavaScript; the same data is in the files below, rewritten on every run of the Action. Counts and rates only, never issue text.

The audit is in status.json under audit.checks. Each check has a stable id, an impact (high, medium, low) and a status: pass (meets the practice), improve (partly), missing (does not) or waiting (not enough history yet). evidence says what was found, recommendation what to do, and fixes holds files to add or commands to run. status.json's updated_at says when the data was made and run_url links the run that made it.

## Data

- [status.json](${url}data/status.json): the audit, issue and pull request breakdowns, CI and delivery metrics, and the repository's profile.
- [Schema](${url}schema/${schema}): the JSON Schema for status.json; status.json's schema_version says which version it follows.
- [config.json](${url}data/config.json): the repository, the dashboard's title, and the time limits for issues, in days.
- [data.csv](${url}data/data.csv): daily running totals of issues, by who closed them and how.
- [pulls.csv](${url}data/pulls.csv): daily running totals of pull requests, by origin (agent, assisted, human).
${queue_line}

## Docs

- [Methodology](${url}methodology/): how each figure and audit check is worked out.
- [Dashboard](${url}): the page for people.
TXT
# Drop the blank line left where there is no queue.
sed -i '/^$/N;/^\n$/D' "$target/llms.txt"

# The site's root llms.txt: the Action's own when it owns the root, or when
# the root has none; one of the site's own is kept.
llms_marker='<!-- repo-sre-dashboard -->'
if [[ -n "$path" ]] && { [[ ! -e "$dir/llms.txt" ]] || grep -q "$llms_marker" "$dir/llms.txt"; }; then
  cat > "$dir/llms.txt" <<TXT
# ${GITHUB_REPOSITORY}

> This site publishes the Repo SRE Dashboard for ${GITHUB_REPOSITORY}.

## Data

- [Repo SRE Dashboard](${url}llms.txt): its data files, their schema, and how to read them.

${llms_marker}
TXT
fi

echo "url=$url" >> "$GITHUB_OUTPUT"
echo "Assembled the dashboard for $url"
