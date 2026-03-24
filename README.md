# Raycast Mozeidon

A [Raycast](https://raycast.com) extension that lets you search open tabs, bookmarks, and history from your browser via [mozeidon](https://github.com/nicholasgasior/mozeidon).

Built for [Zen Browser](https://zen-browser.app) (Firefox/Gecko-based). Should work with any Firefox fork that supports the mozeidon extension.

## Requirements

- [mozeidon CLI](https://github.com/nicholasgasior/mozeidon) installed at `/opt/homebrew/bin/mozeidon`
- mozeidon browser extension active in Zen/Firefox
- Browser must be running when you invoke the command

## Features

- Unified search across tabs, bookmarks, and history
- Switch to an open tab directly from Raycast
- Open any result in the browser
- Copy URL to clipboard

## Known Issues

### `Tab.id` typed as `string`, CLI returns `number`

`src/types.ts` declares `Tab.id: string` but the mozeidon CLI returns it as a number (e.g. `"id": 22`). The `switchArg` is built via template literal (`${tab.windowId}:${tab.id}`), which coerces it to a string and works correctly at runtime — but TypeScript's type is wrong. Low priority since it has no visible effect.

### Hardcoded binary path and browser name

`src/mozeidon.ts` hardcodes two constants at the top:

```ts
const MOZEIDON = "/opt/homebrew/bin/mozeidon";
const BROWSER_APP = "Zen";
```

If you use a different install location or browser (e.g. Firefox), edit these before building. Ideally these would be Raycast preferences — contributions welcome.

### Sequential fetching

Tabs, bookmarks, and history are fetched one after the other rather than in parallel. This is intentional: the browser extension handles one socket connection at a time, and concurrent calls caused some to hang indefinitely. The trade-off is a small amount of extra latency on first load (~200–400 ms).

### Dev mode double-render

When running with `npm run dev`, React strict mode invokes the data-fetching effect twice. This is handled with a `cancelled` flag in the cleanup function and does not affect production builds.

---

## Install for permanent use (local)

You do not need to submit to the Raycast store to use this permanently.

**1. Build the extension**

```bash
npm install
npm run build
```

**2. Import into Raycast**

- Open Raycast → Settings (`⌘,`) → Extensions
- Click **+** → **Import Extension**
- Select this project folder

Raycast will install it as a local extension. It persists across reboots and does not require a running dev server.

---

## Submit to the Raycast Store

If you want to publish this for other users:

1. Fork [raycast/extensions](https://github.com/raycast/extensions)
2. Copy this project into `extensions/mozeidon/`
3. Make sure `package.json` has a valid `author` field matching your Raycast handle
4. Add a proper 512×512 `assets/extension-icon.png` if not already present
5. Run `npm run lint` and `npm run build` — both must pass with no errors
6. Open a PR against `raycast/extensions` following their [contribution guide](https://developers.raycast.com/basics/publish-an-extension)

Before submitting, address the hardcoded path/browser issues above — the store requires extensions to work out of the box for all users.
