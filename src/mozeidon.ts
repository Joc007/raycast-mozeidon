import { execFile } from "child_process";
import { promisify } from "util";
import type {
  BrowserItem,
  MozeidonResponse,
  Tab,
  Bookmark,
  HistoryItem,
} from "./types";

const execFileAsync = promisify(execFile);

const MOZEIDON = "/opt/homebrew/bin/mozeidon"; // Raycast doesn't inherit shell PATH
const BROWSER_APP = "Zen"; // change if using a different browser
const BOOKMARKS_LIMIT = "500";
const HISTORY_LIMIT = "300";
const CLI_TIMEOUT_MS = 8_000; // tabs get can hang if browser extension is unreachable

async function run(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(MOZEIDON, args, { timeout: CLI_TIMEOUT_MS });
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

export async function switchTab(switchArg: string): Promise<void> {
  await execFileAsync(MOZEIDON, ["tabs", "switch", switchArg]);
  await execFileAsync("open", ["-a", BROWSER_APP]);
}

export async function openInBrowser(url: string): Promise<void> {
  await execFileAsync("open", [url]);
}
