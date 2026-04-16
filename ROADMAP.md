# H3 Code — Roadmap

> This is the durable, agent-followable roadmap for the H3 Code project. It is the source of truth for what we're building, how we sequence it, and the working agreements every contributor (human or agent) follows. Update it as work progresses — mark sub-PRs **in progress**, **in review**, and **done** so the next agent knows where to pick up.

H3 Code is a fork of [`t3code`](https://github.com/pingdotgg/t3code) / [`dpcode`](https://github.com/Emanuele-web04/dpcode) being reshaped into a single Electron app that replaces the dev-tool sprawl: **terminal + browser + diff + git + agent (Claude *and* Codex) + editor + spaces**, all in one window. The upstream apps are already strong — every change here is additive, iterative, and preserves what works.

---

## Guiding principles

1. **Codex = Claude, always.** Every feature that talks to an agent, MCP, model settings, or prompt UI works identically for both providers. If a feature only works for one, it's not done.
2. **Minimalism first.** Every addition must pass the question "does this make the app feel busier?". If yes, hide it behind progressive disclosure (collapsed section, command palette entry, right-click menu) rather than putting another control in front of the user.
3. **Iterate in small, independent PRs.** Each numbered sub-PR below is sized to be buildable in a single worktree by a single agent in one session.
4. **Every PR goes through `code-review` and `frontend-design` skill reviews** before merge. The two can run in parallel. Run `simplify` before marking done.
5. **Never break what's already there.** T3/DP ship polished chat, diff, and workspace experiences — additions must not regress those.
6. **Keyboard-first.** Every new panel ships with keyboard shortcuts from day one. Nothing is mouse-only.

---

## Status legend

- 📋 **Planned** — scope is defined; nobody working on it yet.
- 🚧 **In progress** — an agent is actively working in a named worktree.
- 👀 **In review** — PR is open and going through review skills.
- ✅ **Done** — merged to main. Include the PR number.
- ⏸ **Blocked** — waiting on an upstream PR or decision.

Whenever you pick up a sub-PR, flip its status and add your worktree name (e.g. `🚧 worktree: bold-heisenberg`). When merged, flip to ✅ with the PR number.

---

## Phase 1 — Foundations: sidebar, theme, browser surface

| ID | Title | Status |
|----|-------|--------|
| **v1a** | Sidebar unify + theme catalog | 📋 Planned |
| **v1b** | Pinned section + generalized pin store | 📋 Planned |
| **v1c** | Browser as its own sidebar section + Web Apps + Browser settings | 📋 Planned |

### v1a — Sidebar unify + theme catalog

Smallest viable first step. Drops the Threads/Workspaces segmented picker; both render as stacked collapsible sections in one sidebar. Replaces dark/light-only theming with a curated catalog (Gruvbox, Dracula, Nord, Catppuccin, Solarized, Tokyo Night + the current defaults).

**Sidebar unify**
- Delete `SidebarSegmentedPicker` from [apps/web/src/components/Sidebar.tsx](apps/web/src/components/Sidebar.tsx) (~line 651) and the `view` state/handler.
- Add a reusable `SidebarSection` at `apps/web/src/components/sidebar/SidebarSection.tsx` — header row (title + chevron + optional trailing action) with a collapsible body.
- Add a persistent collapse store at `apps/web/src/sidebarSectionsStore.ts` (zustand/persist, key `t3code:sidebar-sections:v1`, initial shape `{ threads: boolean; workspaces: boolean }` — `pinned` / `browser` arrive with v1b / v1c).
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
- Note: themes can also be installed using the Ghostty theme format similar to how Ghostty terminal does it so that we have a larger theme library. Perhaps we can crosscheck the available themes on their repo and build out from there?

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
- [ ] `bun run check` and `bun run test` pass.
- [ ] `code-review`, `frontend-design`, and `simplify` skills run; findings addressed.

### v1b — Pinned section + generalized pin store

*Can run in parallel with v1c after v1a lands.*

- Create `apps/web/src/pinnedItemsStore.ts` — generic `{ kind: "thread"|"workspace"|"webapp"; id: string }` items persisted at `t3code:pinned-items:v1`. Actions: `togglePin`, `unpin`, `reorder`, `prune`. Migrate existing pinned-threads localStorage.
- Keep the existing thread-only pin store as a thin selector wrapper during the deprecation window; remove once proven.
- Add the **Pinned** section at the top of the sidebar; hidden when empty. Reuse existing thread and workspace row components. Web-app rows arrive with v1c.
- Add pin affordance to workspace context menus (threads already have one).
- Extend `sidebarSectionsStore` with `pinned: boolean`.

**Verification**
- [ ] Thread pins migrate from legacy store.
- [ ] Workspace pin/unpin works.
- [ ] Pinned section hidden when empty, visible when non-empty.
- [ ] Section collapse persists.
- [ ] Pinned items navigable with keyboard.

### v1c — Browser as its own sidebar section

*Can run in parallel with v1b after v1a lands. Largest v1 sub-PR.*

Today's browser ([apps/web/src/components/BrowserPanel.tsx](apps/web/src/components/BrowserPanel.tsx), [apps/desktop/src/browserManager.ts](apps/desktop/src/browserManager.ts), [apps/web/src/browserStateStore.ts](apps/web/src/browserStateStore.ts)) is a full WebContentsView-backed multi-tab browser — but it's keyed by `threadId` and only renders inside a chat thread. v1c generalizes it and promotes it to a top-level sidebar section.

- Generalize from thread-scoped to surface-scoped: `BrowserSurfaceId = { kind: "thread"; threadId } | { kind: "standalone"; id: "main" } | { kind: "webapp"; webAppId }`. Update `BrowserPanel` props, state store keys, runtime map in `browserManager`, and IPC inputs. Accept legacy `threadId` payloads during deprecation.
- Add routes: `/browser` and `/webapp/$webAppId` (TanStack Router), each rendering `BrowserPanel` with the right surface id.
- New `apps/web/src/webAppsStore.ts` — persist `{ id, name, url, faviconUrl, createdAt }[]` at `t3code:web-apps:v1`. Actions: `installFromTab`, `rename`, `delete`, `reorder`.
- Add an **Install as web app** button in `BrowserPanel` chrome, visible when `surfaceId.kind !== "webapp"`. Writes current tab → `webAppsStore`.
- Sidebar **Browser** section:
  - "Open Browser" row → navigates to `/browser`.
  - "Web Apps" sub-list → each entry navigates to `/webapp/$id`.
  - "Add web app…" inline form (name + URL).
- Settings → **Browser** page:
  - Default search engine (Google / DuckDuckGo / Bing / custom `{query}` template). Replaces hardcoded `SEARCH_URL_PREFIX` at [browserManager.ts:21](apps/desktop/src/browserManager.ts:21).
  - Homepage URL (default `about:blank`).
  - Clear browsing data (clears `persist:t3code-browser` session).
  - "Extensions — coming soon" disabled stub (realistic future scope is an MV2-compatible curated allowlist, not the Chrome Web Store).

**Verification**
- [ ] "Open Browser" → `/browser` renders functioning tabs.
- [ ] Tabs + cookies persist across app restart.
- [ ] Install-as-web-app adds a sidebar entry.
- [ ] Web-app route opens with the URL prepopulated.
- [ ] Right-click a web-app → Pin surfaces it in Pinned (requires v1b).
- [ ] Settings → Browser: search engine change honored.
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

## Dependencies map

```
v1a ─┬→ v1b ─┬→ v1c ─┬→ v2a ─→ v2b ─→ v2c ───┐
     │       │        │                       │
     │       └─ v4c (snippets, needs pin)     │
     │                                         │
     └─ v3a ─→ v3b ─→ v3c ─────────────────── ┤
                                                │
v4a (palette) — any time after v1a ─────────── │
v4b (ask-about-this) — needs v3a + v4a ────── ┤
v4d (scratchpad) — needs v2a ────────────────┤
v5a/b/c/d — any time after v1c ──────────────┤
v6a — needs v1c + v2c ───────────────────────┤
v6b — needs v6a ─────────────────────────────┤
v7a — any time; earlier is better ─────────── ┘
```

---

## Execution model: parallel worktrees

Each sub-PR is sized for one agent in one worktree. Sub-PRs within a phase that touch **different files** can run in parallel on separate worktrees. Examples:
- v1a must land before v1b and v1c.
- v1b and v1c can run in parallel (different files, no conflict beyond the `sidebarSectionsStore` addition).
- v3a → v3b → v3c is serial within itself but parallel to v1/v2 tracks.

### Per-PR protocol (every agent follows this)

1. **Before starting** — flip this file: sub-PR status to `🚧 worktree: <name>`. Open a draft PR early so others see the work.
2. **While working** — keep changes scoped to the sub-PR. If you discover adjacent work worth doing, note it at the bottom of this file under "Spawned follow-ups" and keep going.
3. **Before asking for review** — run:
   - `code-review` skill (mandatory)
   - `frontend-design` skill (mandatory for any UI PR)
   - `simplify` skill (mandatory)
   - `bun run check` and `bun run test` (verify script names during the PR)
4. **Codex parity check** on every PR that touches agent, MCP, model, or prompt surfaces — confirm explicitly in the PR body.
5. **On merge** — flip this file: sub-PR status to `✅ #<PR number> — <one-line summary>`. If scope shifted, update downstream sub-PR notes.

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
