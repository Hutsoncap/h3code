# H3 Code — Roadmap

> This is the durable, agent-followable roadmap for the H3 Code project. It is the source of truth for what we're building, how we sequence it, and the working agreements every contributor (human or agent) follows. Update it as work progresses — mark sub-PRs **in progress**, **in review**, and **done** so the next agent knows where to pick up.

H3 Code is a fork of [`t3code`](https://github.com/pingdotgg/t3code) / [`dpcode`](https://github.com/Emanuele-web04/dpcode) being reshaped into a single Electron app that replaces the dev-tool sprawl: **terminal + browser + diff + git + agent (Claude *and* Codex) + editor + spaces**, all in one window. The upstream apps are already strong — every change here is additive, iterative, and preserves what works.

### Execution order at a glance

1. **Phase 0 — Prerequisites.** Pay down the existing gravity wells in `.plans/` and unify the product name. Nothing in Phase 1+ starts until the Phase 0 gate items are merged.
2. **Phase 1 — Foundations.** Sidebar unify (v1a), Pinned section (v1b), Browser as its own section (v1c.1 → v1c.2 → v1c.3), theme catalog (bundled with v1a).
3. **Phase 2 — Spaces.** Arc/Zen-style top-level containers.
4. **Phase 3+ — Editor, productivity, git/MCP, multi-pane, power features, polish.**
5. **Hardening lane runs continuously.**

---

## Guiding principles

The next success factor for this project is **engineering discipline, not feature ambition.** The codebase already has gravity wells — [ChatView.tsx](apps/web/src/components/ChatView.tsx) (~6.4k lines), [Sidebar.tsx](apps/web/src/components/Sidebar.tsx) (~4.4k), [store.ts](apps/web/src/store.ts) (~2k), [codexAppServerManager.ts](apps/server/src/codexAppServerManager.ts) (~2.7k) — that carry too much integration weight. Shipping UI features *into* those files is **fake velocity**: each feature increases coupling, and regressions get harder to catch. Real velocity comes from paying down that coupling first, then building on clean seams.

The product risk is becoming an Electron kitchen sink — browser, editor, spaces, git UI, command palette, task queue, MCP manager are all good ideas individually, and together they can easily turn into a cluttered, fragile app. The antidote is minimalism as a hard constraint, not a preference.

1. **Performance and reliability first.** [AGENTS.md](AGENTS.md) sets the bar: predictable behavior under load and during failures (session restarts, reconnects, partial streams). When a tradeoff is required, choose correctness and robustness over short-term convenience. Features are built around this principle, not in tension with it.
2. **Seams before features.** Before adding a major new surface, the integration files it touches must be in a shape that makes adding the surface additive — not another layer pasted onto a 6k-line god component. Phase 0 enforces this; the Hardening lane sustains it.
3. **Codex = Claude, always.** Every feature that talks to an agent, MCP, model settings, or prompt UI works identically for both providers. If a feature only works for one, it's not done.
4. **Minimalism as a hard constraint.** Every addition must pass the question "does this make the app feel busier?". If yes, hide it behind progressive disclosure (collapsed section, command palette entry, right-click menu) rather than putting another control in front of the user. The product gets better by *reducing friction*, not by exposing every capability all the time.
5. **Iterate in small, independent PRs.** Each numbered sub-PR below is sized to be buildable in a single worktree by a single agent in one session.
6. **Review gates.** Every PR runs the `code-review` skill before merge. UI-touching PRs additionally run the `frontend-design` skill. Every agent does a **complexity pass** before marking a PR ready — re-read the diff and strip speculative abstractions, unused options, and premature generalizations. (If the author's harness has a `simplify` skill available, use it; the expectation is the outcome, not a specific tool.)
7. **Never break what's already there.** T3/DP ship polished chat, diff, and workspace experiences — additions must not regress those.
8. **Keyboard-first.** Every new panel ships with keyboard shortcuts from day one. Nothing is mouse-only.

---

## Status legend

- 📋 **Planned** — scope is defined; nobody working on it yet.
- 🚧 **In progress** — an agent is actively working in a named worktree.
- 👀 **In review** — PR is open and going through review skills.
- ✅ **Done** — merged to main. Include the PR number.
- ⏸ **Blocked** — waiting on an upstream PR or decision.

Whenever you pick up a sub-PR, flip its status and add your worktree name (e.g. `🚧 worktree: bold-heisenberg`). When merged, flip to ✅ with the PR number.

---

## Phase 0 — Prerequisites: seams, safety nets, and naming

**These land before any Phase 1 work starts.** The existing `.plans/` directory already identifies the seams the roadmap needs; they are not background cleanup, they are the foundation every subsequent feature PR stands on. Each item below is an existing plan in `.plans/` unless noted; read the linked file for the authoritative spec. This roadmap references them — it does not redefine them.

| ID | Title | Source | Status |
|----|-------|--------|--------|
| **p0.1** | Typed IPC boundaries | [.plans/02-typed-ipc-boundaries.md](.plans/02-typed-ipc-boundaries.md) | 📋 Planned |
| **p0.2** | Zod (or Effect/Schema) persisted-state validation | [.plans/05-zod-persisted-state-validation.md](.plans/05-zod-persisted-state-validation.md) | 📋 Planned |
| **p0.3** | Split ChatView.tsx | [.plans/04-split-chatview-component.md](.plans/04-split-chatview-component.md) | 📋 Planned |
| **p0.4** | Split codexAppServerManager.ts | [.plans/03-split-codex-app-server-manager.md](.plans/03-split-codex-app-server-manager.md) | 📋 Planned |
| **p0.5** | Event-state test expansion | [.plans/09-event-state-test-expansion.md](.plans/09-event-state-test-expansion.md) | 📋 Planned |
| **p0.6** | Unify process/session abstraction | [.plans/10-unify-process-session-abstraction.md](.plans/10-unify-process-session-abstraction.md) | 📋 Planned |
| **p0.7** | CI quality gates | [.plans/07-ci-quality-gates.md](.plans/07-ci-quality-gates.md) | 📋 Planned |
| **p0.8** | Pre-commit format + lint | [.plans/08-precommit-format-and-lint.md](.plans/08-precommit-format-and-lint.md) | 📋 Planned |
| **p0.9** | Product naming unification | (new — this roadmap) | 📋 Planned |

### Why these, why now

Every one of these directly lifts a constraint that Phase 1+ would otherwise hit:

- **p0.1 typed IPC boundaries** — v1c.1 modifies the browser IPC surface. Typing it first means v1c.1 is an additive change, not a corrective one.
- **p0.2 persisted-state validation** — v1a, v1b, v1c.1, and v1c.3 all add new zustand/persist stores or re-key existing ones. Shipping them on top of a validated persist pipeline means every future store inherits safe migrations for free.
- **p0.3 split ChatView.tsx** — v1c.1's thread-scoped browser lives inside this file. Working against 6.4k lines is a tax on every PR that follows; doing it once up front is cheaper.
- **p0.4 split codexAppServerManager.ts** — not on v1's hot path, but Codex parity (principle 3) lives here. Any MCP, model-picker, or agent-surface work after v1 will be cleaner with this split done.
- **p0.5 event-state tests** + **p0.6 process/session unification** — the reliability substrate. AGENTS.md calls out "session restarts, reconnects, partial streams" as the load-bearing cases; shipping features before these exist means every feature PR is a reliability gamble.
- **p0.7 CI gates** + **p0.8 precommit hooks** — turn the completion-gate policy from honor-system into enforcement. Stops drift permanently.
- **p0.9 product naming** — see below.

### p0.9 Product naming unification

[README.md](README.md) still says "DP Code"; this roadmap says "H3 Code"; packages are `@t3tools/*`; persisted storage keys use `t3code:` and the Electron session partition is `persist:t3code-browser`; the custom protocol is `t3://`; the Electron dev data dir is `.dpcode/`. **Four names are live in the repo simultaneously.** That drift matters more than it seems — it makes the product feel unfinished and creates migration cost every time a name is touched later.

**This roadmap commits to "H3 Code" as the product name** (user-confirmed in the planning conversation). The rename PR:

- Updates [README.md](README.md), marketing copy, in-app strings, window title, About dialog.
- Migrates persisted storage keys from `t3code:*` → `h3code:*` with a one-shot `localStorage` migration in [useLocalStorage.ts](apps/web/src/hooks/useLocalStorage.ts) and every zustand/persist store (list: theme, sidebar sections, pinned items, web-apps, workspace pages, browser surface state, app settings, composer drafts, terminal state, temporary threads, pinned threads).
- Migrates the Electron session partition `persist:t3code-browser` → `persist:h3code-browser`. **Session cookies/logins will migrate** — the existing session is copied to the new partition name at first launch, then the old partition is retained read-only for one release cycle as a rollback.
- Renames the custom protocol `t3://` → `h3://`; keep `t3://` registered as an alias for one release cycle.
- Renames the dev data dir `.dpcode/` → `.h3code/`.
- Package scope `@t3tools/*` is **not** renamed in p0.9 — that's a separate, mechanical PR (`@h3code/*`) that can land any time after p0.9 without user impact. Defer unless the churn is cheap to batch.

**Verification:**
- [ ] Upgrade from a pre-rename build: all persisted state (threads, workspaces, pinned items, theme, browser tabs, composer drafts) survives.
- [ ] Browser logins survive (session partition migration).
- [ ] `t3://` links still resolve (alias).
- [ ] String grep for `dpcode`, `DP Code`, `t3code`, and `T3 Code` in user-facing surfaces returns zero results (internal package names and git history are fine).

### Phase 0 exit criteria

Phase 1 work (v1a and below) does not start until **p0.1, p0.2, p0.3, p0.5, p0.7, p0.9 are ✅ merged**. p0.4, p0.6, p0.8 are strongly preferred but can land in parallel with v1a if scope conflicts allow it — document any deviation at the top of the affected sub-PR.

---

## Phase 1 — Foundations: sidebar, theme, browser surface

| ID | Title | Status |
|----|-------|--------|
| **v1a** | Sidebar unify + theme catalog | 📋 Planned |
| **v1b** | Pinned section + generalized pin store | 📋 Planned |
| **v1c.1** | Browser surface abstraction (thread-scoped → surface-scoped, back-compat, no UI changes) | 📋 Planned |
| **v1c.2** | Standalone browser route + sidebar Browser section | 📋 Planned |
| **v1c.3** | Web Apps store + install-as-web-app flow + Settings → Browser page | 📋 Planned |

### v1a — Sidebar unify + theme catalog

Smallest viable first step. Drops the Threads/Workspaces segmented picker; both render as stacked collapsible sections in one sidebar. Replaces dark/light-only theming with a curated catalog (Gruvbox, Dracula, Nord, Catppuccin, Solarized, Tokyo Night + the current defaults).

**Sidebar unify**
- Delete `SidebarSegmentedPicker` from [apps/web/src/components/Sidebar.tsx](apps/web/src/components/Sidebar.tsx) (~line 651) and the `view` state/handler.
- Add a reusable `SidebarSection` at `apps/web/src/components/sidebar/SidebarSection.tsx` — header row (title + chevron + optional trailing action) with a collapsible body.
- Add a persistent collapse store at `apps/web/src/sidebarSectionsStore.ts` (zustand/persist, key `t3code:sidebar-sections:v1`). Shape includes **all four section keys up front** to avoid shared-state churn across later sub-PRs: `{ pinned: boolean; threads: boolean; workspaces: boolean; browser: boolean }`. Only `threads` and `workspaces` are rendered in v1a; `pinned` and `browser` keys sit dormant until their sub-PRs wire them up. This lets v1b and v1c proceed in parallel without touching this file.
- Render Threads section and Workspaces section stacked; wrap existing trees untouched internally. dnd-kit reorder ([line 620](apps/web/src/components/Sidebar.tsx:620) / [line 684](apps/web/src/components/Sidebar.tsx:684)) keeps working.

**Theme catalog**
- Types at `apps/web/src/themes/types.ts`: `Theme = { id; name; variant: "light"|"dark"; tokens: ThemeTokens; terminal: TerminalPalette }`. `ThemeTokens` has one field per CSS custom property currently in `index.css :root`. `TerminalPalette` is xterm.js `ITheme`-compatible.
- Catalog at `apps/web/src/themes/catalog.ts`: `default-light`, `default-dark`, `gruvbox-light`, `gruvbox-dark`, `dracula`, `nord`, `catppuccin-latte`, `catppuccin-mocha`, `solarized-light`, `solarized-dark`, `tokyo-night`. `default-*` exactly mirrors current [index.css](apps/web/src/index.css) values for migration safety.
- Rewrite [apps/web/src/hooks/useTheme.ts](apps/web/src/hooks/useTheme.ts):
  - Storage becomes `{ themeId, mode: "manual"|"system", lightThemeId, darkThemeId }`. Migrate the legacy `"light"|"dark"|"system"` string form.
  - `applyTheme` writes every token via `documentElement.style.setProperty(...)` and toggles `.dark` when `variant === "dark"` so Tailwind `dark:` utilities keep working.
  - Hook returns `{ themeId, mode, setTheme, setMode, resolvedTheme }`.
- [apps/web/src/index.css](apps/web/src/index.css): keep structure; `:root` mirrors `default-light` as a safe fallback.
- [apps/web/src/components/terminal/terminalRuntimeAppearance.ts](apps/web/src/components/terminal/terminalRuntimeAppearance.ts): read from a new subscribable `getActiveTerminalPalette()` / `subscribeTerminalPalette()` so running xterm instances recolor on theme change.
- [apps/desktop/src/main.ts:1278](apps/desktop/src/main.ts:1278): traffic-light sync stays on the existing `"light"|"dark"|"system"` IPC; value derived from the active theme's `variant`.
- Add a Theme section to the settings page (locate during implementation via `useAppSettings` consumers): mode toggle + theme grid (5-swatch preview + name).

*(Importing the 450-theme Ghostty/iTerm2 corpus is scoped separately as v8c. v1a stays focused on the curated catalog.)*

**Verification**
- [ ] Sidebar shows stacked Threads + Workspaces sections; no picker.
- [ ] Section collapse persists across reload.
- [ ] Drag-reorder of projects and workspaces still works.
- [ ] Theme picker lists all catalog entries; each visibly restyles the app.
- [ ] xterm terminals recolor on theme change (open a terminal, switch theme, verify `ls --color` shifts).
- [ ] System mode follows OS dark/light changes.
- [ ] macOS traffic-light tint matches active theme's variant.
- [ ] `dark:` Tailwind utilities still apply under dark-variant themes.
- [ ] Legacy `t3code:theme` string values migrate without throwing.
- [ ] Chat, diff viewer, composer, terminal drawer verified under one light and one dark theme.
- [ ] `bun fmt`, `bun lint`, `bun typecheck`, and `bun run test` all pass.
- [ ] `code-review` skill run; findings addressed.
- [ ] `frontend-design` skill run (UI changes present); findings addressed.
- [ ] Complexity pass done.

### v1b — Pinned section + generalized pin store

*Can run in parallel with v1c after v1a lands.*

- Create `apps/web/src/pinnedItemsStore.ts` — generic `{ kind: "thread"|"workspace"|"webapp"; id: string }` items persisted at `t3code:pinned-items:v1`. Actions: `togglePin`, `unpin`, `reorder`, `prune`. Migrate existing pinned-threads localStorage.
- Keep the existing thread-only pin store as a thin selector wrapper during the deprecation window; remove once proven.
- Add the **Pinned** section at the top of the sidebar; hidden when empty. Reuse existing thread and workspace row components. Web-app rows arrive with v1c.3.
- Add pin affordance to workspace context menus (threads already have one).
- The `pinned` key already exists in `sidebarSectionsStore` (seeded by v1a) — just wire it to the new section's collapse state.

**Verification**
- [ ] Thread pins migrate from legacy store.
- [ ] Workspace pin/unpin works.
- [ ] Pinned section hidden when empty, visible when non-empty.
- [ ] Section collapse persists.
- [ ] Pinned items navigable with keyboard.

### v1c — Browser as its own sidebar section (split into three sub-PRs)

Today's browser ([apps/web/src/components/BrowserPanel.tsx](apps/web/src/components/BrowserPanel.tsx), [apps/desktop/src/browserManager.ts](apps/desktop/src/browserManager.ts), [apps/web/src/browserStateStore.ts](apps/web/src/browserStateStore.ts)) is a full WebContentsView-backed multi-tab browser — but it's keyed by `threadId` and only renders inside a chat thread. The original v1c plan bundled seven concerns (contracts, desktop runtime, store migration, routing, sidebar UX, install flow, settings) into one PR — too large for the "one agent, one session" rule. Split into three serial slices.

#### v1c.1 — Browser surface abstraction (no user-visible changes)

*Can run in parallel with v1b after v1a lands.*

Pure refactor. No new routes, no new UI, no new stores. The thread-embedded browser behaves identically after this PR.

- Introduce `BrowserSurfaceId = { kind: "thread"; threadId } | { kind: "standalone"; id: string } | { kind: "webapp"; webAppId }` in `packages/contracts`.
- Update `BrowserPanel` props (`threadId` → `surfaceId`), state store keys in [browserStateStore.ts](apps/web/src/browserStateStore.ts), runtime map in [browserManager.ts](apps/desktop/src/browserManager.ts), and IPC inputs/outputs in [apps/desktop/src/main.ts](apps/desktop/src/main.ts) (lines 61–88).
- Existing call sites ([ChatView.tsx](apps/web/src/components/ChatView.tsx), [_chat.$threadId.tsx](apps/web/src/routes/_chat.$threadId.tsx)) pass `{ kind: "thread", threadId }`.
- Accept legacy `threadId`-only IPC payloads and coerce to `{ kind: "thread", threadId }` during a deprecation window.
- Keep the existing `persist:t3code-browser` session partition untouched.
- **Persisted-state migration is required.** `browserStateStore` is a zustand/persist store keyed by `threadId` today; rekeying to `surfaceId` means existing on-disk entries will not deserialize cleanly. Bump the persist `version`, write a `migrate` that rewrites every legacy `threadId` entry to the `thread:<id>` surface-key form, and add a test that round-trips the prior on-disk shape. Users with open browser tabs at upgrade time must not lose restored tabs. This is also hX1 territory — the test lives with this PR.

**Verification**
- [ ] Thread-embedded browser works identically to pre-PR (manual regression: open a thread, open browser panel, open tabs, restart app, verify tabs restore).
- [ ] Contract tests cover all three surface kinds even though only `thread` is used.
- [ ] Persisted-state migration test: seed localStorage with the prior `threadId`-keyed shape, load the app, confirm tabs restore under the new `thread:<id>` surface keys without loss.
- [ ] `bun run test` passes.

#### v1c.2 — Standalone browser route + sidebar Browser section

*Depends on v1c.1. Can run in parallel with v1b.*

- Add TanStack Router route `/browser` rendering `<BrowserPanel surfaceId={{ kind: "standalone", id: "main" }} />`.
- Add the **Browser** section to the sidebar (key `browser` already exists in `sidebarSectionsStore` from v1a). Contents: a single "Open Browser" row that navigates to `/browser`.
- State persistence for the standalone surface's tab list uses the surface-keyed store from v1c.1.

**Verification**
- [ ] Sidebar shows a Browser section with an "Open Browser" row.
- [ ] Clicking it navigates to `/browser` with a functional tabbed browser.
- [ ] Tabs and session cookies persist across app restart.
- [ ] Thread-embedded browser (regression) still works.

#### v1c.3 — Web Apps store + install flow + Settings → Browser page

*Depends on v1c.2.*

- New `apps/web/src/webAppsStore.ts` — persist `{ id, name, url, faviconUrl, createdAt }[]` at `t3code:web-apps:v1`. Actions: `installFromTab`, `rename`, `delete`, `reorder`.
- Add route `/webapp/$webAppId` rendering `<BrowserPanel surfaceId={{ kind: "webapp", webAppId }} />`.
- Add **Install as web app** button in `BrowserPanel` chrome, visible when `surfaceId.kind !== "webapp"`. Writes current tab → `webAppsStore`.
- Extend the sidebar Browser section with a **Web Apps** sub-list and an "Add web app…" inline form.
- Pin integration: right-click a web-app → Pin uses the generalized pin store from v1b (records `{ kind: "webapp", id }`).
- Settings → **Browser** page:
  - Default search engine (Google / DuckDuckGo / Bing / custom `{query}` template). Replaces hardcoded `SEARCH_URL_PREFIX` at [browserManager.ts:21](apps/desktop/src/browserManager.ts:21); plumbed through `appSettings`.
  - Homepage URL (default `about:blank`).
  - Clear browsing data button (clears `persist:t3code-browser` session).
  - "Extensions — coming soon" disabled stub (realistic future scope is an MV2-compatible curated allowlist, not the Chrome Web Store).

**Verification**
- [ ] Install-as-web-app adds an entry to the Web Apps sub-list.
- [ ] `/webapp/$id` opens with the installed URL.
- [ ] Right-click web-app → Pin surfaces it in Pinned.
- [ ] Settings → Browser: search engine change honored by URL bar queries.
- [ ] Homepage setting honored by new tabs.
- [ ] Clear browsing data clears cookies (verify with a test login).
- [ ] Thread-embedded browser (regression) still works.

---

## Phase 2 — Spaces

Arc / Zen-style top-level containers. Each space owns its own threads, workspaces, web-apps, pins, theme, icon, name, default agent provider, and env overrides. The organizing principle of the app.

| ID | Title | Status |
|----|-------|--------|
| **v2a** | Data model + space switcher UI | 📋 Planned |
| **v2b** | Per-space persistence, migrations, import/export (existing data → "Default" space) | 📋 Planned |
| **v2c** | Per-space theme/icon/env overrides; per-space default model and provider (Claude vs Codex) | 📋 Planned |

---

## Phase 3 — Editor surface

The gap today: you can view diffs and chat with agents, but you can't open `foo.ts` and just edit it.

| ID | Title | Status |
|----|-------|--------|
| **v3a** | Read-only Shiki-highlighted code viewer panel (workspace pane type) | 📋 Planned |
| **v3b** | Editable panel (CodeMirror 6) with save-to-disk via the existing native bridge; shared save pipeline with agent edits | 📋 Planned |
| **v3c** | Editor ↔ diff viewer integration: "open in editor" from a hunk; "jump to diff" from an edit | 📋 Planned |

---

## Phase 4 — Cross-app productivity

| ID | Title | Status |
|----|-------|--------|
| **v4a** | Global ⌘K command palette — indexes threads, workspaces, web-apps, files (active workspace), git refs, settings, snippets | 📋 Planned |
| **v4b** | "Ask about this" context-send — right-click on any diff hunk / file / terminal selection / browser page → send to Claude or Codex thread with context attached | 📋 Planned |
| **v4c** | Snippets + bookmarks + favorites — unified saved-items store; save selections from anywhere; surfaced via ⌘K and a Pinned subsection | 📋 Planned |
| **v4d** | Scratchpad + TODO list per space — markdown notepad and lightweight TODO list, both agent-readable | 📋 Planned |

---

## Phase 5 — Git, MCP, and status

| ID | Title | Status |
|----|-------|--------|
| **v5a** | Commit graph + staging UI (beyond the current git actions) | 📋 Planned |
| **v5b** | GitHub/GitLab PR view panel — list, diff, review comments | 📋 Planned |
| **v5c** | MCP server management UI — for both Claude and Codex configs; see servers, list their tools, toggle enabled, see last invocation | 📋 Planned |
| **v5d** | Persistent status bar — active git branch/dirty state, active agent run, active provider, active space | 📋 Planned |

---

## Phase 6 — Multi-pane layout + drag orchestration

| ID | Title | Status |
|----|-------|--------|
| **v6a** | Drag sidebar items (web-apps, browser tabs, threads) into a workspace as a pane | 📋 Planned |
| **v6b** | Top-level splittable layout — browser + workspace + threads visible simultaneously in the main area | 📋 Planned |

---

## Phase 7 — Power features

| ID | Title | Status |
|----|-------|--------|
| **v7a** | Keyboard shortcuts manager — every panel declares its commands; central settings page to view/rebind; reserves `⌘<digit>` for spaces, `⌘K` palette, `⌘P` file finder, `⌘J` panel toggle | 📋 Planned |
| **v7b** | Chrome extensions — MV2-compatible curated allowlist (realistic scope for Electron) | 📋 Planned |
| **v7c** | Task queue / scheduled agents — "run this prompt on every repo in this space"; "when PR X merges, run Y" | 📋 Planned |
| **v7d** | Session recording / replay — CMUX-style timeline of agent activity | 📋 Planned |

---

## Phase 8 — Cross-cutting polish

| ID | Title | Status |
|----|-------|--------|
| **v8a** | Cross-space search (threads, scratchpads, snippets, bookmarks) | 📋 Planned |
| **v8b** | First-run onboarding + empty-state design pass | 📋 Planned |
| **v8c** | Ghostty / iTerm2 theme catalog import (the 450-theme corpus CMUX ships) with a terminal → UI-variable adapter | 📋 Planned |
| **v8d** | Accessibility audit — keyboard nav, screen-reader labels, contrast | 📋 Planned |

---

## Cross-cutting lane — Hardening (always-open track)

Per [AGENTS.md](AGENTS.md): performance and reliability come first. This lane runs in parallel with the feature phases and has no fixed sequencing — any agent with spare cycles can pick up an item. Every feature PR must land without regressing these, and some items trail each major feature.

| ID | Title | Status |
|----|-------|--------|
| **hX1** | Persisted-state migration test harness — every zustand/persist store (theme, sidebar sections, pinned items, web-apps, workspaces, browser surface state) gets an explicit legacy-value migration test covering the prior on-disk shape | 📋 Planned |
| **hX2** | WebSocket reconnect / session recovery test suite — simulate server restart, partial stream, network flap; verify thread state, browser tabs, and terminal runtimes recover predictably | 📋 Planned |
| **hX3** | Codex + Claude parity regression suite — one shared test matrix that exercises the same prompt/MCP/model flows for both providers; any provider-only feature fails CI | 📋 Planned |
| **hX4** | Sidebar + workspace render perf budgets — benchmark at 1000 threads / 50 workspaces / 20 pinned items / 100 browser tabs; fail CI on regression beyond a set threshold | 📋 Planned |
| **hX5** | Browser suspend-on-idle verification + memory budget — the existing suspend timer at [browserManager.ts](apps/desktop/src/browserManager.ts) must survive every feature PR that touches surfaces | 📋 Planned |
| **hX6** | IPC schema validation at every boundary — make `packages/contracts` the only source of truth; reject unknown fields in dev | 📋 Planned |
| **hX7** | Smoke-run the release pipeline on every phase boundary — `bun run release:smoke` catches packaging regressions before they reach users | 📋 Planned |

---

## Dependencies map

```
Phase 0 (required before Phase 1 begins)
  p0.1 typed IPC ────────────┐
  p0.2 persist validation ───┤
  p0.3 split ChatView ───────┼→ Phase 1 gate
  p0.5 event-state tests ────┤
  p0.7 CI gates ─────────────┤
  p0.9 naming unification ───┘
  p0.4, p0.6, p0.8 — preferred before Phase 1; may run in parallel with v1a if no scope conflict.

Phase 1+ (only after Phase 0 gate)
  v1a ─┬→ v1b ────────────────────────┐
       │                               │
       ├→ v1c.1 → v1c.2 → v1c.3 ─────→ v2a → v2b → v2c
       │           (v1b ∥ v1c.1 only; v1c.2 and v1c.3 serialize)
       │
       └→ v3a → v3b → v3c

  v4a (palette) — any time after v1a
  v4b (ask-about-this) — needs v3a + v4a
  v4c (snippets/bookmarks) — needs v1b
  v4d (scratchpad) — needs v2a
  v5a/b/c/d — any time after v1c.3
  v6a — needs v1c.3 + v2c
  v6b — needs v6a
  v7a — any time; earlier is better

Hardening lane (hX1–hX7) — runs continuously in parallel with all phases,
including Phase 0. Items that overlap with a Phase 0 plan are absorbed
into that plan (e.g. hX1 persisted-state migration harness is a
deliverable of p0.2).
```

---

## Execution model: parallel worktrees

Each sub-PR is sized for one agent in one worktree. Genuine parallelism is narrower than it looks — most pairs share sidebar structure, the browser-surface contract, or the pin store. Be conservative.

- **v1a** must land before v1b, v1c.1, v1c.2, and v1c.3.
- **v1b ∥ v1c.1** is safe — v1b touches the Pinned section and pin store; v1c.1 is a pure contract/runtime refactor of the browser surface with no sidebar UI changes.
- **v1c.2 and v1c.3 serialize around sidebar ownership.** Both edit the sidebar Browser section and both depend on v1c.1. Do not run them in parallel with v1b either — they all touch the same sidebar render path.
- v3a → v3b → v3c is serial within itself; parallel to v1/v2 tracks only after the affected surfaces stabilize.
- **Hardening lane items are independent and can always run in parallel** with feature work, subject to the feature PR not invalidating the test they add.

### Per-PR protocol (every agent follows this)

1. **Before starting** — flip this file: sub-PR status to `🚧 worktree: <name>`. Open a draft PR early so others see the work.
2. **While working** — keep changes scoped to the sub-PR. If you discover adjacent work worth doing, note it at the bottom of this file under "Spawned follow-ups" and keep going.
3. **Completion gates:**
   - **Required by [AGENTS.md](AGENTS.md):**
     - `bun fmt` — formats the workspace (oxfmt).
     - `bun lint` — lints the workspace (oxlint).
     - `bun typecheck` — runs `turbo run typecheck`.
   - **Required by this roadmap** (separate policy, not AGENTS.md):
     - `bun run test` — runs Vitest on the PR's area. **Never use `bun test`** (different binary; AGENTS.md forbids it).
   - Treat the AGENTS.md trio as heavyweight workspace checks — bundle them into one final verification pass per task and avoid rerunning them repeatedly during iteration. Tests can be run more frequently on the scoped area you're editing.
4. **Review gates:**
   - `code-review` skill — mandatory on every PR.
   - `frontend-design` skill — mandatory on any PR that changes UI (new components, styling, layout, copy in views, interaction behavior). Skippable for pure refactors with no user-visible change.
   - **Complexity pass** — self-review by the authoring agent before marking the PR ready. Re-read the diff and strip speculative abstractions, unused options, dead branches, and premature generalizations. Not a separate reviewer and not a specific tool — the `simplify` skill can be used if available, but any method that produces the outcome is fine.
5. **Codex parity check** on every PR that touches agent, MCP, model, or prompt surfaces — confirm explicitly in the PR body.
6. **On merge** — flip this file: sub-PR status to `✅ #<PR number> — <one-line summary>`. If scope shifted, update downstream sub-PR notes.

### Branch + PR naming

- Branch: `feat/v1a-sidebar-themes`, `feat/v1b-pinned-section`, etc.
- PR title: `v1a: <short human summary>`.

---

## Design guardrails

- **No clutter in the primary view.** New controls prefer right-click menus, context menus, or the command palette over always-visible chrome.
- **Every panel ships keyboard shortcuts from day one.** Document them in the panel's own source file and in [KEYBINDINGS.md](KEYBINDINGS.md) until the v7a shortcuts manager lands.
- **Match existing visual language.** Tailwind v4 tokens, current border-radius, current dnd-kit patterns, current sidebar row affordances. When in doubt, grep for a similar existing component and mimic it.
- **Performance budget.** Sidebar renders stay <16ms at 1000 threads + 50 workspaces. Browser panel suspend-on-idle already exists — don't remove it.

---

## Spawned follow-ups

_Agents: append items here when you spot adjacent work worth doing but out of scope for your current PR. Include enough context that the next agent can act without re-reading this conversation._

(none yet)
