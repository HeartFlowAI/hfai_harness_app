# Changelog

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
