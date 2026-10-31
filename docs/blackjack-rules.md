# NVGR Blackjack 21 — house rules and the dealer's sequence

The standard US hole-card game (as at Las Vegas tables), with the felt's own
rules: blackjack pays 3 to 2, the dealer draws to 16 and stands on all 17s,
insurance pays 2 to 1.

## The rules

| Rule | Here |
|---|---|
| Decks | 6-deck shoe, cut card 1–1.5 decks from the end, one card burned after each shuffle |
| Blackjack | Pays 3 to 2. An ace and a ten after a split is 21, not blackjack |
| Dealer | Hits 16 or less, stands on every 17, soft 17 included (S17) |
| Hole card | Dealt face down; the dealer **peeks** for blackjack with an ace or a ten showing |
| Dealer blackjack | Found on the peek, it ends the round before anyone plays. Every hand loses its original bet only; a player blackjack pushes |
| Insurance | Offered with an ace showing, before the peek. Costs half the bet, pays 2 to 1 |
| Double | On any first two cards, including after a split; one card, then stand |
| Split | Any pair of equal value (two tens of any rank too), once per box, to two hands |
| Split aces | One card each, then stand |
| Surrender | Late surrender (after the peek), on the first two cards, not after a split. Half the bet back |
| 21 | A hand reaching 21 stands by itself |
| Ties | Push, bet returned. A dealer blackjack beats a 21 made any other way |
| Timeouts | Out of time on your turn: you stand |

## The shoe and the shuffle

- The **shoe** sits on the dealer's left, its mouth angled toward the
  middle; the chip rack is in front of the dealer; the **discard holder** is
  on the dealer's right.
- Every card comes out of the shoe under the dealer's left hand, slides to
  the handoff point in front of the rack, and is dealt by the right hand.
- Used cards go into the discard holder, face down: a bust hand's cards
  (with its bet) the moment it busts, the rest box by box as each is settled,
  the dealer's own hand last.
- A yellow **cut card** stands in the shoe 52–78 cards from the back (75–83%
  penetration). When it comes out it lies beside the shoe, and the hand in
  progress is played to the end.
- **The shuffle happens before the next round**, during the betting window:
  the dealer lifts out what is left in the shoe and empties the discard
  holder, riffles the cards three times, pushes the cut card in, loads the
  shoe and **burns one card** into the discard holder.

## The dealer's sequence each round

1. **Bets** close.
2. **Deal round the table, twice**, starting at **first base**: the seat on the
   dealer's left, which is seat 1, at the right-hand end of the table as the
   players see it. One card to each box, then the dealer's **up card**. A
   second card to each box, then the dealer's **hole card**, face down.
3. **Ace showing**: insurance is offered, then the dealer peeks. **Ten
   showing**: the dealer peeks straight away. With a blackjack, the hole card
   is turned and the round is settled; nobody plays.
4. **Each box plays in turn**, first base to third base. A busted hand's bet
   is taken at once. With a split, the first hand gets its second card and is
   played out before the second hand gets anything.
5. **The hole card is turned.** The dealer draws to 17 **only if a hand is
   still waiting on the dealer's total**. If every box has bust,
   surrendered or has a blackjack, the dealer turns the card and draws
   nothing.
6. **Settle** from the dealer's right to left (third base to first base):
   losing bets are taken, winners are paid, pushes are left for the player
   to take back.

Source: standard Las Vegas hole-card rules (e.g. Wizard of Odds' blackjack
rules and rule-variation pages; casino dealer procedure manuals). These are
house-rule choices where casinos differ: S17, double after split allowed,
one split, late surrender.

## Tournaments

`src/blackjack/tournament.js`: five seats, 10,000 tournament chips each, bets
from 100 to 5,000, in two formats:

- **Quick:** 5 hands, straight. The biggest stack after the last hand wins.
- **Elimination:** 9 hands. After hands 3, 5 and 7 the lowest stack at the
  table goes out (level at the bottom, the one who started the hand lower
  goes), never the last two, so a full table plays the last two hands
  heads-up. The bigger stack after hand 9 wins.

In either, a player who can no longer cover the minimum bet is out at once.
Level stacks at the end share a place and split its prizes. The top three
are paid, the same buy-ins and prizes in both formats and as the Hold'em
tournaments (Starter 10K to 100K, Classic 50K to 500K, High Roller 100K to
1M, Millionaire 250K to 2.5M, Diamond 1M to 10M). Hold'em keeps its own
format, blinds rising until one player is left: a slower game.

- **Online:** each tournament always has a table taking registrations. It
  starts when five are in, or 90 seconds after the second; a short field
  plays for prizes in proportion. Nobody can stall it: anyone who hasn't bet
  in time is bet the minimum, and anyone who doesn't act stands.
  Unregistering refunds the buy-in; leaving once it is running forfeits the
  seat, in the place reached. The chips never touch the account; a prize
  waits in the room's `prizes` for the winner's own client.
- **Against bots:** four computer players (`src/blackjack/bot.js`), played
  in the browser for the real buy-in and prize. They play basic strategy and
  bet like tournament players: modestly early, harder when behind, and
  everything in the last two hands if they trail the leader.
