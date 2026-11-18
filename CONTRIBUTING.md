# Contributing

Thanks for helping. Bug reports and feature requests go through the issue
forms; security problems through [private reporting](SECURITY.md). The rules
for [raising issues](AGENTS.md#raising-issues) and for
[test-driven development](AGENTS.md#test-driven-development) are in
AGENTS.md, for people and agents alike.

## Making a change

1. Fork, branch from `main`, and make one change per pull request.
2. Write the failing test first, then the change, and run the checks in
   [AGENTS.md](AGENTS.md#build-and-test).
3. If you changed the dashboard, rebuild `dist/` with `npm run build:action`
   in `dashboard/` and commit it.
4. Give the pull request a Conventional Commit title (`feat: …`,
   `fix: …`, `docs: …`). Releases and the changelog are made from them.
5. Link the issue it closes ("Fixes #123").

## Design rules

- Every number on the dashboard must be explained on the methodology page.
- Say "not measured" rather than guess, and wait for enough data rather
  than mark a new repository down.
- Colour never carries meaning alone: pair it with an icon, words or a
  pattern, and check palettes for colour-blind readers.
