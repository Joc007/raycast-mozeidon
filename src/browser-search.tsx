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
import {
  checkProfile,
  fetchTabs,
  fetchBookmarks,
  fetchHistory,
  switchTab,
  openInBrowser,
} from "./mozeidon";
import type { BrowserItem } from "./types";

type State =
  | { status: "loading" }
  | { status: "enoent" }
  | { status: "no-profile" }
  | { status: "all-failed" }
  | {
      status: "ready";
      tabs: BrowserItem[];
      bookmarks: BrowserItem[];
      history: BrowserItem[];
    };

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
        setState(
          code === "ENOENT" ? { status: "enoent" } : { status: "all-failed" },
        );
        return;
      }

      if (!hasProfile) {
        setState({ status: "no-profile" });
        return;
      }

      // Step 2: Parallel fetch — use allSettled so one failure doesn't cancel others
      const [tabsResult, bookmarksResult, historyResult] =
        await Promise.allSettled([
          fetchTabs(),
          fetchBookmarks(),
          fetchHistory(),
        ]);

      const tabs = tabsResult.status === "fulfilled" ? tabsResult.value : [];
      const bookmarks =
        bookmarksResult.status === "fulfilled" ? bookmarksResult.value : [];
      const history =
        historyResult.status === "fulfilled" ? historyResult.value : [];

      // Toast for each partial failure
      if (tabsResult.status === "rejected") {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not load tabs",
          message: "Is the mozeidon extension active in Zen?",
        });
      }
      if (bookmarksResult.status === "rejected") {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not load bookmarks",
        });
      }
      if (historyResult.status === "rejected") {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not load history",
        });
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
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={retry} />
            </ActionPanel>
          }
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
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={retry} />
            </ActionPanel>
          }
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
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={retry} />
            </ActionPanel>
          }
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
          {tabs.map((item) => (
            <BrowserListItem key={`${item.type}-${item.url}`} item={item} />
          ))}
        </List.Section>
      )}
      {bookmarks.length > 0 && (
        <List.Section title="Bookmarks">
          {bookmarks.map((item) => (
            <BrowserListItem key={`${item.type}-${item.url}`} item={item} />
          ))}
        </List.Section>
      )}
      {history.length > 0 && (
        <List.Section title="History">
          {history.map((item) => (
            <BrowserListItem key={`${item.type}-${item.url}`} item={item} />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function BrowserListItem({ item }: { item: BrowserItem }) {
  const icon =
    item.type === "tab"
      ? Icon.Globe
      : item.type === "bookmark"
        ? Icon.Bookmark
        : Icon.Clock;
  const label =
    item.type === "tab"
      ? "Tab"
      : item.type === "bookmark"
        ? "Bookmark"
        : "History";

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
                  try {
                    switchTab(item.switchArg!);
                    await closeMainWindow();
                  } catch {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to switch tab",
                    });
                  }
                }}
              />
              <Action
                title="Open in Browser"
                icon={Icon.Globe}
                onAction={async () => {
                  try {
                    openInBrowser(item.url);
                  } catch {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to open in browser",
                    });
                  }
                }}
              />
            </>
          ) : (
            <Action
              title="Open in Browser"
              icon={Icon.Globe}
              onAction={async () => {
                try {
                  openInBrowser(item.url);
                } catch {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to open in browser",
                  });
                }
              }}
            />
          )}
          <Action.CopyToClipboard title="Copy URL" content={item.url} />
        </ActionPanel>
      }
    />
  );
}
