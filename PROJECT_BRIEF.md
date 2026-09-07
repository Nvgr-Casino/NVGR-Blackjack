# Table Stakes 3D — Project Brief

## Goal
Rebuild the **visual/rendering layer only** of the existing "Table Stakes" blackjack
web app using **Three.js**, so the table, cards, and dealing use real 3D geometry,
lighting, and camera movement instead of the current CSS-based 2D approximation.

This is a rendering-layer rebuild, not a full app rewrite. The multiplayer logic,
accounts, and backend already work and should be reused as-is.

## What already exists and works — don't rebuild these
See the attached `index.html` for the full reference implementation:
- Complete blackjack rules engine: deck/shuffle, hit/stand/double/split, dealer
  auto-play (hits to 17), payouts including blackjack 3:2, push handling
- Firebase Authentication (Google sign-in + email/password)
- Firebase Realtime Database for live multiplayer sync (rooms, player accounts,
  chip balances, chat) — project id `table-stakes-blackjack`, free Spark tier
- Public table lobby/matchmaking (auto-join open tables, spill over to a new
  table when full), private tables with a host and invite code
- Betting timer with a 3-strike "missed bet" removal rule
- Per-table chat
- Live at: https://nvgr-casino.github.io/NVGR-Blackjack/
- GitHub: https://github.com/Nvgr-Casino/NVGR-Blackjack

The `dealRoundCards`, `resolveDealerAndPayouts`, `handValue`, `advanceTurnIn`, etc.
functions in `index.html` are the source of truth for game rules — port or reuse
them directly rather than re-deriving blackjack logic from scratch.

## What to rebuild
Replace the 2D CSS felt table / card / chip UI with a real Three.js 3D scene:
- A 3D table with a felt surface and rim
- 3D card meshes that slide and flip into place when dealt (real transforms in
  3D space, not CSS keyframes)
- Camera movement — a push-in/zoom feel when cards are dealt, maybe a slight
  orbit or tilt for atmosphere
- Optional stretch goal: a simple dealer hand/arm model that appears to deal
  each card
- Same underlying game state drives everything — the room's `phase`, `hands`,
  `dealer.hand` data already tell you exactly what to draw and when

## Suggested tech stack
- **Three.js**, or **React Three Fiber** if a component-based approach is
  preferred
- **Vite** as the dev server/bundler
- Keep the Firebase SDK calls (auth + Realtime Database) exactly as they are
  in the reference file — only the rendering layer changes

## Asset sourcing — this part is on you, no AI tool can generate real 3D assets
- [Kenney.nl](https://kenney.nl) — free, CC0 game asset packs; some are made
  specifically for card/casino games
- [Sketchfab](https://sketchfab.com) — filter by downloadable + free/CC license
  for table, chip, or hand models
- [Mixamo](https://www.mixamo.com) — free rigged hand/arm animations, useful
  if you want an animated dealer hand
- A stylized low-poly table-and-cards scene is a reasonable, much more
  achievable target than a photorealistic dealer character — it can still
  look and feel like real 3D without needing a rigged human model

## Suggested build order
1. Get a static Three.js scene rendering: a table plane + a few example 3D
   cards, no game logic wired in yet
2. Build one working "deal" animation for a single card — slide + flip in 3D
   space, camera push-in on trigger
3. Position multiple cards/hands around the table (dealer + up to 5 seats)
4. Wire the scene up to real Firebase data — reuse the existing game-logic
   functions from `index.html` unchanged
5. Polish: dealer hand model, ambient lighting/shadows, idle animations

## Notes
- Firebase security rules are currently fully open (no auth-based restriction)
  since there's no server-side validation layer — worth revisiting if this
  grows and cheating becomes a concern
- Keep the existing account/chip-balance system (`accounts/{uid}` in Realtime
  Database) untouched; it's keyed by Firebase Auth UID and works correctly
