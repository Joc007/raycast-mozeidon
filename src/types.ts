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
  lastAccessed: number; // timestamp ms
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
