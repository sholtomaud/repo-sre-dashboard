#!/usr/bin/env bash
# Waits for the uploaded github-pages artifact to become visible in the GitHub
# Actions REST API and then settles briefly so the Actions Results Twirp
# backend queried by actions/deploy-pages catches up. Without this,
# deploy-pages can hit an eventual-consistency window and fail with
# "Found 0 artifact(s)" even right after REST reports total_count >= 1.
set -euo pipefail

api="${GITHUB_API_URL:-https://api.github.com}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
run_id="${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
name="${SRE_ARTIFACT_NAME:-github-pages}"
target_id="${SRE_ARTIFACT_ID:-}"
attempts="${SRE_ARTIFACT_WAIT_ATTEMPTS:-15}"
delay="${SRE_ARTIFACT_WAIT_SECONDS:-1}"
settle="${SRE_ARTIFACT_SETTLE_SECONDS:-5}"
fallback="${SRE_ARTIFACT_FALLBACK_SECONDS:-5}"
url="${api}/repos/${repo}/actions/runs/${run_id}/artifacts?name=${name}"

for ((i = 1; i <= attempts; i++)); do
  body="$(mktemp)"
  code="$(curl -sS --max-time 10 \
    -o "$body" -w '%{http_code}' \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${SRE_TOKEN:-}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$url" || echo 000)"

  if [[ "$code" == "401" || "$code" == "403" ]]; then
    rm -f "$body"
    echo "Token cannot list run artifacts (HTTP $code; needs actions: read) — waiting ${fallback}s before deploy."
    sleep "$fallback"
    exit 0
  fi

  if [[ "$code" == "200" ]]; then
    count="$(node -e "
      try {
        const d = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
        const target = process.argv[2];
        if (target && Array.isArray(d.artifacts) && d.artifacts.length > 0) {
          console.log(d.artifacts.filter((a) => String(a.id) === target && !a.expired).length);
        } else {
          console.log(Number(d.total_count) || 0);
        }
      } catch {
        console.log(0);
      }
    " "$body" "$target_id")"
    rm -f "$body"
    if (( count >= 1 )); then
      echo "Artifact ${name} is ready (${count} found on attempt ${i}); settling ${settle}s for deploy-pages propagation."
      if [[ "$settle" != "0" ]]; then
        sleep "$settle"
      fi
      exit 0
    fi
  else
    rm -f "$body"
  fi

  if (( i < attempts )); then
    sleep "$delay"
  fi
done

echo "Artifact ${name} did not appear after ${attempts} checks; continuing to deploy-pages."
