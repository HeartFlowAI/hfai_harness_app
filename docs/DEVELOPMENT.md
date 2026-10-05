# Development and verification

## Source setup

Follow [installation](INSTALLATION.md), including `npm.cmd ci`. Runtime renderer libraries are already bundled under `src/vendor` with their notices. Run `npm.cmd run vendor` if you intentionally update the corresponding dependencies; review and commit the changed bundle and lockfile together.

```powershell
npm.cmd start
npm.cmd test
npm.cmd run check
npm.cmd run pack
npm.cmd run dist
```

`npm.cmd run pack` creates `dist/win-unpacked`. `npm.cmd run dist` creates the Windows NSIS installer in `dist`. Use `npm.cmd run dist:portable` for a portable executable. Native PowerShell and C# helpers must remain included in `resources/app.asar.unpacked/src/native`. The packaged app uses its own Electron runtime; no Python or global Electron installation is required.

The animation preview is available with `npm.cmd run animations` or `Preview Aurora Animations.cmd`. `scripts/build-icon.js` regenerates icon sizes from the supplied master and is run with the local Electron executable.

## Checks

The unit suite covers stream parsing, tool validation, path restrictions, cancellation, recording completion, spoken choices and approvals, session storage, browser readiness and music sign-off guards. `npm.cmd run check` checks JavaScript syntax. These are necessary source checks; neither guarantees success with a live model, microphone or website.

The integration scripts create isolated profiles and fixtures under ignored `test-output/`. Most replace cloud services with test responses and do not make paid provider calls. Review a script before running it. **Run foreground GUI tests one at a time and leave input undisturbed.** Tests can move the real mouse, use the keyboard or open a fixture window.

Examples from PowerShell:

```powershell
& .\node_modules\.bin\electron.cmd scripts\question-smoke.js --smoke-test
& .\node_modules\.bin\electron.cmd scripts\voice-smoke.js --smoke-test
& .\node_modules\.bin\electron.cmd scripts\emotion-smoke.js --smoke-test
& .\node_modules\.bin\electron.cmd scripts\library-smoke.js --smoke-test
node scripts\deployment-smoke.js
node scripts\cursor-smoke.js
node scripts\computer-smoke.js
```

- `question-smoke.js`: inline questions, typed and clickable answers, waiting before work, cancellation and no focus stealing.
- `voice-smoke.js`: simulated recognition and speech-provider responses through actual Electron UI and audio playback.
- `emotion-smoke.js`: simulated Fish request cues, clean visible text, brief character reactions and minimized music sleep/wake.
- `library-smoke.js`: modes, projects, session search, deletion and persistence.
- `deployment-smoke.js`: hidden native sources, desktop helper startup, cursor startup and local speech probe; no microphone recording.
- `cursor-smoke.js`: temporary real Windows cursor replacement and exact restoration on idle, stop and parent exit.
- `computer-smoke.js`: real input against an isolated WinForms fixture. Use Electron with `--overlay` to include its display, for example `& .\node_modules\.bin\electron.cmd scripts\computer-smoke.js --overlay`.

Other scripts cover file presentation, notch visibility, character handoff, recording and animation. Inspect their headers for their scope. Some file tests open Explorer; browser tests launch a dedicated private window. Do not run tests against an unrelated person’s logged-in session.

For a Brave browser fixture:

```powershell
$env:AURORA_TEST_BROWSER = 'brave'
node scripts\opera-smoke.js
Remove-Item Env:\AURORA_TEST_BROWSER
```

The script retains its historical filename and supports Opera or Brave. `--youtube` additionally checks readable public YouTube controls. `--youtube-play` attempts a specific observed official-video link with test audio muted. Those optional checks use the live website, whose consent screens, ads and layout can vary; they are not deterministic CI tests.

Set `AURORA_SMOKE_SOURCE` to a packaged app’s `resources/app.asar/src` only for scripts run with Electron. Native-only checks can point to `resources/app.asar.unpacked/src`. Do not commit absolute paths used on your own computer.

## Repository hygiene

Commit source, lockfiles, tests, documentation, required assets and third-party notices. Do not commit dependency folders, builds, local settings, recordings, screenshots, credentials or test-output profiles. See [data handling](PRIVACY.md).

A public-source copy should be exported from explicitly reviewed tracked files and initialized with fresh history if prior history contains personal attribution or data. Renaming a repository or deleting a file in the latest commit does not remove earlier commits. Keep publication preparation separate from the working app and the original private repository.

No automatic release publishing is configured. Build and review the intended artifact before adding it to GitHub Releases; never attach a local userData folder.
## Dependency audit status

The 0.2.0 dependency refresh and non-forced audit fix resolved the previous `http-cache-semantics` report. The current full `npm.cmd audit` reports zero findings. This checks published dependency advisories; it is not a security certification of the app or embedded runtime. Repeat it before release.

The embedded Electron runtime and vendored renderer libraries originate from development dependencies. Review both the full audit and production dependency audit.

```powershell
npm.cmd audit
npm.cmd audit --omit=dev
```

## Versions and build storage

See [release workflow](RELEASES.md). Develop with `npm.cmd start`; package milestones rather than every edit. `dist` is the fixed output location. Keep a current build and one rollback copy only when needed. Git retains source history without duplicating the runtime.

`npm.cmd run clean:builds` previews redundant legacy `dist-aurora-v*` folders. After reviewing, `npm.cmd run clean:builds -- --apply` removes eligible older folders, preserving the newest two, running apps, desktop shortcut targets, `dist`, dependencies, test output and publication checkout. Failed reference checks abort cleanup.

For migration, settings and colour palettes, run:

```powershell
& .\node_modules\.bin\electron.cmd scripts\settings-smoke.js --smoke-test
```

This isolated fixture uses fake encrypted credentials and simulated model/speech replies. Provider adapter tests use synthetic streams; account-specific API access still needs a live credential check. Updater tests simulate discovery and downloads; a real installed-version upgrade requires published release assets.

## Shutdown and instance checks

```powershell
node scripts/lifecycle-smoke.js
```

This runner launches separate Electron processes sharing one isolated profile. It verifies duplicate rejection, restoration of a minimized window, shutdown with hidden overlays/companion windows and an active synthetic task, saved conversation data, and reopening after the lock is released. It repeats three cycles and a final fresh launch. The cursor and computer helpers are fixtures; no live microphone, cloud or physical mouse input is used.

Normal launches allow one primary Aurora per Windows user/profile. Closing the main window quits the whole app; minimizing keeps it alive for voice use. `--smoke-test` normally isolates fixture instances; `--single-instance-smoke` enables the real lock for this specific test. Keep these flags out of production shortcuts.

## Animation verification

Run `node_modules/.bin/electron.cmd scripts/animation-audit.js` to inspect every activity pose, clean alpha and both pointing directions in the real shared renderer. It writes contact sheets and a report under `test-output/animation-audit-*`. The `pointing-check.png` preview places a mock selected file beside each actual rendered fingertip. This check does not use the physical mouse or Explorer.
