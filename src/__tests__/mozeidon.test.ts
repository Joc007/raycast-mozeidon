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

import { checkProfile, fetchTabs, fetchBookmarks, fetchHistory, switchTab, openInBrowser } from "../mozeidon";

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

  it("throws when CLI returns error JSON", async () => {
    mockStdout(JSON.stringify({ error: "unexpected error" }));
    await expect(checkProfile()).rejects.toThrow("unexpected error");
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

describe("switchTab", () => {
  it("calls mozeidon tabs switch then opens Zen", () => {
    const execFileSync = require("child_process").execFileSync as jest.MockedFunction<typeof import("child_process").execFileSync>;
    switchTab("1:42");
    expect(execFileSync).toHaveBeenCalledWith("mozeidon", ["tabs", "switch", "1:42"]);
    expect(execFileSync).toHaveBeenCalledWith("open", ["-a", "Zen"]);
  });
});

describe("openInBrowser", () => {
  it("calls open with the url", () => {
    const execFileSync = require("child_process").execFileSync as jest.MockedFunction<typeof import("child_process").execFileSync>;
    openInBrowser("https://example.com");
    expect(execFileSync).toHaveBeenCalledWith("open", ["https://example.com"]);
  });
});
