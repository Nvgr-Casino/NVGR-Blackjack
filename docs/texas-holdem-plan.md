# Texas Hold'em for NVGR Casino — research and plan

Status: research only. Nothing here is built or deployed.

---

## 1. The one thing that decides everything: hidden cards need a trusted dealer

Blackjack works today with no server at all. Every player's browser runs the
game rules itself and writes the result into the room in Firebase
(`runTransaction` on `rooms/{code}` in `src/app/session.js`), and the database
rules let **any signed-in player read an entire room**
(`firebase-database.rules.json`: `"rooms": { "$code": { ".read": "auth != null" } }`).

That is survivable for blackjack because nearly every card is face up. Poker
is the opposite: the game *is* the hidden cards. If hole cards or the deck
live anywhere a player's browser can read, anyone who opens the browser's
developer tools sees every opponent's hand and the next river card. And if
the browser deals, the browser can choose the cards.

Firebase rules can't fix this on their own. A rule that lets you read a room
lets you read everything under it, and something still has to shuffle and
deal that no player controls.

**So poker needs a small authoritative server** — the "dealer" — that holds
the deck, sends each player only their own two cards, checks every action
against the rules, and runs the timers.

> Side finding: the same weakness exists in blackjack now. The shoe of
> upcoming cards (`room.deck`) is readable by every player. With play money
> it's harmless, but once a server exists for poker, blackjack can move onto
> it too.

### Options for that server

| | Cloudflare Workers + Durable Objects | Firebase Cloud Functions | Keep everything in the browser |
|---|---|---|---|
| Cost | **Free plan** includes Durable Objects since April 2025 (SQLite-backed, daily free limits) | Needs the **Blaze** pay-as-you-go plan: Cloud Functions can't be deployed on the free Spark plan. Blaze has a no-cost quota, then bills — needs a card on file and a budget alert | Free |
| Fit for poker | Very good: one object per table holds the game in memory, players connect by WebSocket, built-in *alarms* run the turn clock | Workable: players write actions, a function validates and applies them. Adds a cold-start delay to actions, and turn timers need scheduled jobs | **Not viable** — every hole card would be readable |
| Effort | New piece of stack (Worker in `server/`); verifies the player's Firebase sign-in token; writes chip balances back to Firebase through its REST API with a service-account secret | Stays inside Firebase; same accounts and database | — |
| Latency | Low (persistent socket, state in memory) | Higher (database round trip + function per action) | — |

**Recommendation: Cloudflare Workers + Durable Objects.** It's free, it's
built for exactly this (one live object per table), and it keeps Firebase for
what Firebase already does well — sign-in, accounts and chip balances, the
lobby, friends, chat. Firebase Functions is the right choice instead only if
you'd rather stay in one ecosystem and are fine putting a card on the Blaze
plan.

### How the pieces talk (Cloudflare option)

```
Browser ──(Firebase sign-in)──► Firebase Auth ──► ID token
Browser ──WebSocket + ID token──► Worker ──► Durable Object "table K7QP"
                                              │  deck, hole cards, pot, clock
                                              │  sends each player: public state
                                              │  + only their own two cards
                                              └─► Firebase RTDB (REST, service
                                                  account): chip balances,
                                                  public lobby listing
```

- The deck is shuffled on the server with a cryptographic random source
  (`crypto.getRandomValues`), fresh 52 cards every hand.
- A player's hole cards are sent only on that player's socket. Opponents'
  cards are sent only at showdown, and only the hands that must be shown.
- The browser never decides anything; it sends intents ("raise to 600") and
  draws what the server says happened.

---

## 2. The rules (No-Limit Texas Hold'em, cash table)

Sources: the Poker TDA rules (current text is the 2026 version 1.1 — the
widely used international rulebook) and Robert's Rules of Poker for cash-game
points TDA doesn't cover. Rule numbers below are TDA 2026.

### Positions and blinds
- A **dealer button** marks the nominal dealer. The **small blind** is the
  first player to its left, the **big blind** the next.
- The button moves one seat left every hand. When seats are empty it moves
  so that no one skips or doubles a blind (TDA uses a *dead button* for
  tournaments, Rules 34 & 36-B; cash games usually move it simply to the next
  player — we'll keep it simple and fair: next active player, nobody posts
  the big blind twice running).
- **Heads-up** (two players): the button *is* the small blind, acts **first
  before the flop** and **last on every later street** (Rule 36-C).

### Dealing
1. Two hole cards to each player, one at a time, starting left of the button.
2. **Pre-flop** betting, starting with the player left of the big blind
   ("under the gun"). The big blind gets the **option** to raise if everyone
   only called.
3. Burn one, deal the **flop** (3 community cards). Betting.
4. Burn one, deal the **turn** (1 card). Betting.
5. Burn one, deal the **river** (1 card). Betting.
   — One burn card per street, never more (Rule 40).
6. **Showdown** if two or more players remain.

From the flop on, the first active player left of the button acts first.

### Betting (no-limit)
- Actions: **fold**, **check** (only if nothing to call), **call**, **bet**,
  **raise**, **all-in**.
- Minimum bet is one big blind.
- **Minimum raise:** at least the size of the largest previous full bet or
  raise of the round (Rule 45-A). Example: blinds 50/100, A raises to 300 (a
  raise of 200) → the next raise must be to at least 500.
- **No cap** on the number of raises (Rule 50). Maximum is everything in
  front of you.
- **Short all-in:** an all-in that's less than a full raise does **not**
  reopen the betting for players who have already acted — they may only call
  or fold (Rule 49-A). Several short all-ins together still don't reopen it.
- An unmatched part of a bet is returned to the bettor.

### All-in and side pots
- You can't be forced out of a hand for lack of chips: you're all-in for what
  you have, and you can win only what each opponent put in up to that amount.
- Each all-in creates a **side pot** layer above it. Example: A all-in 1,000,
  B and C each put in 3,000 → main pot 3,000 (A, B, C eligible), side pot
  4,000 (B, C only).
- When everyone left is all-in, all hands are turned face up and the
  remaining cards are dealt out (Rule 17).

### Showdown
- **Cards speak** (Rule 13): the best hand wins whatever anyone says.
- Each player makes the **best five-card hand from their two cards and the
  five on the board** — using both, one, or none of their own cards ("playing
  the board").
- Order: the **last player to bet or raise on the river shows first**; if the
  river was checked, the first player left of the button shows first
  (Rule 18-A). Online, the winning hand and any all-in hands are shown
  automatically; a losing player may **muck** (not show).
- **Split pots:** equal hands split the pot; an **odd chip** goes to the
  first winning seat left of the button (Rule 21).
- If everyone else folds, the last player wins without showing (and may
  choose to show).

### Hand rankings (high to low)
1. Royal flush — A K Q J 10 of one suit
2. Straight flush
3. Four of a kind
4. Full house
5. Flush
6. Straight (the ace plays high, A-K-Q-J-10, or low, 5-4-3-2-A)
7. Three of a kind
8. Two pair
9. One pair
10. High card

Ties are broken by the remaining cards (**kickers**). Suits never break ties.

### Cash-table house rules (Robert's Rules, adapted for online)
- **Table stakes:** you play only with the chips you sat down with; you can't
  add chips mid-hand. Chips come out of your account balance when you sit
  down and go back when you stand up.
- **Buy-in:** minimum 40 big blinds, maximum 100 (the common online range;
  live rooms often allow more). Optional auto top-up to the maximum between
  hands.
- **Joining:** a new player waits for the big blind, or posts one big blind to
  be dealt in at once; never dealt in between the big blind and the button.
- **Sitting out:** missed blinds are owed when you come back (post them, or
  wait for the big blind). Several missed rounds in a row and you're stood
  up — same spirit as blackjack's three missed bets.
- **Leaving and coming back:** returning to the same table within ~30 minutes
  you must buy in for at least what you left with (stops "hit and run").
- **Disconnection:** your time runs, then the server checks if it can, else
  folds. No "all-in protection" (modern sites removed it — it was abused).
- **No rake** — it's play money.

### Timing
- 20 seconds to act, plus a **time bank** of ~30 seconds per session that
  refills slowly per hand; a visible bar shows when the time bank kicks in.
- When time runs out: check if possible, otherwise fold.

---

## 3. The table and the room in 3D

### Real dimensions
- 9–10 seat poker tables: roughly **96–108 in × 44–48 in (2.4–2.7 m × 1.1–1.2 m)**,
  **30 in (0.76 m) high**, an oval/racetrack with a padded rail, a racetrack
  wood strip, cup holders, and a **dealer cutout** in the middle of one long
  side with a chip tray. A commonly sold 10-player table is 108 × 48 × 30 in
  with a dealer tray; 96 × 44 is "tight for 10 plus a dealer".
- Recommend **6-max** first (one dealer, six players): a ~2.2 × 1.1 m oval.
  It's the online standard, more action per player, and fits a phone screen
  far better than nine seats. 9-max can come later on the same code.

### What carries over from blackjack
- The salon, lighting, Poly Haven furniture, Rocketbox characters with their
  seated-at-table clip, the reach system for dealer and player hands, cards,
  chips, the HUD style, the crisp hand readout, the camera framework.

### What's new
- **Oval table** with the dealer at the middle of a long side and players all
  round it (blackjack's players are only on one side).
- **Community cards** in a row in the middle, burn cards to the dealer's
  side, the **pot** as chip stacks in the centre, each player's current bet in
  front of them.
- **Dealer button** puck that moves seat to seat; small/big blind markers.
- Hole cards: face down for opponents; you see yours (and peek at them).
- Dealer motion: in real poker the dealer *pitches* cards low across the
  felt to every seat (the far seats are out of reach), then **pushes the
  pot** to the winner.
- Seat camera: from your chair, the board in the middle of the frame and your
  own two cards close at the bottom.

### HUD
- Bottom dock: **Fold · Check/Call (amount) · Bet/Raise** with a slider and
  presets (min, ½ pot, ¾ pot, pot, all-in); the slider keeps its value rather
  than resetting.
- Pre-action checkboxes while waiting: **Check/Fold**, **Check**, **Call any**.
- Readout: your hole cards and the board, crisp, with your current best hand
  named ("Two pair, kings and sevens").
- Player strip: stack, last action ("Raise 600"), whose turn, timer ring,
  button/blind markers.
- Hand history of the last hand (who won what, with which hand).

---

## 4. How it fits the codebase

```
src/
  app/            sign-in, lobby, screens (gains a game picker: Blackjack | Texas Hold'em)
  games/
    blackjack/    today's roomLogic, table3dBridge, HUD (moved, unchanged)
    holdem/       client: socket connection, HUD, scene bridge
  scene/          shared 3D: room, furniture, characters, cards, chips, reach
    holdem/       oval table, seats, community cards, pot, button puck
server/           Cloudflare Worker + Durable Object (the dealer)
  rules/          pure Hold'em rules engine — no I/O, fully unit-tested
```

- **Rules engine first, as a pure module** (`server/rules/`): state in,
  action in, new state out. That makes the tricky parts — side pots, short
  all-ins, heads-up order, odd chips — testable in isolation with hundreds of
  scripted hands before any graphics exist.
- **Hand evaluator:** use a proven MIT-licensed library rather than writing
  one: `@pokertools/evaluator` (5–7 cards, fast perfect-hash) or `pokersolver`
  (also names hands, handy for "Two pair, kings"). Runs on the server.
- **Chips:** one balance shared by both games (`accounts/{uid}/chips`). Buying
  in moves chips from the account onto the table; standing up moves them
  back. Only the server writes poker results.
- **Lobby:** `publicIndex` gains a game type; the lobby lists Hold'em tables
  with blinds, seats taken and average pot.

---

## 5. Build order

1. **Decide the server** (section 1) and stand up a skeleton: sign-in token
   check, join/leave a table, chat, presence.
2. **Rules engine + tests**: dealing, blinds and button (including
   heads-up), betting rounds, min-raise and short-all-in rules, side pots,
   showdown, split pots and odd chips, timers and time bank.
3. **Playable in 2D**: HUD and readout against the real server — a complete,
   fair game before any 3D.
4. **3D table**: oval table, seats, dealer pitching cards, community cards,
   chips moving to the pot and to the winner, button puck.
5. **Lobby and chips**: game picker, Hold'em tables in the lobby, buy-in and
   cash-out, stakes ladder.
6. **Hardening**: reconnects, disconnect handling, sit-out, rate limits,
   hand history; then move blackjack onto the same server to close its
   shoe leak.

### Suggested stakes ladder (fits the 100,000 starting chips)
| Blinds | Buy-in (40–100 BB) |
|---|---|
| 50 / 100 | 4,000 – 10,000 |
| 100 / 200 | 8,000 – 20,000 |
| 250 / 500 | 20,000 – 50,000 |
| 500 / 1,000 | 40,000 – 100,000 |

---

## 6. Decisions needed before building
1. **Server:** Cloudflare Workers (free, recommended) or Firebase Cloud
   Functions (requires the paid Blaze plan)?
2. **Table size:** 6-max first (recommended), or 9-max?
3. **Empty tables:** add computer players ("bots") to fill seats, or real
   players only? Bots make public tables playable at quiet times but are a
   project of their own.

---

## Sources
- Poker TDA Rules (2026 v1.1): https://www.pokertda.com/view-poker-tda-rules/
- Robert's Rules — buttons and blinds (reprint): https://cardplayer.com/rules-of-poker/buttons-and-blinds
- Firebase pricing plans (Functions need Blaze): https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Cloudflare: Durable Objects on the Workers Free plan (2025-04-07): https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/
- Durable Objects pricing and limits: https://developers.cloudflare.com/durable-objects/platform/pricing , https://developers.cloudflare.com/durable-objects/platform/limits
- Table sizes: https://mrcpoker.com/products/the-prestige-10-player-poker-table-purple-surface-pedestal-legs , https://mrcpoker.com/products/mrc-poker-table-the-junior-prestige , https://pokertablesamericana.com/blogs/poker-stories/poker-table-dimensions-essential-measurements-for-game-room-setup , https://www.pokerchipforum.com/goto/post?id=1606292
- Hand evaluators: https://npmjs.com/package/pokersolver , https://classic.yarnpkg.com/en/package/@pokertools/evaluator
- Time bank: https://www.pokernews.com/pokerterms/time-bank.htm
