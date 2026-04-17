# Contributing

## Read This First

We are not actively accepting contributions right now.

You can still open an issue or PR, but please do so knowing there is a high chance we close it, defer it forever, or never look at it.

If that sounds annoying, that is because it is. This project is still early and we are trying to keep scope, quality, and direction under control.

PRs are automatically labeled with a `vouch:*` trust status and a `size:*` diff size based on changed lines.

If you are an external contributor, expect `vouch:unvouched` until we explicitly add you to [.github/VOUCHED.td](.github/VOUCHED.td).

## What We Are Most Likely To Accept

Small, focused bug fixes.

Small reliability fixes.

Small performance improvements.

Tightly scoped maintenance work that clearly improves the project without changing its direction.

## What We Are Least Likely To Accept

Large PRs.

Drive-by feature work.

Opinionated rewrites.

Anything that expands product scope without us asking for it first.

If you open a 1,000+ line PR full of new features, we will probably close it quickly and remember that you ignored the clearly written instructions.

## If You Still Want To Open A PR

Keep it small.

Explain exactly what changed.

Explain exactly why the change should exist.

Do not mix unrelated fixes together.

If the PR makes anything resembling a UI change, include clear before/after images.

If the change depends on motion, timing, transitions, or interaction details, include a short video.

If we have to guess what changed, we are much less likely to review it.

## Issues First

If you are thinking about a non-trivial change, open an issue first.

That still does not mean we will want the PR, but it gives you a chance to avoid wasting your time.

## Be Realistic

Opening a PR does not create an obligation on our side.

We may close it. We may ignore it. We may ask you to shrink it. We may reimplement the idea ourselves later.

If you are fine with that, proceed.

## Git Hooks

`bun install` wires up [Lefthook](https://lefthook.dev/) pre-commit hooks via the root `prepare` script. On every `git commit`, Lefthook runs two jobs in parallel against your staged files only:

- `oxfmt` formats staged code, config, and docs files in place (JS/TS/JSON/YAML/CSS/HTML/Markdown) and re-stages the fixes.
- `oxlint --report-unused-disable-directives` runs the same lint pass CI does. The repo's current `.oxlintrc.json` treats every rule as a warning, so violations surface in the commit output without blocking. If the config ever escalates rules to `error`, the hook will block matching commits.

Hooks only touch staged files, so docs-only or unrelated-file commits add no latency.

If you need to bypass the hook in an emergency, `git commit --no-verify` skips it — but prefer fixing the underlying issue. `AGENTS.md` still requires `bun fmt`, `bun lint`, and `bun typecheck` to pass before a task is considered done, so skipping the hook just defers the work to CI.

If `bun install` didn't install the hook for some reason (e.g. the `prepare` script was skipped), run `bun run prepare` manually.
