# Saider Theme Builder

[![CI](https://github.com/nzkdevsaider/saider-theme-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/nzkdevsaider/saider-theme-builder/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/nzkdevsaider/saider-theme-builder?include_prereleases)](https://github.com/nzkdevsaider/saider-theme-builder/releases)
![Figma plugin](https://img.shields.io/badge/Figma-plugin-F24E1E?logo=figma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-10-673AB8?logo=preact&logoColor=white)
![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)

A Figma plugin that gives every project a **primitive system** and manages **themes** that only point to those primitives.

# Features

- **One system per project.** Installs a `Saider / <System>` collection with all the primitives. Themes are bound to it.
- **Themes as collections.** Each theme is a `Theme / <name>` collection with one mode and 26 variables, all aliases to primitives. Works on the free plan.
- **Saider format.** Flat, portable JSON to import and export themes.
- **Doctor.** Detects and repairs anomalies: missing tokens, drifted names, loose values, broken or external aliases, scopes, modes, format versions and contrast.

## Saider format (v1)

```json
{
  "$saider": 1,
  "name": "ocean",
  "system": "tailwind",
  "base-100": "white",
  "base-200": "slate-50",
  "base-300": "slate-200",
  "base-content": "slate-900",
  "primary": "sky-700",
  "primary-content": "white",
  "radius-field": "lg",
  "size-field": "1",
  "border": "px"
}
```

## Development

```bash
bun install
bun run dev        # build in watch mode
bun test           # core and repository tests (with a Figma test double)
bun run check      # typecheck + tests + build
bun run harness    # the UI running in the browser, without Figma
```