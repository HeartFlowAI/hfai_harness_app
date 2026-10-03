<p align="center">
  <img src="src/assets/brand/heartflow.png" width="88" alt="Heartflow AI logo" />
</p>

<h1 align="center">Aurora · Heartflow AI</h1>

<p align="center">
  <strong>Your ideas, brought to life.</strong><br />
  A Windows AI companion for conversation, code, voice and everyday desktop tasks.
</p>

<p align="center">
  <strong>Windows</strong> &nbsp;·&nbsp; Ollama Cloud &nbsp;·&nbsp; Optional voice &nbsp;·&nbsp; Early preview
</p>

<p align="center">
  <a href="docs/INSTALLATION.md"><strong>Install Aurora</strong></a> &nbsp;·&nbsp;
  <a href="docs/PRIVACY.md">Privacy & permissions</a> &nbsp;·&nbsp;
  <a href="docs/DEVELOPMENT.md">Development</a> &nbsp;·&nbsp;
  <a href="WHITEPAPER.md">Whitepaper</a>
</p>

<p align="center">
  <img src="src/assets/aurora/reference.png" height="230" alt="Aurora, the pink-haired Heartflow AI desktop companion" />
</p>

---

## Meet your companion

Connect your own Ollama Cloud account, choose a model with tool support, and work with Aurora in the app or on your desktop. She can help you explore an idea, understand a project, find a file or interact with a supported application—and show what she’s doing along the way.

> [!NOTE]
> **Aurora is an early preview.** Browser reliability and speech accuracy vary. Windows builds are unsigned, and there is no automatic updater or production installer yet.

## A little company. A lot of possibilities.

| | What you can do |
| :--- | :--- |
| 💬 **Chat & code** | Switch between Normal and Aurora Code. Organize projects, search saved sessions and read formatted replies with code highlighting. |
| 📁 **Find your files** | Search filenames in configured folders, select a result in Explorer and let Aurora point to a verified visible file row. |
| 🖱️ **Desktop assistance** | Restore or launch supported apps and interact through observed controls with animated mouse movement and keyboard input. |
| 🎙️ **Talk naturally** | Enable ElevenLabs or Fish Audio recognition and speech. Say “Aurora,” answer follow-up questions and use the notch while minimized. |
| ✨ **A visible companion** | Animated activity poses, desktop teleports, a pink pointer and a compact keyboard/action display. |
| 🛡️ **Review & control** | Follow tool activity, stop a task and approve every direct file write or PowerShell command before it runs. |

**Supported browsers:** Opera · Brave · Chrome · Edge · Firefox  
**Other supported apps:** Explorer · Notepad · Calculator

## Get started

### 1 · Install and launch

Follow the **[complete Windows installation guide](docs/INSTALLATION.md)** for downloading the source, prerequisites, executable packaging, desktop shortcuts and troubleshooting.

Already have the source on Windows with Node.js 22 or newer and npm installed?

```powershell
npm.cmd ci
npm.cmd start
```

> A GitHub source ZIP needs the source setup steps. It is not a runnable Windows release. Use a packaged release only when one is actually supplied by the maintainers.

### 2 · Connect your model

Open **Settings & connection**, enter your own [Ollama Cloud API key](https://ollama.com/settings/keys), click **Load models**, select a model with tool support and save. No local Ollama installation is required.

Choose a workspace folder before asking Aurora to read or create project files. The app uses your credentials; no shared cloud account or free API usage is included.

### 3 · Say hello

Try a request like:

> “Explain what’s in my project folder.”

> “Find my invoice PDF.”

> “Open Brave, go to YouTube, and play the song I asked for.”

> “Create hello-aurora.txt in my workspace.”

Questions appear inside the chat. Answer by typing, clicking a choice or speaking when listening is enabled. File-write and PowerShell approvals have separate review dialogs.

## Say “Aurora”

Voice is optional and starts **off** on every launch. In **Voice & wake word**, configure your provider key and voice ID, select recognition, save and explicitly enable listening.

Say “Aurora,” wait for her greeting, then speak. If she needs a detail, she asks and continues after your answer. When minimized, the conversation notch appears after activation and hides when the conversation ends.

| Say this | Aurora will… |
| :--- | :--- |
| **“Stop task”** | Cancel current work. Completed changes remain. |
| **“Go to sleep”** | End the conversation and return to wake-word listening. |
| **“Stop listening”** | Turn the microphone off. |
| **“Approve action” / “Deny action”** | Answer the currently displayed file-write or command approval. |

After verified requested music playback with an observed Pause control, a minimized voice conversation can say “Enjoy the music” and return to wake-word listening. Other tasks keep the normal conversation flow.

Speech playback cannot be interrupted by voice in this preview; use the app controls if needed. See [voice setup](docs/INSTALLATION.md#6-set-up-voice-if-wanted) for provider requirements and microphone permissions.

## Your data and your controls

Saved keys are encrypted for the current Windows user with Electron safeStorage/Windows DPAPI. Chats and project paths remain local plain-text data. Conversation history and tool outputs go to your chosen model provider. Cloud recognition sends captured speech to the selected provider, including speech used for wake-word detection; spoken replies go to your speech provider. Provider permissions, quotas and charges apply.

Direct file tools restrict access to the chosen workspace. **PowerShell is not sandboxed:** an approved command can access resources available to your Windows account. Desktop control has an application allowlist and foreground checks, but model mistakes remain possible. Completed changes are not automatically undone.

Browser actions need a supported, accessible foreground window. Opening YouTube is not proof that a song is playing. Leave the mouse still while Aurora acts; changing focus or moving the pointer can stop an action. Arbitrary websites and every player layout are not guaranteed to work.

**[Read the data handling and permissions guide →](docs/PRIVACY.md)**

## Build with Aurora

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run pack
```

The [development guide](docs/DEVELOPMENT.md) covers packaging, integration checks and the documented dependency-audit status. Controlled checks do not establish reliable completion of every real-world task or microphone accuracy.

| Explore more | |
| :--- | :--- |
| [Installation guide](docs/INSTALLATION.md) | Full Windows setup, voice, shortcuts and troubleshooting. |
| [Development guide](docs/DEVELOPMENT.md) | Build commands, fixtures and verification. |
| [Privacy & permissions](docs/PRIVACY.md) | Local storage, cloud data and execution boundaries. |
| [Project whitepaper](WHITEPAPER.md) | Architecture, implemented features, limitations and roadmap. |

---

<p align="center"><strong>Made with heart. ♥</strong><br />Heartflow AI · Aurora</p>

Third-party library notices are in `src/vendor/`. No project redistribution license has been selected. Public visibility alone does not grant reuse permission for project code or character/brand assets.
