#!/usr/bin/env bash
# publish-to: branch. Commits the assembled site to the Pages branch and
# pushes. Anything else on the branch (another site, other folders) is left
# alone.
set -euo pipefail

cd "$RUNNER_TEMP/sre-pages"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -A
if git diff --cached --quiet; then
  echo "No changes to publish"
else
  git commit --quiet -m "Update the dashboard ($(date -u +'%Y-%m-%d %H:%M UTC'))"
  git push --quiet origin "HEAD:$SRE_BRANCH"
  echo "Published to $SRE_BRANCH:/${SRE_PATH}"
fi
