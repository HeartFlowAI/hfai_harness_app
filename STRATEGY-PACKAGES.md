# Local strategy package inspection

Adapter prepared for public draft review; runtime acceptance remains pending.

The main window has an **Inspect strategy package** action. It opens the host's JSON file picker after current agent/presentation work finishes. The sandboxed renderer supplies no file path to the IPC handler. Existing main-window/main-frame sender checks guard the new narrow channel. A separate dialog shows the validated package summary as plain text; it is not saved in sessions, inserted into model context or interpreted as Markdown/HTML. Closing clears the view.

The vendored workspace-owned reader checks the v1 data-only schema, capabilities, spec/rule/hash consistency and reads at most 128 KB from an explicitly selected regular local file. It does not execute package content, call a model, access trading records or authorize activation/signing. A valid hash is not trusted authorship, runtime verification or profitability.

Reader source base and bundle hash are in src/companion/provenance.json. The app's existing src/**/* packaging rule includes the reader. Refresh the generated copy from the same reviewed source as the TUI; do not hand-edit it.

Node syntax checks passed for main/preload/renderer/reader. No tests, native/UI launch, file inspection, Electron packaging, sender/invalid-file behavior, runtime recovery or Mac verification ran. Existing harness Windows assumptions remain. No harness code was extracted into the workspace; no repository-wide license was changed. Founder authorized public draft publication. READER-LICENSE.txt licenses the shared reader under MIT; it does not license the rest of the harness. Owner: requesting founder; reviewer: other founder, names not recorded.

