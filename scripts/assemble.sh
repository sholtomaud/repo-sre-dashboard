#!/usr/bin/env bash
# Puts the prebuilt dashboard into its folder in the site, beside the data
# the tracker just wrote, and points it at its own URL. Adds a copy of the
# page for each route, a 404 page that hands unknown paths to the app, and,
# for a Pages deployment, a root page that redirects to the dashboard.
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
echo "url=$url" >> "$GITHUB_OUTPUT"
echo "Assembled the dashboard for $url"
