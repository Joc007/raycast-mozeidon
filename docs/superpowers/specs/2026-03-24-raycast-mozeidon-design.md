# Raycast Mozeidon Extension — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Overview

A Raycast extension that provides a single unified search command across Firefox/Chrome open tabs, bookmarks, and history via the `mozeidon` CLI. Replaces the outdated official extension (2 years old, broken with current mozeidon).

## Scope

One Raycast command: `Browser Search`. Covers:
- Search and switch to open tabs
- Search bookmarks and open in browser
- Search history and open in browser

Out of scope (for now): tab close, new tab, profile switching, groups.

## Architecture

**Stack:** TypeScript + React, Raycast API, Node.js `child_process`.

**Subprocess calls:** All CLI calls use `util.promisify(execFile)` (async, non-blocking, no shell interpolation — eliminates shell injection risk). One-off synchronous actions (tab switch, open URL) use `execFileSync`. Never use `execSync` with string concatenation.

**Initialization flow:**
1. Show `isLoading={true}`
2. Run `mozeidon profiles get` via `execFileSync("mozeidon", ["profiles", "get"])` — if result is `{data: []}`, stop and show "No active browser profile" message; do not proceed to step 3
3. Fire three CLI calls in true parallel via `Promise.all` using `promisify(execFile)`:
   - `execFile("mozeidon", ["tabs", "get"])`
   - `execFile("mozeidon", ["bookmarks", "-m", "500"])`
   - `execFile("mozeidon", ["history", "-m", "300"])`
4. Set `isLoading={false}`, render merged results

**Data loading — response format:**
```
tabs get     → {data: [{windowId, id, title, url, domain, pinned, active}]}
bookmarks    → {data: [{id, title, url, parent}]}
history      → {data: [{id, title, url, tc, vc, t}]}
```

All responses are wrapped in `{"data": [...]}`. The CLI adapter unwraps `response.data`. The `parent` field from bookmarks and unused fields (`tc`, `vc`, `t`) from history are silently dropped — they do not appear in the UI.

Each result item is tagged with `type: "tab" | "bookmark" | "history"` and merged into one flat array. Raycast `List` with `filtering={true}` handles search — no manual filter logic needed.

**Data limits:** `-m 500` for bookmarks and `-m 300` for history are fixed constants.

**Profile:** Uses mozeidon default profile (highest rank, most recent). No profile picker.

**Scaffolding:** Use `create-raycast-extension` to generate the project. This produces the correct `package.json` manifest (with `"commands"`, `"title"`, `"name"`, `"icon"` Raycast fields). Do not create `package.json` from scratch.

## UI

- `List` component with `isLoading={true}` during both the profile check and the parallel fetch; set to `false` on completion or error
- Three `List.Section` groups in order: Tabs, Bookmarks, History
- If a source fails gracefully (toast shown), its section is omitted entirely — Raycast hides empty sections automatically
- Per item:
  - **Icon**: `Icon.Globe` (tab), `Icon.Bookmark` (bookmark), `Icon.Clock` (history)
  - **Title**: page title
  - **Subtitle**: URL — no manual truncation; Raycast truncates subtitles automatically
  - **Accessory**: `{text: "Tab"}` / `{text: "Bookmark"}` / `{text: "History"}`
- **All-three-fail empty state:** Rendered as `List.EmptyView` with title "Could not load browser data" and a primary action "Retry" in its `actions` prop

## Actions

Each item has an `ActionPanel` with the following actions:

| Type | Primary (Enter) | Action Panel (⌘K) |
|------|----------------|--------------|
| Tab | Switch tab (see below) | Open in Browser, Copy URL |
| Bookmark | Open in browser | Copy URL |
| History | Open in browser | Copy URL |

**Tab switch:** `execFileSync("mozeidon", ["tabs", "switch", `${windowId}:${id}`])`, then `execFileSync("open", ["-a", "Zen"])` to bring Zen to front, then Raycast's `closeMainWindow()`. (User runs Zen browser, a Firefox/Gecko-based fork — `/Applications/Zen.app`.)

**Open in browser:** `execFileSync("open", [url])` — passes URL as a separate argument, no shell interpolation.

**Copy URL:** Uses Raycast's `Action.CopyToClipboard`.

## Error Handling

**`mozeidon` not in PATH:** `execFile`/`execFileSync` throws with `error.code === "ENOENT"`. Catch specifically and show a full-page error view with install instructions.

**No active profile:** `profiles get` returns `{data: []}`. Full-page error view: "No active browser profile — is Firefox running with the mozeidon extension?"

**Error JSON detection:** CLI may return exit code 0 but body `{"error": "..."}`. Parse response; if `response.error` is present, treat as failure for that source.

| Failure | Detection | Behavior |
|---------|-----------|----------|
| `mozeidon` not in PATH | `error.code === "ENOENT"` | Full error view with install instructions |
| No active browser profile | `profiles get` → `{data: []}` | Full error view, halt init |
| `tabs get` fails | Non-zero exit or `{error}` in JSON | Toast warning, omit Tabs section |
| `bookmarks` fails | Non-zero exit or `{error}` in JSON | Toast warning, omit Bookmarks section |
| `history` fails | Non-zero exit or `{error}` in JSON | Toast warning, omit History section |
| All three fail | All above | `List.EmptyView` + "Could not load browser data" + Retry action |

**Retry action:** Increments a `retryCount` state variable, which triggers a `useEffect` to re-run the full initialization from step 1 (profile check + parallel fetch).

## CLI Response Schemas (verified field names)

**`mozeidon tabs get`** (verified via Raycast extension source):
```typescript
interface Tab {
  id: string;        // string, not number
  windowId: number;
  title: string;
  url: string;
  domain: string;
  pinned: boolean;
  active: boolean;
}
```
Switch argument: array `["tabs", "switch", `${windowId}:${id}`]` passed to `execFileSync`.

**`mozeidon bookmarks -m N`**:
```json
{ "data": [{ "id": "string", "title": "string", "url": "string", "parent": "string" }] }
```

**`mozeidon history -m N`**:
```json
{ "data": [{ "id": "string", "title": "string", "url": "string", "tc": 0, "vc": 3, "t": 1774297119599 }] }
```

## Key Interfaces

```typescript
type ItemType = "tab" | "bookmark" | "history";

interface BrowserItem {
  type: ItemType;
  title: string;
  url: string;
  switchArg?: string; // tabs only: "${windowId}:${id}"
}

interface MozeidonResponse<T> {
  data?: T[];
  error?: string;
}
```

## File Structure

```
raycast-mozeidon/
├── package.json               # Generated by create-raycast-extension scaffold
├── src/
│   ├── browser-search.tsx     # Main command, List UI, initialization flow
│   ├── mozeidon.ts            # CLI adapter: calls mozeidon via execFile, parses JSON, returns BrowserItem[]
│   └── types.ts               # Shared types (BrowserItem, ItemType, MozeidonResponse, Tab)
└── assets/
    └── extension-icon.png
```

## mozeidon CLI Reference (current version)

```
mozeidon tabs get                        # {data: [{id, windowId, title, url, domain, pinned, active}]}
mozeidon tabs switch {windowId}:{id}     # switch to tab (positional arg)
mozeidon bookmarks [-m <max>]            # {data: [{id, title, url, parent}]}
mozeidon history [-m <max>]             # {data: [{id, title, url, tc, vc, t}]}
mozeidon profiles get                    # {data: [{profileId, browserName, pid, ...}]}
```
