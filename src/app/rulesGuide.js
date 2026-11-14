// How to play: a Rules button on every table, opening a short guide to that
// game: the aim, how a round runs, what you can do, and what each bet pays.
// It lives on document.body, outside the HUD that the session redraws every
// second, so it stays open while the table plays on behind it.

const card = (rank, suit) => {
  const red = suit === '♥' || suit === '♦';
  return `<span class="rg-card ${red ? 'red' : ''}"><b>${rank}</b><i>${suit}</i></span>`;
};
const cards = (...list) => `<span class="rg-cards">${list.map(([r, s]) => card(r, s)).join('')}</span>`;
const table = (head, rows) => `<table class="rg-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const steps = (list) => `<ol class="rg-steps">${list.map((s) => `<li>${s}</li>`).join('')}</ol>`;
const moves = (list) => `<dl class="rg-moves">${list.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
const die = (n) => {
  const pips = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n];
  return `<span class="rg-die">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<i class="${pips.includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;
};
const dice = (a, b) => `<span class="rg-dice">${die(a)}${die(b)}</span>`;

const GUIDES = {
  blackjack: {
    title: 'Blackjack',
    lede: 'Beat the dealer by finishing closer to 21, without going over.',
    sections: [
      ['Card values', `
        <p>Number cards count their number. ${cards(['K', '♠'], ['Q', '♥'], ['J', '♦'], ['10', '♣'])} count 10. An ace ${cards(['A', '♠'])} counts 1 or 11, whichever helps you.</p>
        <p>An ace and a ten-card as your first two cards ${cards(['A', '♥'], ['K', '♠'])} is a <b>Blackjack</b>, the best hand.</p>`],
      ['How a round goes', steps([
        'Place your bet in your circle before the timer runs out.',
        'Everyone gets two cards face up. The dealer gets one face up and one face down.',
        'In turn, each player plays their hand (see Your moves).',
        'The dealer turns over the hidden card and draws until reaching 17 or more. The dealer stands on every 17, soft 17 included.',
        'Closer to 21 than the dealer wins. Over 21 is a bust and loses, even if the dealer busts too.',
      ])],
      ['Your moves', moves([
        ['Hit', 'Take another card.'],
        ['Stand', 'Keep your hand as it is.'],
        ['Double', 'Double your bet on your first two cards, take exactly one more card, then stand.'],
        ['Split', 'Two cards of the same value? Split them into two hands, with a second bet the same size. Split aces get one card each.'],
        ['Surrender', 'Give up your first two cards and take half your bet back.'],
        ['Insurance', 'When the dealer shows an ace, a side bet of half your stake that the dealer has Blackjack. Pays 2 to 1.'],
      ])],
      ['Payouts', table(['Result', 'Pays'], [
        ['Blackjack', '3 to 2'],
        ['Win', '1 to 1'],
        ['Tie with the dealer (push)', 'Bet returned'],
        ['Insurance, dealer has Blackjack', '2 to 1'],
      ])],
      ['Good to know', '<p>Six decks are shuffled together. If you miss a few rounds in a row you are marked away and your seat may be given to someone else.</p>'],
    ],
  },
  holdem: {
    title: "Texas Hold'em",
    lede: 'Make the best five-card hand, or get everyone else to fold, and win the pot.',
    sections: [
      ['How a hand goes', steps([
        'Two players post the blinds, small and big, so there is something to play for.',
        'You get two private cards. A round of betting follows.',
        '<b>The flop</b>: three shared cards face up in the middle. Betting.',
        '<b>The turn</b>: a fourth shared card. Betting.',
        '<b>The river</b>: a fifth shared card. Final betting.',
        '<b>Showdown</b>: the best five-card hand from your two cards plus the five shared cards wins the pot.',
      ])],
      ['Your moves', moves([
        ['Check', 'Pass without betting, if nobody has bet yet.'],
        ['Call', 'Match the current bet.'],
        ['Raise', 'Bet more than the current bet. Everyone else must call, raise again or fold.'],
        ['Fold', 'Give up your cards and anything you have already put in.'],
        ['All in', 'Bet every chip you have.'],
      ])],
      ['Hand rankings, best first', table(['Hand', 'Example'], [
        ['Royal flush', cards(['A', '♠'], ['K', '♠'], ['Q', '♠'], ['J', '♠'], ['10', '♠'])],
        ['Straight flush', cards(['9', '♥'], ['8', '♥'], ['7', '♥'], ['6', '♥'], ['5', '♥'])],
        ['Four of a kind', cards(['Q', '♠'], ['Q', '♥'], ['Q', '♦'], ['Q', '♣'], ['3', '♠'])],
        ['Full house', cards(['K', '♠'], ['K', '♥'], ['K', '♦'], ['7', '♣'], ['7', '♠'])],
        ['Flush', cards(['A', '♦'], ['J', '♦'], ['8', '♦'], ['6', '♦'], ['2', '♦'])],
        ['Straight', cards(['10', '♣'], ['9', '♦'], ['8', '♠'], ['7', '♥'], ['6', '♣'])],
        ['Three of a kind', cards(['7', '♠'], ['7', '♥'], ['7', '♦'], ['K', '♣'], ['2', '♠'])],
        ['Two pair', cards(['J', '♠'], ['J', '♥'], ['4', '♦'], ['4', '♣'], ['A', '♠'])],
        ['One pair', cards(['10', '♠'], ['10', '♥'], ['K', '♦'], ['6', '♣'], ['3', '♠'])],
        ['High card', cards(['A', '♠'], ['Q', '♥'], ['9', '♦'], ['5', '♣'], ['2', '♠'])],
      ])],
      ['Good to know', '<p>Hands of the same rank are decided by the higher cards. A tie splits the pot.</p>'],
    ],
  },
  roulette: {
    title: 'Roulette',
    lede: 'Bet on where the ball lands. European wheel: 37 pockets, 0 to 36, a single zero.',
    sections: [
      ['How a round goes', steps([
        'Choose a chip value, then tap the layout to place chips. Tap again to add more.',
        'When the timer ends, no more bets. The croupier spins the wheel and the ball.',
        'Winning bets are paid. Losing chips are taken. Then the next round opens.',
      ])],
      ['Bets and payouts', table(['Bet', 'Covers', 'Pays'], [
        ['Straight up', 'One number', '35 to 1'],
        ['Split', 'Two numbers side by side (chip on the line between them)', '17 to 1'],
        ['Street', 'A row of three', '11 to 1'],
        ['Corner', 'Four numbers that meet at a corner', '8 to 1'],
        ['Six line', 'Two rows of three', '5 to 1'],
        ['Dozen / Column', '12 numbers', '2 to 1'],
        ['Red / Black, Odd / Even, 1–18 / 19–36', '18 numbers', '1 to 1'],
      ])],
      ['Good to know', '<p>Zero is green and loses every outside bet (red/black, odd/even, dozens, columns, 1–18/19–36). Use <b>Undo</b>, <b>Clear</b>, <b>Repeat</b> or <b>Double</b> to manage your chips quickly.</p>'],
    ],
  },
  baccarat: {
    title: 'Baccarat',
    lede: 'Bet on which hand finishes closer to 9: Player or Banker. You never draw cards yourself.',
    sections: [
      ['Card values', `<p>Aces count 1. Two to nine count their number. ${cards(['10', '♠'], ['J', '♥'], ['Q', '♦'], ['K', '♣'])} count 0. Only the last digit of the total counts: ${cards(['7', '♠'], ['8', '♥'])} is 15, which counts as <b>5</b>.</p>`],
      ['How a round goes', steps([
        'Bet on Player, Banker or Tie, and the pairs if you like.',
        'The dealer gives two cards to each hand.',
        'An 8 or 9 is a <b>natural</b>, and both hands stand.',
        'Otherwise a third card may be drawn by fixed rules the dealer follows for you: Player draws on 0–5; Banker draws depending on its total and Player’s third card.',
        'The hand closer to 9 wins.',
      ])],
      ['Payouts', table(['Bet', 'Pays'], [
        ['Player', '1 to 1'],
        ['Banker', '19 to 20 (1 to 1, less 5% commission)'],
        ['Tie', '8 to 1 (Player and Banker bets are returned)'],
        ['Player pair / Banker pair', '11 to 1, if that hand’s first two cards are a pair'],
      ])],
      ['Good to know', '<p>The scoreboard shows the shoe’s results so far. Banker wins slightly more often, which is why it carries the commission.</p>'],
    ],
  },
  craps: {
    title: 'Craps',
    lede: 'Bet on the roll of two dice. The shooter throws; everyone bets on the result.',
    sections: [
      ['The come-out roll', `
        <p>A round starts with a <b>come-out roll</b>.</p>
        ${table(['Roll', 'Result'], [
          [`${dice(3, 4)} 7 or ${dice(5, 6)} 11`, '<b>Natural</b>: Pass Line wins'],
          [`${dice(1, 1)} 2, ${dice(1, 2)} 3 or ${dice(6, 6)} 12`, '<b>Craps</b>: Pass Line loses'],
          ['4, 5, 6, 8, 9 or 10', 'That number becomes <b>the point</b>, marked with the puck'],
        ])}`],
      ['After the point is set', `
        <p>The shooter keeps rolling. Rolling <b>the point again</b> before a 7 wins for the Pass Line. Rolling a <b>7 first</b> (seven-out) loses, and the dice pass to the next shooter.</p>`],
      ['Bets and payouts', table(['Bet', 'Wins when', 'Pays'], [
        ['Pass Line', 'Natural on the come-out, or the point is made', '1 to 1'],
        ["Don't Pass", '2 or 3 on the come-out, or 7 before the point (12 on the come-out is a tie)', '1 to 1'],
        ['Odds', 'Added behind your line bet once a point is set. Pays true odds, with no house edge', '4/10: 2 to 1 · 5/9: 3 to 2 · 6/8: 6 to 5'],
        ['Place 4 / 10', 'That number rolls before a 7', '9 to 5'],
        ['Place 5 / 9', 'That number rolls before a 7', '7 to 5'],
        ['Place 6 / 8', 'That number rolls before a 7', '7 to 6'],
        ['Field (one roll)', '2, 3, 4, 9, 10, 11 or 12', '1 to 1 · 2 pays 2 to 1 · 12 pays 3 to 1'],
        ['Hard 4 / 10', 'Rolled as a pair (2+2, 5+5) before a 7 or the easy way', '7 to 1'],
        ['Hard 6 / 8', 'Rolled as a pair (3+3, 4+4) before a 7 or the easy way', '9 to 1'],
        ['Any 7 (one roll)', 'Next roll is 7', '4 to 1'],
        ['Any Craps (one roll)', 'Next roll is 2, 3 or 12', '7 to 1'],
        ['Eleven (one roll)', 'Next roll is 11', '15 to 1'],
        ['Aces 2 / Twelve (one roll)', 'Next roll is 2, or 12', '30 to 1'],
        ['Ace-Deuce 3 (one roll)', 'Next roll is 3', '15 to 1'],
      ])],
      ['Good to know', '<p>Pass Line bets go down on the come-out only, and stay until decided. Place and Hard bets stay up after a win, and are off on come-out rolls. One-roll bets are settled on every throw.</p>'],
    ],
  },
  slots: {
    title: 'Slots',
    lede: 'Spin the reels and line up matching symbols on a payline, from left to right.',
    sections: [
      ['How to play', steps([
        'Choose your bet per spin with the − and + buttons. It is spread across all the machine’s lines.',
        'Press <b>Spin</b>, pull the handle, or press the space bar.',
        'Three or more of the same symbol on a line, starting from the leftmost reel, win. Each line is paid on its own, and wins on different lines add up.',
        'The wild stands in for other symbols to complete a win.',
        'Tap <b>Pays</b> for the machine’s full pay table and its lines; tap <b>Machines</b> to move to another machine.',
      ])],
      ['The machines', moves([
        ['Crown Jewels', 'Five reels, ten lines. The NVGR crest is wild; three or more Diamonds anywhere pay on your whole bet.'],
        ['Imperial Sevens', 'A classic three-reel machine with five lines. The Diamond wild doubles a win, four times with two. Any three sevens or any three bars pay too, and a cherry or two at the start of a line pays a little.'],
        ['High Roller', 'Five reels, ten lines. The crest is wild; three or more Golden Chips anywhere pay on your whole bet.'],
        ['Jade Panda', 'Five reels, ten lines, and four jackpots. Six or more Golden Pearls start Hold & Spin: the pearls lock, you get three respins, and every new pearl puts the count back to three. Pearls carry prizes or the Mini, Minor and Major; fill all fifteen places for the Grand. The Major and Grand grow with every spin.'],
      ])],
      ['Good to know', '<p>Each machine gives back about 95 per cent over the long run. Slots play on your real balance, and every spin is saved the moment you press Spin.</p>'],
    ],
  },
};

let overlay = null;
let lastGame = null;

export function openRules(game) {
  const g = GUIDES[game] || GUIDES.blackjack;
  closeRules();
  lastGame = game;
  overlay = document.createElement('div');
  overlay.className = 'rg-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `How to play ${g.title}`);
  overlay.innerHTML = `
    <div class="rg-panel">
      <header class="rg-head">
        <span class="rg-kicker">How to play</span>
        <h2>${g.title}</h2>
        <p class="rg-lede">${g.lede}</p>
        <button class="rg-close" aria-label="Close">×</button>
      </header>
      <div class="rg-body">
        ${g.sections.map(([h, body]) => `<section><h3>${h}</h3>${body}</section>`).join('')}
      </div>
      <footer class="rg-foot"><button class="btn btn-primary" data-rg-close>Got it</button></footer>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.rg-close') || e.target.closest('[data-rg-close]')) closeRules();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay && overlay.classList.add('on'));
  document.addEventListener('keydown', onKey);
}
export function closeRules() {
  document.removeEventListener('keydown', onKey);
  if (overlay) overlay.remove();
  overlay = null;
}
const onKey = (e) => { if (e.key === 'Escape') closeRules(); };

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z M17.5 17H8a3 3 0 0 0-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 9h5M9 12.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
/** The HUD's Rules button for `game`. */
export function rulesButton(game) {
  return `<button class="hud-btn hud-labelled" data-rules="${game || 'blackjack'}" aria-label="How to play">${ICON}<span class="hud-label">Rules</span></button>`;
}

// One listener for every table's button, as the HUD is redrawn constantly.
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-rules]');
  if (b) openRules(b.dataset.rules);
});
// Leaving a table closes its guide.
export const rulesOpenFor = () => (overlay ? lastGame : null);
