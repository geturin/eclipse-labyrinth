# Eclipse Labyrinth — repository instructions

## Scope and invariants

This is geturin's **private** browser DRPG. Do not change visibility, publish GitHub Pages,
add telemetry, introduce a backend, or copy franchise assets without a separate request.
Keep the original anime-inspired art, first-person grid exploration, 1–3 selectable jobs,
five floors, fresh roguelike runs, and **one weapon slot / one fixed effect per weapon**.
A consumable is not equipment. Do not add permanent combat power between runs.

## Every change must ship its static page

1. Read the current branch, relevant source and tests; preserve unrelated changes.
2. Update focused unit / integration tests with the requested behavior.
3. Run `npm test` and `npm run build`. No dependency install is needed.
4. Run `npm run verify:dist`. It must report byte-for-byte agreement.
5. Include **`dist/index.html` in the same feature commit/PR as the source changes**.
6. Push without force, check GitHub CI and verify the remote artifact. Never claim a push,
   passing CI, or deployment before verifying it. A private repo is not an online website.

`.github/workflows/static-build.yml` checks tests/builds on PRs and rejects stale static
HTML. On branch pushes it also repairs a stale static page with a separate bot commit;
that is a safety net, not a substitute for step 5. Concurrent pushes fail safely.

## Code boundaries

- `src/data.js`: jobs, skills, evolutions, enemy formations, boss triggers, weapon effects.
- `src/rng.js`: deterministic, serializable random generator.
- `src/world.js`: grid generation, regional landmarks, pack movement and perception.
- `src/engine.js`: pure serializable game state, combat, rewards, saving.
- `src/app.js`: DOM and controls; `src/renderer.js`: cosmetic raycasting only.
- `src/art.js` and `src/audio.js`: original procedural assets, no external requests.
- `src/sprite-art.js`: fixed-size exploration SVGs and raster cache.
- `src/sprite-scene.js`: pure cosmetic placement, occlusion spans and marker layout.
  Never slice source SVGs per ray column. Exploration changes must run
  `npm run test:render` and the pixel suite `python tests/render_browser.py`.
- `scripts/build.mjs`: deterministic closed-world ESM bundler.

Do not advance RNG or world time from rendering/timers. Only successful movement/waiting
and completed combat rounds move enemies. Reinforcements act **next round**, never
immediately. Keep a full visible player-response window for boss omens, and preserve
pending omens / learned arts / pack identity through saves. Invalid commands must not
consume resources or RNG. Controls cannot infinitely refresh the same seal.

## Tests and compatibility

`npm test`: deterministic Node tests; includes 750 map-connectivity cases.
`npm run balance`: isolated fixed-policy diagnostic, **not** human win-rate data.
`python tests/browser_smoke.py`: optional Python Playwright + Chromium UI suite.
Set `CHROMIUM_PATH` when Chromium is elsewhere. Browser suite uses in-memory Storage;
do not call that native-storage or Safari verification. Its screenshots are generated
locally. Read `docs/QA.md` for exactly what has been measured.

v0.2 uses `eclipse-labyrinth.run.v2`. v0.1 saves remain untouched but are not migrated.
Do not promise all party combinations/seeds can win; record balance changes in
`CHANGELOG.md`. Keep user-facing documentation in Chinese.
