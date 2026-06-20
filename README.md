<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/4a157bda-2a99-4ac3-6bc7-be08b4a46600/public">
  <source media="(prefers-color-scheme: light)" srcset="https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/31447544-b16f-49dd-c206-74b1802c6700/public">
  <img width=200 alt="Trigger.dev logo" src="https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/4a157bda-2a99-4ac3-6bc7-be08b4a46600/public">
</picture>
</div>

</br>
<p align="center">
  <a href="https://console.algora.io/org/triggerdotdev/bounties?status=open"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fconsole.algora.io%2Fapi%2Fshields%2Ftriggerdotdev%2Fbounties%3Fstatus%3Dopen" alt="Open Bounties" /></a>
  <a href="https://console.algora.io/org/triggerdotdev/bounties?status=completed"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fconsole.algora.io%2Fapi%2Fshields%2Ftriggerdotdev%2Fbounties%3Fstatus%3Dcompleted" alt="Rewarded Bounties" /></a>
</p>

# Brought to you by Trigger.dev

JSON Hero was created and is maintained by the team behind [Trigger.dev](https://trigger.dev). With Trigger.dev you can trigger workflows from APIs, on a schedule, or on demand. We make API calls easy with authentication handled for you, and you can add durable delays that survive server restarts.

# JSON Hero

JSON Hero makes reading and understand JSON files easy by giving you a clean and beautiful UI packed with extra features.

## Local JSON Hero Desktop for macOS

This fork adds an isolated macOS desktop app layer named **Local JSON Hero**. The original Remix/Cloudflare Workers web app remains intact; the desktop app is built with **Tauri + Vite** and reuses the JSONHero viewer components for column, editor, tree, search, path, and inspector behavior.

### Why Tauri

Tauri is the best fit here because JSONHero already has a complete web UI and the desktop requirements only need a native shell, a macOS file picker, file-open events, and a small local file-reading bridge. Electron would work, but it would ship a full Chromium/Node runtime for a job that WebKit plus a narrow Rust bridge can handle more lightly.

### Desktop features

- Open local `.json`, `.jsonl`, and `.ndjson` files with the native macOS picker.
- Drag and drop files onto the app window.
- Paste JSON or JSONL text from the clipboard.
- Open files directly from Finder with **Open With** once the `.app` is installed or registered.
- Browse data with the JSONHero-style column view, editor view, tree view, fuzzy search, path bar, and inspector.
- Parse JSON in a Web Worker so large payload parsing does not block the UI thread.
- Parse JSONL/NDJSON as a JSON array, with a toggle to show the full file or a sampled first 1,000 rows.
- Show clear parse errors, including JSONL line numbers when available.
- Produce a macOS `.app` and `.dmg`.

### Privacy

The desktop app is designed to work locally. It does not upload JSON contents to JSONHero, Trigger.dev, or any other server. The desktop entrypoint does not load the original Fathom analytics or Intercom code, and external URL previews are disabled in desktop mode so selecting URL values in a JSON file does not trigger network preview fetches.

### License and naming

The upstream JSONHero source is licensed under Apache-2.0. Apache-2.0 allows modification and redistribution under its terms, but it does not automatically grant trademark rights. This desktop build therefore uses the temporary name **Local JSON Hero** instead of presenting itself as the official JSONHero macOS app.

### Desktop setup and commands

Prerequisites:

- Node.js and npm. The upstream project documents Node 16; this desktop build was also verified on Node 22 with engine warnings from older JSONHero packages.
- Rust/Cargo via [rustup](https://rustup.rs/).
- Xcode or Xcode Command Line Tools for macOS bundling.

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run desktop:dev
```

Run only the desktop web shell during UI development:

```bash
npm run desktop:dev:web
```

Build the macOS `.app`:

```bash
npm run desktop:build:app
```

Build the macOS `.dmg`:

```bash
npm run desktop:build:dmg
```

Build both:

```bash
npm run desktop:build
```

Build, sign, notarize, staple, and validate the shareable macOS DMG:

```bash
npm run desktop:release:mac
```

Build output:

```text
src-tauri/target/release/bundle/macos/Local JSON Hero.app
src-tauri/target/release/bundle/dmg/Local JSON Hero_0.1.0_aarch64.dmg
```

### Signing and notarization

For external sharing outside the Mac App Store, install a **Developer ID Application** certificate in Keychain. An **Apple Distribution** certificate is not the right certificate for a Developer ID DMG distribution.

Check local signing identities:

```bash
security find-identity -v -p codesigning
```

Create a local notarytool profile. Use an Apple app-specific password or App Store Connect API key credentials; do not commit credentials or `.p8` files to this repository.

```bash
xcrun notarytool store-credentials "LocalJSONHero" \
  --apple-id "you@example.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "APP_SPECIFIC_PASSWORD"
```

Then build the signed and notarized DMG:

```bash
npm run desktop:release:mac
```

The release script:

- Finds the first installed `Developer ID Application` identity, or uses `APPLE_SIGNING_IDENTITY` if set.
- Builds the app with Tauri hardened runtime enabled.
- Signs the `.app` and `.dmg`.
- Submits the `.dmg` to Apple notarization with the `LocalJSONHero` keychain profile.
- Staples and validates the notarization ticket.

If you need a different notarytool profile name:

```bash
NOTARY_PROFILE="MyProfileName" npm run desktop:release:mac
```

### Desktop implementation notes

- `app/desktop/` contains the desktop React entry, local file loading, the JSON/JSONL parser worker, and a small Remix shim used only by Vite.
- `desktop/` contains the Vite HTML entry.
- `src-tauri/` contains the macOS shell, file-open event handling, native file picker capability, bundle metadata, file associations, and temporary icon.
- `vite.config.ts` builds the desktop UI without changing the original Remix build.

### Current desktop limitations

- Large JSON files still depend on JSONHero's existing in-memory viewer model after parsing. The parser runs off the UI thread, but rendering very large/deep objects can still become expensive.
- JSONL sampling is currently fixed at the first 1,000 non-empty rows.
- Signed distribution requires a local Developer ID Application certificate and notarytool credentials.
- The icon is temporary.
- This build currently targets Apple Silicon (`aarch64`) on the machine where it was built. Use Tauri's universal target if you need Intel + Apple Silicon in one app.

- View JSON any way you'd like: Column View, Tree View, Editor View, and more.
- Automatically infers the contents of strings and provides useful previews
- Creates an inferred JSON Schema that could be used to validate your JSON
- Quickly scan related values to check for edge cases
- Search your JSON files (both keys and values)
- Keyboard accessible
- Easily sharable URLs with path support

![JSON Hero Screenshot](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/0f5735b3-2421-470b-244c-7047fd77f700/public)

## Features

### Send to JSON Hero

Send your JSON to JSON Hero in a variety of ways

- Head to [jsonhero.io](https://jsonhero.io) and Drag and Drop a JSON file, or paste JSON or a JSON url in the provided form
- Include a Base64 encoded string of a JSON payload: [jsonhero.io/new?j=eyAiZm9vIjogImJhciIgfQ==](https://jsonhero.io/new?j=eyAiZm9vIjogImJhciIgfQ==)
- Include a JSON URL to the `new` endpoint: [jsonhero.io/new?url=https://jsonplaceholder.typicode.com/todos/1](https://jsonhero.io/new?url=https://jsonplaceholder.typicode.com/todos/1)
- Install the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=JSONHero.jsonhero-vscode) and open JSON from VS Code
- Raycast user? Check out our extension [here](https://www.raycast.com/maverickdotdev/open-in-json-hero)
- Use the unofficial API:

  - Make a `POST` request to `jsonhero.io/api/create.json` with the following JSON body:

  ```json
  {
    "title": "test 123",
    "content": { "foo": "bar" },
    "readOnly": false, // this is optional, will make it so the document title cannot be edited or document cannot be deleted
    "ttl": 3600 // this will expire the document after 3600 seconds, also optional
  }
  ```

  The JSON response will be the following:

  ```json
  {
    "id": "YKKduNySH7Ub",
    "title": "test 123",
    "location": "https://jsonhero.io/j/YKKduNySH7Ub"
  }
  ```

### Column view

Inspired by macOS Finder, Column View is a new way to browse a JSON document.

![JSON Hero Column View](https://raw.githubusercontent.com/triggerdotdev/documentation-hosting/main/images/features-columnview.gif)

It has all the features you'd expect: Keyboard navigation, Path bar, history.

It also has a nifty feature that allows you to "hold" a descendent selected and travel up through the hierarchy, and then move between siblings and view the different values found at that path. It's hard to describe, but here is an animation to help demonstrate:

![Column View - Traverse with Context](https://raw.githubusercontent.com/triggerdotdev/documentation-hosting/main/images/features-traversewithcontext.gif)

As you can see, holding the `Option` (or `Alt` key on Windows) while moving to a parent keeps the part of the document selected and shows it in context of it's surrounding JSON. Then you can traverse between items in an array and compare the values of the selection across deep hierarchy cahnges.

### Editor view

View your entire JSON document in an editor, but keep the nice previews and related values you get from the sidebar as you move around the document:

![Editor view](https://raw.githubusercontent.com/triggerdotdev/documentation-hosting/main/images/features-editorview.gif)

### Tree view

Use a traditional tree view to traverse your JSON document, with collapsible sections and keyboard shortcuts. All while keeping the nice previews:

![Tree view](https://raw.githubusercontent.com/triggerdotdev/documentation-hosting/main/images/features-treeview.gif)

### Search

Quickly open a search panel and fuzzy search your entire JSON file in milliseconds. Searches through key names, key paths, values, and even pretty formatted values (e.g. Searching for `"Dec"` will find datetime strings in the month of December.)

![Search](https://raw.githubusercontent.com/triggerdotdev/documentation-hosting/main/images/features-search.gif)

### Content Previews

JSON Hero automatically infers the content of strings and provides useful previews and properties of the value you've selected. It's "Show Don't Tell" for JSON:

#### Dates and Times

![Preview colors](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/43f2c081-c09b-47db-cb10-8f15ee6a1a00/public)

#### Image URLs

![Preview colors](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/8a743bd5-a065-4f7f-1262-585c39c10100/public)

#### Website URLs

![Preview websites](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/cd7f2d28-2c8d-4b37-696d-e898937c3d00/public)

#### Tweet URLS

![Preview tweets](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/8455e9d6-1d3e-451e-a032-f3259204ef00/public)

#### JSON URLs

![Preview JSON](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/13743860-3d9c-4cac-dde9-881fba7eba00/public)

#### Colors

![Preview colors](https://imagedelivery.net/3TbraffuDZ4aEf8KWOmI_w/22e37599-c2bd-4abd-79f2-466241d17b00/public)

### Related Values

Easily see all the related values across your entire JSON document for a specific field, including any `undefined` or `null` values.

![Editor view](https://raw.githubusercontent.com/triggerdotdev/documentation-hosting/main/images/features-relatedvalues.gif)

<!-- TODO -->

## Bugs and Feature Requests

Have a bug or a feature request? Feel free to [open a new issue](https://github.com/triggerdotdev/jsonhero-web/issues).

You can also join our [Discord channel](https://discord.gg/JtBAxBr2m3) to hang out and discuss anything you'd like.

## Developing

To run locally, first clone the repo and install the dependencies:

```bash
git clone https://github.com/triggerdotdev/jsonhero-web.git
cd jsonhero-web
npm install
```

Then, create a file at the root of the repo called `.env` and set the `SESSION_SECRET` value:

```
SESSION_SECRET=abc123
```

Then, run `npm run build` or `npm run dev` to build.

Now, run `npm start` and open your browser to `http://localhost:8787`
