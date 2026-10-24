# Changelog

All notable changes to this project are documented in this file.

The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.1] - 2026-10-24

### Fixed

- Sync errors: in some cases edits were not shared with other peers or incoming
  changes were lost

- Language conflicts: peers with different locale settings got broken number
  formats and formulas. The workbook locale is now always English.

### Removed

- The locale settings panel, since the locale is now fixed.

- Copy/paste entries in the context menu, which did not work.

## [1.1.0] - 2026-07-10

### Fixed

- A bug where simultaneously editing in multiple instances of Calc causes the focus to
  be lost as well as text input to be lost.

- `pnpm dev` was not properly showing the calc, fix by including a webxdc mock.
 
### Tooling

- Webxdc-dev integrated in `package.json`.

- In vite dev mode we now get logging of what is sent through webxdc.

- Playwright tests that demonstrate the editor focus/text loss bug (which now pass).

### Code structure

- Vendor an unreleased version of IronCalc. This is required to fix the bug until
  we can get a new IronCalc release with our fix in. It's based on this PR:
  https://github.com/ironcalc/IronCalc/pull/1146.

- Sync our UI code with the later version from IronCalc (which we copy and tweak).
  Remove some dead code files copied over from IronCalc but which we were not using.

## [1.0.0] - 2025-06-24

Initial public release.
