# Task stopwatch preview

User selected the first visual concept in `selected.png`. `comparison.jpg` puts that source beside the rendered implementation. Synthetic fixtures only; no household data.

From the repository root, with child frontend dependencies installed:

```sh
node scripts/preview-task-stopwatch.mjs
```

Open http://127.0.0.1:19152/preview?state=running&elapsed=512 . Other states are `idle`, `paused`, and `completed`; add `theme=dark`. Opening `/preview` resets only this isolated preview origin. Stop the process with Ctrl+C. This script is not part of the production build.

The task timer remains local until completion. Existing persistence, pause accounting, completion queue, version checks and API transport are unchanged. Focus and scheduling remain under each task's options menu. Inter is self-hosted only for stopwatch digits on systems without the native Apple font; its OFL license ships at `/assets/inter-OFL.txt`.

See repository-root `design-qa.md` for comparison history and validation boundaries. Physical iPad lock-screen behavior has not been tested in this iteration. Production is not updated by running this preview.
