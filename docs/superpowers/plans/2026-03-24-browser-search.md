# Browser Search Raycast Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Raycast extension with a single "Browser Search" command that unifies open tabs, bookmarks, and history from mozeidon into one searchable list.

**Architecture:** On open, run a profile check then fire three parallel async CLI calls (tabs, bookmarks, history) via `child_process.execFile`. Merge results into a Raycast `List` with three sections. Handle partial failures with toasts; full failures with `List.EmptyView` and Retry.

**Tech Stack:** TypeScript, React, Raycast API (`@raycast/api`), Node.js `child_process` (no extra deps)

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Raycast extension manifest + deps |
| `tsconfig.json` | TypeScript config (CommonJS, React JSX) |
| `src/types.ts` | Shared interfaces: `BrowserItem`, `ItemType`, `MozeidonResponse`, `Tab`, `Bookmark`, `HistoryItem` |
| `src/mozeidon.ts` | CLI adapter: `checkProfile`, `fetchTabs`, `fetchBookmarks`, `fetchHistory`, `switchTab`, `openInBrowser` |
| `src/__tests__/mozeidon.test.ts` | Unit tests for the CLI adapter |
| `src/browser-search.tsx` | Main command: init flow, List UI, sections, actions, error states |
| `assets/extension-icon.png` | Extension icon (placeholder 512×512 PNG) |

---

### Task 1: Initialize the Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `assets/extension-icon.png`

- [ ] **Step 1: Create package.json**

Create `/Users/joc/apps/raycast-mozeidon/package.json`:

```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "mozeidon",
  "title": "Mozeidon",
  "description": "Search open tabs, bookmarks, and history via mozeidon",
  "icon": "extension-icon.png",
  "author": "joc",
  "categories": ["Applications", "Productivity"],
  "license": "MIT",
  "commands": [
    {
      "name": "browser-search",
      "title": "Browser Search",
      "subtitle": "Mozeidon",
      "description": "Search open tabs, bookmarks, and history",
      "mode": "view"
    }
  ],
  "dependencies": {
    "@raycast/api": "^1.70.3"
  },
  "devDependencies": {
    "@raycast/eslint-config": "1.0.8",
    "@types/jest": "^29.5.12",
    "@types/node": "20.8.10",
    "@types/react": "18.2.73",
    "eslint": "^8.51.0",
    "jest": "^29.7.0",
    "prettier": "^3.0.3",
    "ts-jest": "^29.1.4",
    "typescript": "^5.2.2"
  },
  "scripts": {
    "build": "ray build -e dist",
    "dev": "ray develop",
    "fix-lint": "ray lint --fix",
    "lint": "ray lint",
    "publish": "ray publish",
    "test": "jest"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.ts"],
    "moduleNameMapper": {
      "@raycast/api": "<rootDir>/src/__mocks__/@raycast/api.ts"
    }
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `/Users/joc/apps/raycast-mozeidon/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "include": ["src/**/*"],
  "compilerOptions": {
    "lib": ["es2021"],
    "module": "commonjs",
    "target": "es2021",
    "strict": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "allowJs": true
  }
}
```

- [ ] **Step 3: Create Raycast API mock for tests**

Create `/Users/joc/apps/raycast-mozeidon/src/__mocks__/@raycast/api.ts`:

```typescript
export const Icon = {
  Globe: "globe",
  Bookmark: "bookmark",
  Clock: "clock",
  ArrowRight: "arrowRight",
};
export const Action = () => null;
Action.CopyToClipboard = () => null;
export const ActionPanel = () => null;
export const List = () => null;
List.Item = () => null;
List.Section = () => null;
List.EmptyView = () => null;
export const showToast = jest.fn();
export const Toast = { Style: { Failure: "failure", Success: "success" } };
export const closeMainWindow = jest.fn();
```

- [ ] **Step 4: Create assets directory with placeholder icon**

```bash
mkdir -p /Users/joc/apps/raycast-mozeidon/assets
# Copy any 512x512 PNG and name it extension-icon.png, or use ImageMagick:
convert -size 512x512 xc:#5B2D8E -fill white -font Helvetica -pointsize 200 \
  -gravity center -annotate 0 "M" \
  /Users/joc/apps/raycast-mozeidon/assets/extension-icon.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/512/5B2D8E/FFFFFF?text=M" \
  -o /Users/joc/apps/raycast-mozeidon/assets/extension-icon.png
```

(If neither works, create any 512×512 PNG manually and save to `assets/extension-icon.png`.)

- [ ] **Step 5: Install dependencies**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/joc/apps/raycast-mozeidon
git init
git add package.json tsconfig.json src/__mocks__/ assets/
git commit -m "chore: initialize raycast extension project"
```

---

### Task 2: Define Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

Create `/Users/joc/apps/raycast-mozeidon/src/types.ts`:

```typescript
export type ItemType = "tab" | "bookmark" | "history";

export interface BrowserItem {
  type: ItemType;
  title: string;
  url: string;
  switchArg?: string; // tabs only: "${windowId}:${id}"
}

export interface MozeidonResponse<T> {
  data?: T[];
  error?: string;
}

export interface Tab {
  id: string; // string, not number
  windowId: number;
  title: string;
  url: string;
  domain: string;
  pinned: boolean;
  active: boolean;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  parent: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  tc: number;
  vc: number;
  t: number; // timestamp ms — unused in UI
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/joc/apps/raycast-mozeidon
git add src/types.ts
git commit -m "feat: add shared types"
```

---

### Task 3: CLI Adapter with Tests

**Files:**
- Create: `src/__tests__/mozeidon.test.ts`
- Create: `src/mozeidon.ts`

- [ ] **Step 1: Write failing tests**

Create `/Users/joc/apps/raycast-mozeidon/src/__tests__/mozeidon.test.ts`:

```typescript
import { execFile } from "child_process";
import { promisify } from "util";

// We test the pure parsing logic by mocking execFile
jest.mock("child_process", () => ({
  execFile: jest.fn(),
  execFileSync: jest.fn(),
}));

const execFileMock = execFile as jest.MockedFunction<typeof execFile>;

// Helper: make execFile resolve with stdout
function mockStdout(stdout: string) {
  execFileMock.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (err: null, result: { stdout: string }) => void;
    callback(null, { stdout });
  });
}

// Helper: make execFile reject
function mockError(code: string) {
  execFileMock.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (err: NodeJS.ErrnoException) => void;
    const err = new Error("Command failed") as NodeJS.ErrnoException;
    err.code = code;
    callback(err);
  });
}

import { checkProfile, fetchTabs, fetchBookmarks, fetchHistory } from "../mozeidon";

describe("checkProfile", () => {
  it("returns true when profiles data is non-empty", async () => {
    mockStdout(JSON.stringify({ data: [{ profileId: "abc", browserName: "Firefox" }] }));
    expect(await checkProfile()).toBe(true);
  });

  it("returns false when profiles data is empty array", async () => {
    mockStdout(JSON.stringify({ data: [] }));
    expect(await checkProfile()).toBe(false);
  });

  it("throws ENOENT when mozeidon not in PATH", async () => {
    mockError("ENOENT");
    await expect(checkProfile()).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("fetchBookmarks", () => {
  it("maps bookmarks to BrowserItems", async () => {
    mockStdout(JSON.stringify({
      data: [
        { id: "abc", title: "Google", url: "https://google.com", parent: "/" },
        { id: "def", title: "GitHub", url: "https://github.com", parent: "/dev/" },
      ],
    }));
    const items = await fetchBookmarks();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ type: "bookmark", title: "Google", url: "https://google.com" });
    expect(items[1]).toEqual({ type: "bookmark", title: "GitHub", url: "https://github.com" });
  });

  it("throws when CLI returns error JSON", async () => {
    mockStdout(JSON.stringify({ error: "An unexpected error occurred" }));
    await expect(fetchBookmarks()).rejects.toThrow("An unexpected error occurred");
  });

  it("falls back to url when title is empty", async () => {
    mockStdout(JSON.stringify({
      data: [{ id: "abc", title: "", url: "https://example.com", parent: "/" }],
    }));
    const items = await fetchBookmarks();
    expect(items[0].title).toBe("https://example.com");
  });
});

describe("fetchHistory", () => {
  it("maps history to BrowserItems, dropping unused fields", async () => {
    mockStdout(JSON.stringify({
      data: [
        { id: "xyz", title: "GitHub", url: "https://github.com", tc: 0, vc: 3, t: 1774297034211 },
      ],
    }));
    const items = await fetchHistory();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ type: "history", title: "GitHub", url: "https://github.com" });
    expect(items[0]).not.toHaveProperty("tc");
    expect(items[0]).not.toHaveProperty("t");
  });
});

describe("fetchTabs", () => {
  it("maps tabs to BrowserItems with switchArg", async () => {
    mockStdout(JSON.stringify({
      data: [
        { id: "42", windowId: 1, title: "Claude", url: "https://claude.ai", domain: "claude.ai", pinned: false, active: true },
      ],
    }));
    const items = await fetchTabs();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      type: "tab",
      title: "Claude",
      url: "https://claude.ai",
      switchArg: "1:42",
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm test
```

Expected: FAIL — `Cannot find module '../mozeidon'`

- [ ] **Step 3: Implement src/mozeidon.ts**

Create `/Users/joc/apps/raycast-mozeidon/src/mozeidon.ts`:

```typescript
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import type { BrowserItem, MozeidonResponse, Tab, Bookmark, HistoryItem } from "./types";

const execFileAsync = promisify(execFile);

async function run(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("mozeidon", args);
  return stdout;
}

function parseResponse<T>(stdout: string): T[] {
  const response: MozeidonResponse<T> = JSON.parse(stdout);
  if (response.error) throw new Error(response.error);
  return response.data ?? [];
}

export async function checkProfile(): Promise<boolean> {
  const stdout = await run(["profiles", "get"]);
  const response: MozeidonResponse<unknown> = JSON.parse(stdout);
  return (response.data?.length ?? 0) > 0;
}

export async function fetchTabs(): Promise<BrowserItem[]> {
  const stdout = await run(["tabs", "get"]);
  const tabs = parseResponse<Tab>(stdout);
  return tabs.map((tab) => ({
    type: "tab" as const,
    title: tab.title || tab.url,
    url: tab.url,
    switchArg: `${tab.windowId}:${tab.id}`,
  }));
}

export async function fetchBookmarks(): Promise<BrowserItem[]> {
  const stdout = await run(["bookmarks", "-m", "500"]);
  const bookmarks = parseResponse<Bookmark>(stdout);
  return bookmarks.map((b) => ({
    type: "bookmark" as const,
    title: b.title || b.url,
    url: b.url,
  }));
}

export async function fetchHistory(): Promise<BrowserItem[]> {
  const stdout = await run(["history", "-m", "300"]);
  const items = parseResponse<HistoryItem>(stdout);
  return items.map((h) => ({
    type: "history" as const,
    title: h.title || h.url,
    url: h.url,
  }));
}

export function switchTab(switchArg: string): void {
  execFileSync("mozeidon", ["tabs", "switch", switchArg]);
  execFileSync("open", ["-a", "Zen"]);
}

export function openInBrowser(url: string): void {
  execFileSync("open", [url]);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joc/apps/raycast-mozeidon
git add src/mozeidon.ts src/__tests__/mozeidon.test.ts
git commit -m "feat: add mozeidon CLI adapter with tests"
```

---

### Task 4: Main Command UI

**Files:**
- Create: `src/browser-search.tsx`

- [ ] **Step 1: Create src/browser-search.tsx**

Create `/Users/joc/apps/raycast-mozeidon/src/browser-search.tsx`:

```typescript
import {
  List,
  Icon,
  ActionPanel,
  Action,
  showToast,
  Toast,
  closeMainWindow,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { checkProfile, fetchTabs, fetchBookmarks, fetchHistory, switchTab, openInBrowser } from "./mozeidon";
import type { BrowserItem } from "./types";

type State =
  | { status: "loading" }
  | { status: "enoent" }
  | { status: "no-profile" }
  | { status: "all-failed" }
  | { status: "ready"; tabs: BrowserItem[]; bookmarks: BrowserItem[]; history: BrowserItem[] };

export default function BrowserSearch() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setState({ status: "loading" });

    async function init() {
      // Step 1: Check profile
      let hasProfile: boolean;
      try {
        hasProfile = await checkProfile();
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        setState(code === "ENOENT" ? { status: "enoent" } : { status: "all-failed" });
        return;
      }

      if (!hasProfile) {
        setState({ status: "no-profile" });
        return;
      }

      // Step 2: Parallel fetch — use allSettled so one failure doesn't cancel others
      const [tabsResult, bookmarksResult, historyResult] = await Promise.allSettled([
        fetchTabs(),
        fetchBookmarks(),
        fetchHistory(),
      ]);

      const tabs = tabsResult.status === "fulfilled" ? tabsResult.value : [];
      const bookmarks = bookmarksResult.status === "fulfilled" ? bookmarksResult.value : [];
      const history = historyResult.status === "fulfilled" ? historyResult.value : [];

      // Toast for each partial failure
      if (tabsResult.status === "rejected") {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not load tabs",
          message: "Is the mozeidon extension active in Zen?",
        });
      }
      if (bookmarksResult.status === "rejected") {
        await showToast({ style: Toast.Style.Failure, title: "Could not load bookmarks" });
      }
      if (historyResult.status === "rejected") {
        await showToast({ style: Toast.Style.Failure, title: "Could not load history" });
      }

      // All three failed → show empty view with retry
      if (
        tabsResult.status === "rejected" &&
        bookmarksResult.status === "rejected" &&
        historyResult.status === "rejected"
      ) {
        setState({ status: "all-failed" });
        return;
      }

      setState({ status: "ready", tabs, bookmarks, history });
    }

    init();
  }, [retryCount]);

  const retry = () => setRetryCount((c) => c + 1);

  // Full-page error states
  if (state.status === "enoent") {
    return (
      <List>
        <List.EmptyView
          title="mozeidon not found"
          description="Install mozeidon and make sure it is in your PATH."
          actions={<ActionPanel><Action title="Retry" onAction={retry} /></ActionPanel>}
        />
      </List>
    );
  }

  if (state.status === "no-profile") {
    return (
      <List>
        <List.EmptyView
          title="No active browser profile"
          description="Is Zen running with the mozeidon extension installed?"
          actions={<ActionPanel><Action title="Retry" onAction={retry} /></ActionPanel>}
        />
      </List>
    );
  }

  if (state.status === "all-failed") {
    return (
      <List>
        <List.EmptyView
          title="Could not load browser data"
          description="Failed to fetch tabs, bookmarks, and history."
          actions={<ActionPanel><Action title="Retry" onAction={retry} /></ActionPanel>}
        />
      </List>
    );
  }

  const isLoading = state.status === "loading";
  const tabs = state.status === "ready" ? state.tabs : [];
  const bookmarks = state.status === "ready" ? state.bookmarks : [];
  const history = state.status === "ready" ? state.history : [];

  return (
    <List isLoading={isLoading} filtering={true}>
      {tabs.length > 0 && (
        <List.Section title="Tabs">
          {tabs.map((item, i) => (
            <BrowserListItem key={`tab-${i}`} item={item} />
          ))}
        </List.Section>
      )}
      {bookmarks.length > 0 && (
        <List.Section title="Bookmarks">
          {bookmarks.map((item, i) => (
            <BrowserListItem key={`bookmark-${i}`} item={item} />
          ))}
        </List.Section>
      )}
      {history.length > 0 && (
        <List.Section title="History">
          {history.map((item, i) => (
            <BrowserListItem key={`history-${i}`} item={item} />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function BrowserListItem({ item }: { item: BrowserItem }) {
  const icon =
    item.type === "tab" ? Icon.Globe : item.type === "bookmark" ? Icon.Bookmark : Icon.Clock;
  const label =
    item.type === "tab" ? "Tab" : item.type === "bookmark" ? "Bookmark" : "History";

  return (
    <List.Item
      icon={icon}
      title={item.title}
      subtitle={item.url}
      accessories={[{ text: label }]}
      actions={
        <ActionPanel>
          {item.type === "tab" && item.switchArg ? (
            <>
              <Action
                title="Switch to Tab"
                icon={Icon.ArrowRight}
                onAction={async () => {
                  switchTab(item.switchArg!);
                  await closeMainWindow();
                }}
              />
              <Action
                title="Open in Browser"
                icon={Icon.Globe}
                onAction={() => openInBrowser(item.url)}
              />
            </>
          ) : (
            <Action
              title="Open in Browser"
              icon={Icon.Globe}
              onAction={() => openInBrowser(item.url)}
            />
          )}
          <Action.CopyToClipboard title="Copy URL" content={item.url} />
        </ActionPanel>
      }
    />
  );
}
```

- [ ] **Step 2: Build the extension**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm run build
```

Expected: Build succeeds. No TypeScript errors.

If build fails with TypeScript errors, fix them before proceeding. Common issue: missing `Icon.ArrowRight` — check `@raycast/api` version exports.

- [ ] **Step 3: Run in development mode**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm run dev
```

Open Raycast → search "Browser Search" → verify the command appears and loads. Check that:
- Loading spinner shows while fetching
- Bookmarks and history sections appear
- Tabs section appears (or toast shows if extension not active)
- Search filters across all sections

- [ ] **Step 4: Commit**

```bash
cd /Users/joc/apps/raycast-mozeidon
git add src/browser-search.tsx
git commit -m "feat: add browser search command UI"
```

---

### Task 5: Final Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run all tests**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run lint**

```bash
cd /Users/joc/apps/raycast-mozeidon && npm run lint
```

Fix any lint errors before committing.

- [ ] **Step 3: Test tab switching manually**

In dev mode (`npm run dev`):
1. Open Zen browser with at least one tab
2. Open Raycast → "Browser Search"
3. Find a tab in the list → press Enter
4. Verify Zen comes to front and the correct tab is active

- [ ] **Step 4: Test bookmarks and history manually**

1. Search a term that matches a known bookmark → press Enter → verify URL opens in Zen
2. Search a term that matches a history entry → press Enter → verify URL opens in Zen
3. Press ⌘K on any item → verify Copy URL action works

- [ ] **Step 5: Final commit**

```bash
cd /Users/joc/apps/raycast-mozeidon
git add -A
git commit -m "chore: verified extension works end-to-end"
```
