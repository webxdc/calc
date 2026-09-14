# Changelog

All notable changes to this project are documented in this file.

The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

[Unreleased]

### Fixed

- sync errors: changes were not shared with other peers

- language conflicts: different local settings caused broken number format and formulas

### Feature

- export current workbook as xlsx file

- import xlsx files into current workbook (adds all sheets from imported file)

### Tooling

- add playwright tests `pnpm test`

### Build

- upgrade to IronCalc 0.8.3 (xlsx package)

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
