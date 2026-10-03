# Aurora · Heartflow AI

Aurora is a Windows AI companion that combines chat, coding assistance, voice conversations and supported desktop actions. Connect your own Ollama Cloud account, choose a model with tool support, and work with an animated companion in the app or on your desktop.

**Status:** early preview. Browser reliability and speech accuracy vary. Windows builds are unsigned; there is no automatic updater or production installer yet.

## What Aurora can do

- **Chat and code:** Normal and Aurora Code modes, project folders, saved sessions, session search and deletion, and formatted replies with code highlighting.
- **Find files:** search filenames in configured folders, select a result in Explorer, and point to a verified visible file row.
- **Use supported apps:** restore or launch Opera, Brave, Chrome, Edge, Firefox, Explorer, Notepad and Calculator; interact through observed accessibility controls using mouse and keyboard input.
- **Talk with you:** optional ElevenLabs or Fish Audio recognition and speech, the “Aurora” wake word, spoken follow-up answers, brief voice replies and a minimized conversation notch.
- **Show activity:** animated character poses, desktop teleports, a pink animated pointer during computer actions and a keyboard/action display.
- **Keep work reviewable:** activity history, task cancellation, and approval before every direct file write or PowerShell command.

The app uses your credentials. It does not include a shared cloud account, free API usage or a local language model.

## Install and run

Start with the [complete Windows installation guide](docs/INSTALLATION.md). It covers prerequisites, downloading the source, starting the app, building an executable, provider setup, voice, desktop shortcuts and troubleshooting.

For an existing source checkout on Windows, with Node.js 22 or newer and npm installed:

```powershell
npm.cmd ci
npm.cmd start
```

Then open **Settings & connection**, enter your own [Ollama Cloud API key](https://ollama.com/settings/keys), load models and select one that supports tools. No local Ollama installation is required.

**A GitHub source ZIP is not a runnable Windows release.** Follow the source instructions, or use a packaged release only when one is actually supplied by the repository maintainers.

## Try Aurora

- “Explain what’s in my project folder.”
- “Find my invoice PDF.”
- “Open Brave, go to YouTube, and play the song I asked for.”
- “Create hello-aurora.txt in my workspace.”

Choose a workspace for project file tools. Clarifying questions appear inside the chat; answer by typing, clicking a choice or speaking when listening is enabled. File-write and PowerShell approvals have separate review dialogs.

Browser actions require a supported, accessible foreground window. Playback is only confirmed from observed player state; arbitrary websites and every YouTube layout are not guaranteed to work. Leave the mouse still while Aurora acts. Changing focus or moving the pointer can stop an action for safety.

## Voice and the desktop companion

Voice is optional and starts **off** whenever you open the app. Configure a provider key and voice ID in **Voice & wake word**, select recognition, save and explicitly enable listening. Say “Aurora,” wait for the greeting, then speak. She can ask for a detail and continue after your answer.

When minimized, the notch appears after activation and hides when the conversation ends. For verified requested music playback with an observed Pause control, a minimized voice conversation can say “Enjoy the music” and return to wake-word listening. Other tasks keep the normal conversation flow.

Use “stop task,” “go to sleep,” or “stop listening.” File-write and command approval requires “approve action” or “deny action” for the currently displayed request. Speech playback cannot be interrupted by voice in this preview; use the app controls if needed.

## Data and permissions

Read [data handling and permissions](docs/PRIVACY.md) before enabling cloud voice or computer control.

Saved keys are encrypted for the current Windows user with Electron safeStorage/Windows DPAPI. Chats and project paths remain local plain-text data. Conversation history and tool outputs are sent to your chosen model provider. Cloud recognition sends captured speech to your recognition provider, including speech used for wake-word detection; spoken replies go to your speech provider. Provider permissions, quotas and charges apply.

Direct file tools restrict access to the chosen workspace. **PowerShell is not sandboxed:** an approved command can access resources available to your Windows account. Desktop control has an application allowlist and foreground checks, but model mistakes remain possible. Completed changes are not automatically undone.

## Development

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run pack
```

See [development and verification](docs/DEVELOPMENT.md) for packaging and integration tests. Current controlled checks do not establish reliable completion of every real-world task or microphone accuracy.

The [whitepaper](WHITEPAPER.md) describes the architecture, implemented boundaries, limitations and roadmap. Third-party library notices are in `src/vendor/`. Public visibility alone does not grant a license to the project code or character/brand assets; no project redistribution license has been selected.
