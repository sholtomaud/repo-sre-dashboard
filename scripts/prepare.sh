#!/usr/bin/env bash
# Prepares $RUNNER_TEMP/sre-pages, the folder the site is assembled in.
#
# publish-to: pages   an empty folder, with the file-based queue's history
#                     (if any) fetched from the live dashboard, since a Pages
#                     deployment keeps no files between runs.
# publish-to: branch  the Pages branch, checked out (or started).
set -euo pipefail
source "$GITHUB_ACTION_PATH/scripts/lib.sh"

# The dashboard's address, for links from the audit's issues.
pages_site
path="$(dashboard_path)"
echo "SRE_DASHBOARD_URL=${PAGES_URL}${path:+$path/}" >> "${GITHUB_ENV:-/dev/null}"

if [[ "${SRE_PUBLISH_TO:-pages}" == "branch" || "${SRE_PUBLISH_TO:-pages}" == "branch-artifact" ]]; then
  exec bash "$GITHUB_ACTION_PATH/scripts/checkout-pages.sh"
fi

dir="$RUNNER_TEMP/sre-pages"
data="$dir${path:+/$path}/data"
rm -rf "$dir"
mkdir -p "$data"

if [[ -n "${SRE_QUEUE_OPEN_DIR:-}" ]]; then
  url="${PAGES_URL}${path:+$path/}data/agent_queue.csv"
  if curl -fsSL --max-time 20 "$url" -o "$data/agent_queue.csv"; then
    echo "Carried over the queue history from $url"
  else
    rm -f "$data/agent_queue.csv"
    echo "No published queue history yet; starting from the repository's history"
  fi
fi
