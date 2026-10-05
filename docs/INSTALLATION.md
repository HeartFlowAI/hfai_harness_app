# Windows installation guide

## 1. Check the requirements

- Windows 10 or Windows 11, 64-bit x64. Windows 11 is the primary tested environment. Linux, macOS and Windows on ARM are not validated for this project’s native helpers.
- Internet access for dependency downloads and cloud requests.
- A model provider API key (OpenAI, Anthropic, OpenRouter or Ollama Cloud), or a local Ollama installation with a model that supports tools.
- To run or build from source: Node.js 22 or newer, including npm. Install a supported LTS Windows x64 version from [nodejs.org](https://nodejs.org/en/download). Allow its installer to add Node.js to PATH, then open a new terminal.
- Windows PowerShell 5.1 and the Windows .NET Framework components used by the bundled native helpers. These normally ship with Windows; PowerShell 7 alone is not the helper runtime.
- Optional voice: a microphone, speakers or headphones, and an ElevenLabs or Fish Audio key with the API access and credits needed for recognition and speech.
- Optional browser actions: install the browser you want to use in its standard location, or open it before asking Aurora to use it.

For cloud models, no local Ollama server, Python, GitHub CLI or globally installed Electron is needed to run the app from a downloaded source ZIP. Git is optional unless you choose to clone the repository. Administrator access is not required to launch Aurora; native helpers run with your Windows account’s permissions.

## 2. Get the project

For the easiest installation, open this repository’s **Releases** page and download the versioned **Heartflow Aurora Setup** executable when a release is available. Run it under your Windows account, choose an installation folder and launch from its desktop shortcut. Node.js and npm are not needed for installed copies. A source ZIP is a different download; follow the source instructions below if no installer release is published.

1. Open this repository’s GitHub page.
2. Select **Code → Download ZIP**.
3. Right-click the ZIP and select **Extract All**. Use a folder you own, such as a folder under Documents.
4. Open the extracted folder containing `package.json`, `package-lock.json` and `Launch Aurora.cmd`.
5. Right-click inside the folder and choose **Open in Terminal**. Keep the terminal in this project folder.

Alternatively, copy the repository’s HTTPS clone address from **Code**, clone it with Git, and open a terminal in the cloned folder. Use Git’s normal sign-in flow for private access. Do not embed an API key or GitHub token in a clone URL.

## 3. Install dependencies and start

Check the installed versions:

```powershell
node --version
npm.cmd --version
```

Install the exact dependencies from the lockfile, then start Aurora:

```powershell
npm.cmd ci
npm.cmd start
```

The first install downloads Electron and can take a few minutes. `npm.cmd` is used here so PowerShell does not need to run the `npm.ps1` wrapper. Keep the lockfile; [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/) uses it for a reproducible installation.

After dependencies are installed, double-click **Launch Aurora.cmd** whenever you want to run the source copy. Keep the project and its `node_modules` folder together. That launcher does not install dependencies for you.

## 4. Connect your model

1. Open **Settings & connection** in Aurora.
2. Choose OpenAI, Claude / Anthropic, OpenRouter, Ollama Cloud or Local Ollama. For cloud providers, create a key through that provider's API account. API billing can be separate from a chat website subscription.
3. Paste it into the app’s API key field. Never paste it into source files, documentation or a public issue.
4. Click **Load models**, select a model that supports tool calls, and save.
5. Send a simple chat message to check the connection.
6. Select **Choose workspace** before asking for project file operations. A project can remember its own workspace folder.

For Local Ollama, install [Ollama](https://ollama.com/download/windows), start it and install a tool-capable model. Keep the default `http://127.0.0.1:11434` address unless the local server uses another port. Only loopback addresses are accepted, and no API key is required. Performance depends on your hardware and model size.

Each provider keeps a separate model and encrypted key. OpenRouter discovery lists models advertising tools; other lists can include models unsuitable for agent actions. Choosing a model without tool support can prevent desktop actions even when chat works.

Web search uses a saved Ollama Cloud key independently of the selected model. Save that connection once, then switch back to your preferred provider. Without it, the web-search tool is unavailable; local file and desktop tools remain available. Cloud voice and web search still use their own services when your model runs locally.

Open **Appearance** to select Classic, Moonlight, Sunrise or Mint. These colour palettes reuse every animation across chat, notch and desktop.

## 5. Set up computer control

In **Settings & connection**, make sure **Allow Aurora to use my mouse and keyboard** is enabled.

Install or open a supported browser: **Opera, Brave, Chrome, Edge or Firefox**. For example, ask “Open Brave and go to YouTube.” Aurora restores an existing window when possible and uses observed page controls for subsequent actions. Avoid moving the mouse or switching applications during an action. Elevated/admin windows and inaccessible controls may not be controllable.

To stop, use the app’s **Stop** button, **Ctrl+Alt+Escape**, or move the pointer into the primary display’s top-left corner. With voice active, “stop task” also cancels work between spoken replies. Completed changes remain.

## 6. Set up voice, if wanted

1. Configure your model connection first.
2. Open **Voice & wake word**.
3. Choose **ElevenLabs** or **Fish Audio** and enter your own provider key.
4. For ElevenLabs, select a voice ID; **Load voices** can list the voices available to your key. For Fish Audio, enter a voice reference ID and choose a supported Fish model.
5. Choose **Cloud · selected voice provider** for cloud recognition. Enter `en` for English, another supported two-letter language code, or `auto`.
6. Save, then explicitly enable listening. Windows may require microphone access in **Settings → Privacy & security → Microphone**, including access for desktop apps.
7. Say “Aurora,” wait for her greeting, then say your request. If she asks a question, answer normally without repeating her name.

The provider key needs API permission and credit for both speech recognition and speech output. A website subscription or a valid key does not guarantee access to every API endpoint. A `402` response is a provider billing/access problem, not a reason to paste credentials into a support issue.

For local recognition, choose **Windows dictation** and an installed Windows speech recognizer. If none is available, install the matching Windows speech language through Windows language settings. Recognition accuracy varies; cloud recognition is a separate option with different data handling and usage charges.

Listening starts off on every launch. “Go to sleep” returns to wake-word listening; “stop listening” turns the microphone off. While waiting for its wake word, the minimized notch stays hidden. It appears when Aurora wakes and handles the conversation without restoring the main app.

## 7. Build a Windows executable

From an installed source checkout:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run pack
```

The unpacked application is at:

```text
dist\win-unpacked\Heartflow Aurora.exe
```

Run that executable while keeping **all** the neighbouring files and folders beside it, including `resources`. Copying only the `.exe` will break the app.

To build the recommended per-user Windows installer:

```powershell
npm.cmd run dist
```

Find the versioned Setup executable in `dist`, along with `latest.yml` and its `.blockmap`. Build scripts never publish automatically. See [release workflow](RELEASES.md) for publishing update assets.

For a portable executable instead, use `npm.cmd run dist:portable`. Portable and unpacked copies use manual updates. All packaged formats include the runtime; their users do not need Node.js or npm.

If maintainers later provide a packaged release, download it from this repository’s **Releases** page. A source ZIP from **Code** requires the source setup steps above. Builds are currently unsigned; use a build from a source you trust and follow your organization’s Windows application policy. Do not disable Windows security protections to run it.

## 8. Add a desktop shortcut or share with another Windows user

For an unpacked build, right-click `Heartflow Aurora.exe`, select **Show more options → Send to → Desktop (create shortcut)** where available. Keep the application folder in place. Moving it afterward requires updating the shortcut.

For another Windows account, preferably run the installer while signed in as that user. It creates their shortcut and enables later updates. For an unpacked copy, copy the **entire** `win-unpacked` folder into a folder that account can read, then create its shortcut to the copied executable. Do not copy your Aurora settings, chats, provider keys or Windows profile data. The other user enters their own keys; each account has separate local settings.

For a portable build, share the generated portable executable rather than your development folder. The portable launcher must be allowed to extract and run its bundled components under the destination account.

## 9. Update or remove

Installed copies quietly check shortly after opening. A circular download button appears when a published release has a higher version. Open it or **Updates**, download, then choose **Restart and update** after work and active voice conversations finish. Downloads and restarts are explicit choices. Chats and settings remain in the same userData directory.

Existing portable users must install their first installer manually. For source, portable and unpacked copies, close Aurora before replacing files and repeat the corresponding setup. Run `npm.cmd ci` after source lockfile changes. Close old copies before opening a new version.

To remove an installed copy, use Windows **Settings → Apps → Installed apps**. Uninstalling preserves local user data.

To remove an unpacked build, close it and delete its application folder and shortcut. Local user data remains separately. It is normally stored at `%APPDATA%\Heartflow Aurora\aurora.json`; source/development launchers can use a different Electron userData name. Delete only the Aurora data directory if you also want to erase that account’s saved chats and settings. Back up anything you want to keep first.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `node` or `npm` is not recognized | Install Node.js with npm and PATH support, then reopen Terminal. |
| PowerShell blocks `npm.ps1` | Use the documented `npm.cmd` commands; no machine-wide execution-policy change is needed. |
| Install fails while downloading Electron | Check network/proxy access and available disk space. Retry `npm.cmd ci`; do not delete or regenerate the lockfile to conceal an error. |
| Missing Electron/dependencies | Run `npm.cmd ci` in the folder containing `package.json`. |
| Browser cannot be found | Install a supported browser normally, or open it first so Aurora can reuse its window. |
| Computer controls cannot start after copying | Use a current build and copy its full folder, including native resources. Current helpers support hidden deployment files. |
| Click stops or a window cannot be focused | Leave the foreground window and pointer undisturbed. Close old Aurora copies and keep the target app at normal user privilege. |
| YouTube opens but the song does not play | Read the tool result; player layouts, overlays, consent screens, ads and accessibility can affect clicks. An opened page is not proof of playback. |
| Pink pointer is missing or inconsistent | Close older Aurora builds. The custom pointer is temporary and restores during idle, stop or shutdown. Pointer-display failure should not prevent the browser action itself. |
| No microphone transcription | Check desktop microphone permission, selected input device, provider recognition access and language settings. |
| API returns `401`, `402` or `403` | Check the relevant provider key, account access and API billing. Do not publish the key or full settings file. |
| Aurora answers but does not call tools | Select a model with tool support and review its tool activity. |

For help, report the build version, Windows version, browser, reproduction steps and the specific error after redacting personal paths and data. Do not attach `aurora.json`, API keys, real recordings or complete private conversations to a public issue.
