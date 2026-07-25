# haxball_headless_v9

Haxball headless bot, written in TypeScript, compiled with `tsc`, bundled with `esbuild`.

## Setup

```bash
npm install
```

This installs `typescript` and `esbuild` as dev dependencies.

## Project structure

```
src/
  main.ts        # entry point
  room.ts        # creates the room via HBInit
  state.ts       # shared bot state
  events.ts      # room.onX event handlers
  util.ts        # helper functions
  ...             # other feature modules
  globals.d.ts    # ambient declaration for HBInit (provided by the host at runtime)
tsconfig.json
package.json
```

`HBInit` isn't a real import — it's injected by the Haxball headless host environment
when the bundle runs. `src/globals.d.ts` just tells TypeScript it exists so type-checking
doesn't complain; you never import it yourself.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run typecheck` | Type-checks the whole project, no output files. Fast way to catch errors while coding. |
| `npm run build` | Compiles `src/**/*.ts` → `dist/**/*.js` with `tsc` (one output file per input file, CommonJS). Used for running the bot with Node (`npm start`). |
| `npm run bundle` | Uses `esbuild` to bundle `src/main.ts` and everything it imports into a single `dist/bundle.js`, ready to drop into a browser/host environment via `HBInit`. |
| `npm run bundle:min` | Same as `bundle`, but minified → `dist/bundle.min.js`. |
| `npm run bundle:all` | Runs `bundle` and `bundle:min` together. |
| `npm run build:all` | Runs `typecheck` → `build` → `bundle` in sequence. Fails fast if type-checking fails. |
| `npm start` | Runs the compiled bot with Node (`node dist/main.js`). |

## Typical workflow

- While actively coding: run `npm run typecheck` (or let your editor do it live) to catch type errors early.
- To produce the file you actually deploy/paste into the Haxball headless host: `npm run bundle` (or `bundle:min` for a smaller file).
- Before shipping / opening a PR: `npm run build:all` to make sure everything type-checks and both build paths still work.

## Notes

- `tsc` output (`dist/*.js`, CommonJS) and the `esbuild` bundle (`dist/bundle.js`) are two
  different things — `tsc`'s output is for running locally with Node, the bundle is the
  single-file artifact for the host environment. You may not need both depending on how
  you deploy.
- `dist/` is gitignored — it's always regenerated from `src/`, never edited by hand.
- If you're pairing on this live, VS Code's **Live Share** extension works well for
  real-time co-editing.
