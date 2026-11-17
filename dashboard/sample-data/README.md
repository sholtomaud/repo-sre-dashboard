Sample data for developing the dashboard locally (`npm run dev`): a snapshot of
the tracker's output for `aws/aws-emulator`, with its file-based queue. The
Action never ships these files; each repository's own data replaces them.

The per-class columns (security, bug, other) are derived from the snapshot's bug-report counts, for development; the real tracker records them directly.

The pull request figures in status.json are illustrative: aws/aws-emulator accepts no pull requests.

The repository profile, CI, delivery and audit blocks in status.json are also
illustrative, made up to exercise every panel; they do not describe the real
repository.
