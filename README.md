# Raycast Mozeidon

A [Raycast](https://raycast.com) extension that lets you search open tabs, bookmarks, and history from your browser via [mozeidon](https://github.com/egovelox/mozeidon).

Built for [Zen Browser](https://zen-browser.app) (Firefox/Gecko-based). Works with any Firefox fork that supports the mozeidon add-on.

## Prerequisites

This extension cannot work without all three mozeidon components installed and running.

### 1. Browser add-on

Install the [mozeidon Firefox add-on](https://github.com/egovelox/mozeidon#firefox-add-on) from the Firefox Add-ons store. Enable it in your browser.

### 2. Native app + CLI

```bash
brew tap egovelox/homebrew-mozeidon
brew install egovelox/mozeidon/mozeidon-native-app
brew install egovelox/mozeidon/mozeidon
```

This installs:
- `/opt/homebrew/bin/mozeidon-native-app` — the native messaging host
- `/opt/homebrew/bin/mozeidon` — the CLI this extension calls

### 3. Native messaging manifest

Create the file `~/Library/Application Support/Mozilla/NativeMessagingHosts/mozeidon.json`:

```json
{
  "name": "mozeidon",
  "description": "Native messaging add-on to interact with your browser",
  "path": "/opt/homebrew/bin/mozeidon-native-app",
  "type": "stdio",
  "allowed_extensions": ["mozeidon-addon@egovelox.com"]
}
```

This file tells Firefox (and Zen, which reads the same path) how to reach the native app. Without it, the add-on cannot communicate with the CLI.

> Restart your browser after creating this file.

### Verify the setup

```bash
mozeidon tabs get
```

If you see your open tabs as JSON, everything is working.

---

## Features

- Unified search across tabs, bookmarks, and history
- Switch to an open tab directly from Raycast
- Open any result in the browser
- Copy URL to clipboard

---

## Install for permanent use (local)

You do not need to submit to the Raycast store to use this permanently.

**1. Clone and build**

```bash
git clone https://github.com/Joc007/raycast-mozeidon.git
cd raycast-mozeidon
npm install
npm run build
```

**2. Import into Raycast**

- Open Raycast → Settings (`⌘,`) → Extensions
- Click **+** → **Import Extension**
- Select the `raycast-mozeidon` folder

Raycast installs it as a local extension. It persists across reboots without a running dev server.

---

## Submit to the Raycast Store

If you want to publish this for other users:

1. Fork [raycast/extensions](https://github.com/raycast/extensions)
2. Copy this project into `extensions/mozeidon/`
3. Make sure `package.json` has a valid `author` field matching your Raycast handle
4. Add a proper 512×512 `assets/extension-icon.png` if not already present
5. Run `npm run lint` and `npm run build` — both must pass with no errors
6. Open a PR against `raycast/extensions` following their [contribution guide](https://developers.raycast.com/basics/publish-an-extension)

Before submitting, address the hardcoded path/browser issues noted below — the store requires extensions to work out of the box for all users.

---

## Known Issues

### Hardcoded binary path and browser name

`src/mozeidon.ts` hardcodes two constants:

```ts
const MOZEIDON = "/opt/homebrew/bin/mozeidon";
const BROWSER_APP = "Zen";
```

If you use a different install location or browser (e.g. plain Firefox), edit these before building. Ideally these would be Raycast preferences — contributions welcome.

### Sequential fetching

Tabs, bookmarks, and history are fetched one after the other rather than in parallel. This is intentional: the browser extension handles one socket connection at a time, and concurrent calls caused some to hang indefinitely. The trade-off is a small amount of extra latency on first load (~200–400 ms).

### `Tab.id` typed as `string`, CLI returns `number`

`src/types.ts` declares `Tab.id: string` but the mozeidon CLI returns it as a number. The `switchArg` (`${tab.windowId}:${tab.id}`) coerces it correctly at runtime, so there is no visible effect.
