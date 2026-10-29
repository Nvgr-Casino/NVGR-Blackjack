# NVGR Texas Hold'em — how it plays and how it deals

No-Limit Texas Hold'em, six-seat cash tables, following the Poker TDA rules
(2026) and the usual cash-game house rules. The rules are in
`src/poker/rules.js`; the hand evaluator in `src/poker/evaluator.js`.

## Tables

| Room | Blinds | Buy-in (40–100 big blinds) |
|---|---|---|
| The Lounge | 50 / 100 | 4,000 – 10,000 |
| The Parlour | 100 / 200 | 8,000 – 20,000 |
| The Library | 250 / 500 | 20,000 – 50,000 |
| The Gold Room | 500 / 1,000 | 40,000 – 100,000 |
| The Penthouse | 2,500 / 5,000 | 200,000 – 500,000 |

- Six seats, numbered clockwise from the dealer's left.
- The lobby always has one public table at each stakes; anyone can open a
  private one.
- **Table stakes.** Your buy-in leaves your balance for your stack, and the
  stack goes back when you leave. You can add chips between hands, up to the
  maximum buy-in.

## The hand

1. **Button and blinds.** The button moves one seat left each hand. The
   small blind is to its left, the big blind next. Heads-up, the button is
   the small blind (TDA 36-C).
2. **Joining.** A player who sits down at a game already running waits for
   the big blind, unless there are too few others for that.
3. **The deal.** Two cards each, one at a time, starting from the small
   blind.
4. **Pre-flop.** The player left of the big blind acts first; heads-up, the
   button. The big blind has the option.
5. **Flop, turn, river.** One card is burned before each (TDA 40). From the
   flop on, the first player in to the button's left acts first; heads-up,
   that is the big blind.
6. **Betting.** Fold, check, call, bet or raise, with no cap on raises
   (TDA 50).
   - The minimum bet is the big blind.
   - A raise must be at least the last full bet or raise (TDA 45-A).
   - An all-in short of a full raise doesn't reopen the betting for anyone
     who has already acted (TDA 49-A).
   - An uncalled bet is returned.
7. **All in.** Side pots are built layer by layer. Once no more betting is
   possible, the rest of the board is dealt out (TDA 17).
8. **Showdown.** The last player to bet or raise on the river shows first
   (TDA 18-A). Online, every hand still in is turned over. Cards speak: the
   best five of your two and the board's five win.
   - Split pots go to every tied hand.
   - The odd chip goes to the first winner left of the button (TDA 21).
9. **The clock.** 20 seconds to act, then a 30-second time bank that refills
   5 seconds a hand. Out of time, you check if you can and fold if you
   can't.
   - Two timeouts in a row sit you out.
   - After ten minutes sitting out you are stood up, and your stack is held
     for you.
10. **Leaving.** You fold out of any hand you're in and take what is left of
    your stack at once.

## Dealing without a dealer: mental poker

There is no server. Any signed-in player can read a whole room in the
database, so the cards are never in the room at all. The players' own
browsers shuffle and deal them, with the SRA commutative encryption scheme
(`src/poker/mentalPoker.js`, `src/poker/protocol.js`).

- **The shuffle.** Each player in turn locks every card with a secret key
  and shuffles the deck. Then each in turn swaps that key for a separate key
  on every card that will be used. After both passes, nobody knows where any
  card is, and every card has a lock from every player.
- **Your cards.** Every other player sends you their keys to your two cards,
  sealed with ECDH and AES-GCM so that only you can open them
  (`src/poker/channel.js`). Nobody else ever sees your cards until the
  showdown.
- **The board and the showdown.** Everyone publishes their keys for those
  cards only.
- **Dropping out.** Every player also gives their keys, sealed, to the next
  player round, their custodian. If someone drops out, the custodian turns
  their keys for them and the hand goes on. If a hand can't go on — a
  shuffle stalled, or a card that doesn't check out — it is called off and
  every chip goes back.
- **Where the data lives.**
  - The deck and keys are in `rooms/<code>_mp/<hand>`, beside the room, so
    betting transactions stay small.
  - Who is at the table is in `rooms/<code>_presence`.

**Limits.** Game state, as at the blackjack tables, is still updated by the
players' own clients. A determined cheater could rewrite stacks; they could
not see your cards. Closing that gap needs a trusted server, as in
`docs/texas-holdem-plan.md`.
