import { spawn, execFileSync } from "child_process";
import type {
  BrowserItem,
  MozeidonResponse,
  Tab,
  Bookmark,
  HistoryItem,
} from "./types";

const MOZEIDON = "/opt/homebrew/bin/mozeidon"; // Raycast doesn't inherit shell PATH
const BROWSER_APP = "Zen"; // change if using a different browser
const BOOKMARKS_LIMIT = "500";
const HISTORY_LIMIT = "300";
const CLI_TIMEOUT_MS = 8_000;

// Raycast doesn't inherit the login shell env, so TMPDIR is missing or wrong.
// mozeidon needs TMPDIR to find its browser-extension socket.
// getconf DARWIN_USER_TEMP_DIR returns the real per-user temp dir from the OS.
function resolveUserTmpDir(): string {
  try {
    return execFileSync("/usr/bin/getconf", ["DARWIN_USER_TEMP_DIR"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return process.env.TMPDIR ?? "/tmp";
  }
}
const USER_TMPDIR = resolveUserTmpDir();

// execFile inherits stdin from Raycast's process, causing mozeidon to block.
// spawn with stdio:['ignore','pipe','pipe'] closes stdin so the child runs freely.
function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(MOZEIDON, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, TMPDIR: USER_TMPDIR },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`mozeidon ${args.join(" ")} timed out after ${CLI_TIMEOUT_MS}ms`));
    }, CLI_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.trim().startsWith("{")) {
        resolve(stdout);
      } else {
        reject(new Error(`mozeidon exited ${code}: ${stderr || stdout}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseResponse<T>(stdout: string): T[] {
  const response: MozeidonResponse<T> = JSON.parse(stdout);
  if (response.error) throw new Error(response.error);
  return response.data ?? [];
}

export async function checkProfile(): Promise<boolean> {
  const stdout = await run(["profiles", "get"]);
  const response: MozeidonResponse<unknown> = JSON.parse(stdout);
  if (response.error) throw new Error(response.error);
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
  const stdout = await run(["bookmarks", "-m", BOOKMARKS_LIMIT]);
  const bookmarks = parseResponse<Bookmark>(stdout);
  return bookmarks.map((b) => ({
    type: "bookmark" as const,
    title: b.title || b.url,
    url: b.url,
  }));
}

export async function fetchHistory(): Promise<BrowserItem[]> {
  const stdout = await run(["history", "-m", HISTORY_LIMIT]);
  const items = parseResponse<HistoryItem>(stdout);
  return items.map((h) => ({
    type: "history" as const,
    title: h.title || h.url,
    url: h.url,
  }));
}

function openApp(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("open", args, { stdio: "ignore" });
    child.on("close", () => resolve());
    child.on("error", reject);
  });
}

export async function switchTab(switchArg: string): Promise<void> {
  await run(["tabs", "switch", switchArg]);
  await openApp(["-a", BROWSER_APP]);
}

export async function openInBrowser(url: string): Promise<void> {
  await openApp([url]);
}
