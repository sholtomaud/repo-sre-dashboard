#!/usr/bin/env bash
# Checks out the Pages branch into $RUNNER_TEMP/sre-pages, or starts it as an
# empty orphan branch if it does not exist yet. Earlier data on the branch is
# kept, so a file-based queue's history builds up between runs.
set -euo pipefail

dir="$RUNNER_TEMP/sre-pages"
remote="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}.git"
auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$SRE_TOKEN" | base64 | tr -d '\n')"

rm -rf "$dir"
git init --quiet "$dir"
cd "$dir"
git config http."${GITHUB_SERVER_URL}/".extraheader "$auth"
git remote add origin "$remote"
if git fetch --quiet --depth 1 origin "$SRE_BRANCH" 2>/dev/null; then
  git checkout --quiet -b "$SRE_BRANCH" FETCH_HEAD
  echo "Checked out $SRE_BRANCH"
else
  git checkout --quiet --orphan "$SRE_BRANCH"
  echo "Starting a new $SRE_BRANCH branch"
fi
