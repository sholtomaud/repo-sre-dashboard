#!/usr/bin/env bash
# Copies the prebuilt dashboard into $SRE_PATH on the Pages branch, beside the
# data the tracker just wrote, points it at its own URL, and pushes. Anything
# else on the branch (another site, other folders) is left alone.
set -euo pipefail

dir="$RUNNER_TEMP/sre-pages"
target="$dir/$SRE_PATH"
site="$GITHUB_ACTION_PATH/dist"
repo_name="${GITHUB_REPOSITORY#*/}"
owner="${GITHUB_REPOSITORY%%/*}"

# The previous build's files go; the data stays.
mkdir -p "$target"
find "$target" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
cp -R "$site/." "$target/"

# The app reads its base URL from <base href>. A user or organisation site
# (owner.github.io) is served from the root; any other repository from
# /<repository>/.
if [[ "${repo_name,,}" == "${owner,,}.github.io" ]]; then
  base="/${SRE_PATH}/"
else
  base="/${repo_name}/${SRE_PATH}/"
fi
sed -i "s|<base href=\"[^\"]*\"|<base href=\"${base}\"|" "$target/index.html"
# Deep links: each route gets its own copy of the page.
mkdir -p "$target/methodology"
cp "$target/index.html" "$target/methodology/index.html"
# Pages runs Jekyll unless told not to.
touch "$dir/.nojekyll"

cd "$dir"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -A
if git diff --cached --quiet; then
  echo "No changes to publish"
else
  git commit --quiet -m "Update the dashboard ($(date -u +'%Y-%m-%d %H:%M UTC'))"
  git push --quiet origin "HEAD:$SRE_BRANCH"
  echo "Published to $SRE_BRANCH:/$SRE_PATH"
fi

pages="https://${owner,,}.github.io${base}"
echo "url=$pages" >> "$GITHUB_OUTPUT"
echo "### Dashboard: $pages" >> "$GITHUB_STEP_SUMMARY"
echo "If the page is not live, set Settings → Pages → Source to \"Deploy from a branch\", branch \`$SRE_BRANCH\`." >> "$GITHUB_STEP_SUMMARY"
