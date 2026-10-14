# AGENTS.md

## Project

Pac-Man clone built for learning **spec-driven development** (Spanish-language repo: README, UI strings, and specs are in Spanish). Vanilla JS + Canvas, no frameworks, no build step, no package manager.

## Running and verifying

No build/test/lint tooling exists — do not invent commands. Verify by serving `src/` and playing in the browser:

```
npx serve src        # or any static server, or open src/index.html directly
```

There is no automated test suite; changes are validated manually against the game behavior.

## Architecture constraint: globals, not modules

`src/index.html` loads plain (non-module) scripts in this exact order:

`maze.js` → `game.js` → `render.js` → `main.js`

There is no bundler or ES module system. Files communicate through globals:

- `maze.js` defines the board data
- `game.js` defines `createGame()` and `update(game)` (game state/logic)
- `render.js` defines `draw(ctx, game, frame)`
- `main.js` binds the DOM, keyboard input, and the `requestAnimationFrame` loop

A new script file is dead code unless you also add the `<script>` tag in `src/index.html`, after its dependencies. Don't switch to `type="module"` — that would break the current global wiring.

## Spec-driven workflow (the core of this repo)

Features are developed via the repo-local skills, not ad-hoc coding:

- `/spec <description>` (skill in `.agents/skills/spec/`) designs a spec and saves it to `specs/NN-slug.md` (zero-padded number + kebab-case slug)
- `/spec-impl <NN-slug>` (skill in `.agents/skills/spec-impl/`) implements it, creating branch `spec-NN-slug`
- Spec state machine: `Draft` → `Approved` (only the human approves) → `Implemented`
- Only implement specs whose state means "Approved" (e.g. `Aprobado`); never auto-approve
- With `specs/.spec-config.yml` absent or `AutoCreateBranch: true`, `/spec-impl` creates the branch automatically; `false` makes it ask first
- Match the language and section wording of any existing specs in `specs/`
