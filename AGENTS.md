# Agent Development Guide

A file for [guiding coding agents](https://agents.md/).

## Commands

- See [package.json scripts](./package.json) for commands.

## Architecture

- **Monorepo** using pnpm workspaces:
  - `packages/ruta-core`
  - `packages/ruta-vue`
  - `packages/ruta-svelte`
- `ruta-core`: Framework-agnostic router with `Ruta` class, route builder, vite plugin
- `ruta-vue`/`ruta-svelte`: Framework-specific integrations
- `playgrounds/`: Example apps for Vue and Svelte

## Code Style

- Standard JavaScript/TypeScript code style:
  - `camelCase` for variables, functions.
  - `PascalCase` for classes, types, interfaces.
  - `kebab-case` for filenames.
- **ESM only** (`"type": "module"`).
- Use `#` private fields for class internals.
- Prefix generic type parameters with `T`.
- Prefix internal type-only properties with `~` (e.g., `'~routes'`).
- Use `@ts-expect-error` sparingly with explanation.
- Imports: named imports from local `.ts` files with explicit `.ts` extension.
- Type exports: use `export type` for type-only exports.
- Make sure all exported APIs in `mod.ts` have JSDoc and either `@private` or `@public` tag.
- Warning or assertion messages should be all lowercase with a full stop except when referring to
  identifiers, the case should be matched with the code.
- Hard limit comment line length at 80.
- Keep one linebreak between the fields in the TypeScript types or interfaces if they are
  documented.

Below rules are inspired by or taken from
[TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md)

- Always add assertions that catch real bugs, avoid asserting trivial codes.

- Get the nouns and verbs just right. Great names are the essence of great code, they capture what a
  thing is or does, and provide a crisp, intuitive mental model. They show that you understand the
  domain. Take time to find the perfect name, to find nouns and verbs that work together, so that
  the whole is greater than the sum of its parts.

- Comments are sentences, with a space after the slash, with a capital letter and a full stop, or a
  colon if they relate to something that follows. Comments are well-written prose describing the
  code, not just scribblings in the margin. Comments after the end of a line can be phrases, with no
  punctuation.

- Explain why the code is written like this, not what it does. Code alone is not documentation.

- Use proper capitalization for acronyms.

- Add units or qualifiers to variable names, and put the units or qualifiers last, sorted by
  descending significance, so that the variable starts with the most significant word, and ends with
  the least significant word. For example, latency_ms_max rather than max_latency_ms. This will then
  line up nicely when latency_ms_min is added, as well as group all variables that relate to
  latency.

- Don't forget to say how. For example, when writing a test, think of writing a description at the
  top to explain the goal and methodology of the test, to help your reader get up to speed, or to
  skip over sections, without forcing them to dive in.
