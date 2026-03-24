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
