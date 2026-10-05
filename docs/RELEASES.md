# Versions, builds and updates

Aurora's app version comes from `package.json`, not a directory label. Use `0.2.0` for a feature milestone and `0.2.1` for its fixes. Reserve a major version change for incompatible behaviour. Record changes in [CHANGELOG.md](../CHANGELOG.md).

## Local work

Develop from source with `npm.cmd start`. Keep changes and local commits in Git. Run tests and syntax checks before packaging. Build output and dependencies are ignored by Git; they are not source history. All packaging scripts use `--publish never`.

Do not push source, tags or releases until the project owner explicitly requests it. An ordinary source push does not notify installed apps or publish an update. Publishing a source commit and publishing an installer release are separate actions.

For a public copy, review tracked changes for credentials, private paths, real conversations and personal attribution. Keep updates on the existing sanitized public history; do not replace it with an original private repository's history. The clean publication checkout must not be removed during test-output cleanup.

## Prepare a release locally

1. Update the version and changelog, then synchronize the lockfile with `npm.cmd install --package-lock-only --ignore-scripts`.
2. Run `npm.cmd test`, `npm.cmd run check`, the relevant isolated Electron fixtures and `npm.cmd audit`.
3. Run `npm.cmd run dist`. The target is a Windows x64 NSIS installer. No GitHub credentials are needed to build.
4. Run `npm.cmd run verify:release` to check `dist/Heartflow-Aurora-Setup-<version>.exe`, its `.blockmap`, `dist/latest.yml` and the packaged update destination. Preserve exact generated filenames; the metadata references them and includes integrity information.
5. Test the installer on an isolated Windows user/profile. Verify existing settings, native helpers, launch shortcut and removal behaviour. Builds are currently unsigned. Signing credentials belong in a private release environment, never in source or packaged settings.

## Publish only when requested

After authorization, push reviewed source and create the matching `v<version>` tag on the sanitized repository. Publish a GitHub Release in `HeartFlowAI/hfai_harness_app` with its changelog and the installer, `.blockmap` and `latest.yml` from the same build. Do not upload `builder-effective-config.yaml`, an unpacked folder, test profiles, local settings or credentials. Keep a release as a draft until all assets are attached and reviewed. Pre-releases are not offered by the stable updater.

The installed app checks this public release feed after startup. No maintainer GitHub token is included in the app. The user explicitly downloads and chooses to restart. Updates are blocked while a task, presentation, spoken reply or active voice conversation is underway. Downloads fail without replacing the running version. The existing userData directory is preserved.

An end-to-end updater validation needs two installed version numbers and release assets: install the older version in a test account, publish the newer approved release, check the button, download, restart and verify the version, stored data and computer tools. Until that has been performed, unit tests and successful packaging alone do not prove a live update works.

## Rollback and disk use

Keep only the newest build and one rollback copy locally. Do not create another numbered folder for every small edit. `npm.cmd run clean:builds` safely previews redundant legacy workspace builds; use its documented `--apply` option to remove reviewed candidates. It preserves the publication checkout and does not clean other Windows users' desktops.

If a published update has a problem, release a corrected build with a higher version. The stable updater does not downgrade. A manual rollback requires closing Aurora and installing a previous trusted installer; back up needed user data before any incompatible data migration. Never delete saved chats as part of build cleanup.
