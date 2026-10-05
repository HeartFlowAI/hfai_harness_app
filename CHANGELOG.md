# Changelog

## 0.2.3 — A calmer workspace

- Removed Mint from the appearance picker. Previously saved Mint selections fall back to Classic.
- Grouped connection, voice, appearance and update settings into one Settings menu; kept listening directly available in the sidebar.
- Moved workspace selection into the session toolbar and session deletion into its options menu.
- Moved the available-update download button beside Settings, freeing the chat header.
- Reduced sidebar clutter, shortened workspace labels with full paths on hover, and made the six appearance cards fit in a compact grid.

## 0.2.2 — Community appearances

- Added Cyber, Dark and Cozy community appearances, with “Created by Jaymie” beneath each name.
- Each outfit has its own transparent pixel-art pose sheet for idle, thinking, waiting, coding, browsing, movement, celebrating and errors. Teleport effects use the selected outfit; pointing uses its reaching pose.
- Selected outfits follow Aurora between the main app, voice notch and desktop companion.

## 0.2.1 — Shutdown and single-instance fix

- Closing the main window shuts down the full app, including hidden action displays, pet/notch windows, speech, native helpers and timers.
- Wait for an interrupted task and queued local saves before exiting. A bounded shutdown fallback prevents a stuck helper from holding the instance indefinitely.
- A second launch restores the existing window. Launches during startup are queued; launches during shutdown request a fresh process after the old one exits.
- Prevent late pointer/overlay callbacks from recreating activity after disposal.
- Verified with real Electron single-instance locks and three repeated close/reopen cycles in an isolated profile, including auxiliary windows and an interrupted model request. No live microphone, cloud requests or physical computer input were used.

## 0.2.0 — Local release preparation

- Separate saved connections for OpenAI, Claude / Anthropic, OpenRouter, Ollama Cloud and local Ollama. Streaming replies and tool results use provider-specific adapters while sharing Aurora's tools and approval flow.
- Preserve legacy Ollama credentials and chats; encrypt each cloud provider key for the Windows account. Local model requests use a loopback server without an API key.
- Web search keeps a separate Ollama Cloud connection. Voice remains independently configured.
- Classic, Moonlight, Sunrise and Mint colour palettes apply to the app, notch and desktop companion, reusing the full animation set.
- Per-user Windows installer and explicit download/restart controls. Installed copies quietly check GitHub Releases shortly after startup; development and portable copies use manual updates.
- Versioned release workflow, fixed build output and guarded cleanup of redundant legacy builds. Packaging never publishes automatically.
- Resolve the previously reported dependency audit issue with a non-forced dependency refresh.

Provider streams and updates are verified with fixtures. Live provider account access and a published installed-version upgrade need separate validation. No GitHub release is implied by this changelog entry.

## 0.1.0 — Prototype baseline

- Windows chat and code modes, projects and session search.
- Optional wake-word voice conversations, minimized notch and desktop companion.
- File search, Explorer presentation, approved workspace writes and PowerShell.
- Supported browser and application interaction through observed controls.
