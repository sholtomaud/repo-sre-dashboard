# Shared by the Action's scripts. Works out where the Pages site is served:
# PAGES_ROOT is the site's URL path ("/" or "/<repository>/"), PAGES_URL its
# address. GitHub's API knows custom domains; without it (or on GitHub
# Enterprise without Pages read access) the github.io convention is used.
repo_name="${GITHUB_REPOSITORY#*/}"
owner="${GITHUB_REPOSITORY%%/*}"

pages_site() {
  local api="${GITHUB_API_URL:-https://api.github.com}" html=""
  html=$(curl -fsS --max-time 15 \
    -H "Authorization: Bearer ${SRE_TOKEN:-}" \
    -H 'Accept: application/vnd.github+json' \
    "$api/repos/$GITHUB_REPOSITORY/pages" 2>/dev/null |
    sed -n 's/.*"html_url": *"\([^"]*\)".*/\1/p' | head -1) || true
  if [[ -n "$html" ]]; then
    PAGES_URL="${html%/}/"
    PAGES_ROOT="/$(printf '%s' "$PAGES_URL" | sed -E 's#^https?://[^/]+/?##')"
  elif [[ "${repo_name,,}" == "${owner,,}.github.io" ]]; then
    PAGES_ROOT="/"
    PAGES_URL="https://${owner,,}.github.io/"
  else
    PAGES_ROOT="/${repo_name}/"
    PAGES_URL="https://${owner,,}.github.io/${repo_name}/"
  fi
  PAGES_ROOT="${PAGES_ROOT%/}/"
}

# The dashboard's folder in the site, without slashes; empty for the root.
dashboard_path() {
  local p="${SRE_PATH:-dashboard}"
  p="${p#/}"
  p="${p%/}"
  [[ "$p" == "." ]] && p=""
  printf '%s' "$p"
}

# The app's routes besides "/": each gets a copy of the page, so a link
# straight to it loads with HTTP 200.
ROUTES=(audit methodology)
