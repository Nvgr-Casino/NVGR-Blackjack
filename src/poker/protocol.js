// One player's part in dealing a hand of mental poker (mentalPoker.js),
// worked out from what is in the room. Every client runs it on every
// change — to the hand, or to the hand's crypto node beside the room — and
// it says what this player has to write next, and what has now become
// known:
//
//   pub/<me>               my ECDH public key for the hand (channel.js)
//   deck                   { step, cards } — the deck after each pass; each
//                          player writes it on their own turn, and only
//                          over the step they worked from (`ifStep`)
//   hole/<me>/<them>       my keys to their two cards, sealed for them
//   escrow/<me>            all my keys, sealed for the next player round
//                          (my custodian) — so the board can still be
//                          turned, and my hand shown, if I drop out
//   reveal/<who>/<pos>     a key published, for the board or a showdown
//
// It never writes the room itself: the board, the hands shown and "dealt"
// are handed back for the caller to commit through the rules
// (src/app/pokerSession.js). Nothing here is trusted beyond what a player
// can check — a card that doesn't decode stops the hand.
//
// With only two players there is no custodian: whoever is left wins by the
// other's fold, so nothing more ever has to be turned.

import * as MP from './mentalPoker.js';
import * as CH from './channel.js';
import { deckPositions, REVEAL_STALL_MS } from './rules.js';

// How long a player has to publish their own key before their custodian
// does it for them.
export const CUSTODIAN_GRACE_MS = 5000;

export function createProtocol({ me, storage }) {
  let handId = null;
  let secrets = null;
  let pair = null;
  let pubText = null;
  let myCards = null;
  // Writes already made this hand, and when — so the same write isn't
  // sent again while the room catches up with it, yet is sent again if it
  // seems to have been lost.
  const done = new Map();
  const RETRY_MS = 4000;

  async function ensureKeys(hand, positions) {
    if (handId === hand.id && secrets) return;
    handId = hand.id;
    myCards = null;
    done.clear();
    const slot = 'nvgr-mp:' + hand.id;
    const saved = storage.get(slot);
    if (saved) {
      const o = JSON.parse(saved);
      secrets = MP.unpackSecrets(o.s);
      pair = await CH.importKeyPair(o.k);
    } else {
      secrets = MP.newSecrets(positions);
      pair = await CH.newKeyPair();
      storage.set(slot, JSON.stringify({ s: MP.packSecrets(secrets), k: await CH.exportKeyPair(pair) }));
    }
    pubText = await CH.publicKeyText(pair);
  }

  // `ifStep`, for the deck: written only if the deck is still at that
  // step — a retried write must never land on top of the next player's.
  const write = (out, path, value, tag = path.join('/'), ifStep) => {
    const now = Date.now();
    if (done.has(tag) && now - done.get(tag) < RETRY_MS) return;
    done.set(tag, now);
    out.writes.push(ifStep === undefined ? { path, value } : { path, value, ifStep });
  };

  /**
   * `hand` is room.hand, `mp` this hand's crypto node (or null), `players`
   * room.players. Returns { writes, ready, myCards, board, shown, error }.
   */
  async function update({ hand, mp, players, now = Date.now() }) {
    const out = { writes: [], ready: false, myCards: null, board: null, shown: {}, error: null };
    if (!hand || !hand.players || !hand.players.includes(me)) return out;
    const order = hand.players;
    const n = order.length;
    const idx = order.indexOf(me);
    const pos = deckPositions(n);
    const needed = pos.hole.flat().concat(pos.board);
    await ensureKeys(hand, needed);
    mp = mp || {};
    const pub = mp.pub || {};
    const deck = mp.deck || null;
    const step = deck ? deck.step : -1;
    const custodianOf = (k) => (n >= 3 ? order[(order.indexOf(k) + 1) % n] : null);

    // My public key, first of all.
    if (pub[me] !== pubText) write(out, ['pub', me], pubText);

    // My two turns at the deck: the shuffle, then the relock.
    if (hand.phase === 'deal') {
      if (step === idx - 1) {
        const cards = step < 0 ? MP.plainDeck() : deck.cards.map(MP.fromHex);
        write(out, ['deck'], { step: idx, cards: MP.shufflePass(cards, secrets).map(MP.toHex) }, 'deck@' + idx, step);
      } else if (step === n + idx - 1) {
        const cards = deck.cards.map(MP.fromHex);
        write(out, ['deck'], { step: n + idx, cards: MP.relockPass(cards, secrets).map(MP.toHex) }, 'deck@' + (n + idx), step);
      }
    }
    const shuffled = deck && deck.step === 2 * n - 1;
    if (!shuffled) return out;
    const cipher = (p) => MP.fromHex(deck.cards[p]);
    const allPubs = order.every((k) => pub[k]);

    // Everyone else's keys to their own cards, sealed for them; and all of
    // mine to my custodian.
    if (allPubs) {
      const hole = (mp.hole && mp.hole[me]) || {};
      for (let j = 0; j < n; j++) {
        const them = order[j];
        if (them === me || hole[them]) continue;
        const keys = Object.fromEntries(pos.hole[j].map((p) => [p, MP.toHex(secrets.kinv[p])]));
        write(out, ['hole', me, them], await CH.seal(pair, pub[them], keys));
      }
      const custodian = custodianOf(me);
      if (custodian && !(mp.escrow && mp.escrow[me])) {
        const keys = Object.fromEntries(needed.map((p) => [p, MP.toHex(secrets.kinv[p])]));
        write(out, ['escrow', me], { to: custodian, ...(await CH.seal(pair, pub[custodian], keys)) });
      }
    }

    // My own two cards, once everyone's keys to them are here.
    const deliveries = order.filter((k) => k !== me).map((k) => mp.hole && mp.hole[k] && mp.hole[k][me]);
    if (!myCards && allPubs && deliveries.every(Boolean)) {
      const mine = pos.hole[idx];
      const inv = { [mine[0]]: [secrets.kinv[mine[0]]], [mine[1]]: [secrets.kinv[mine[1]]] };
      let j = 0;
      for (const k of order) {
        if (k === me) continue;
        const keys = await CH.open(pair, pub[k], deliveries[j++]);
        mine.forEach((p) => inv[p].push(MP.fromHex(keys[p])));
      }
      const cards = mine.map((p) => MP.unlock(cipher(p), inv[p]));
      if (cards.some((c) => !c)) { out.error = 'A card did not decode.'; return out; }
      myCards = cards;
    }
    out.myCards = myCards;

    // Dealt, once every player has everyone's keys and every escrow is in.
    const allHole = order.every((a) => order.every((b) => a === b || (mp.hole && mp.hole[a] && mp.hole[a][b])));
    const allEscrow = n < 3 || order.every((k) => mp.escrow && mp.escrow[k]);
    out.ready = allHole && allEscrow;

    // Cards to be turned now: the next street's, or the hands at showdown.
    let turning = [];
    if (hand.phase === 'board') turning = pos.board.slice((hand.board || []).length, hand.boardTarget);
    if (hand.phase === 'showdown') {
      (hand.showOrder || []).forEach((k) => { if (!(hand.shown && hand.shown[k])) turning = turning.concat(pos.hole[order.indexOf(k)]); });
    }
    if (!turning.length) return out;

    const reveal = mp.reveal || {};
    turning.forEach((p) => {
      if (!(reveal[me] && reveal[me][p])) write(out, ['reveal', me, String(p)], MP.toHex(secrets.kinv[p]));
    });
    // Standing in for anyone I am custodian for who hasn't turned their
    // keys in time, or has left.
    const since = hand.stallAt ? hand.stallAt - REVEAL_STALL_MS : now;
    for (const k of order) {
      if (k === me || custodianOf(k) !== me) continue;
      const gone = !players || !players[k] || players[k].leaving || players[k].online === false;
      const missing = turning.filter((p) => !(reveal[k] && reveal[k][p]));
      if (!missing.length || (!gone && now - since < CUSTODIAN_GRACE_MS)) continue;
      const box = mp.escrow && mp.escrow[k];
      if (!box || box.to !== me) continue;
      const keys = await CH.open(pair, pub[k], box);
      missing.forEach((p) => write(out, ['reveal', k, String(p)], keys[p]));
    }

    // Anything everyone's keys are now in for.
    const turned = {};
    for (const p of turning) {
      const inv = order.map((k) => reveal[k] && reveal[k][p]);
      if (!inv.every(Boolean)) continue;
      const card = MP.unlock(cipher(p), inv.map(MP.fromHex));
      if (!card) { out.error = 'A card did not decode.'; return out; }
      turned[p] = card;
    }
    if (hand.phase === 'board') {
      const want = pos.board.slice(0, hand.boardTarget);
      const have = want.map((p, i) => (hand.board && hand.board[i]) || turned[p]);
      if (have.every(Boolean)) out.board = have;
    }
    if (hand.phase === 'showdown') {
      (hand.showOrder || []).forEach((k) => {
        const [a, b] = pos.hole[order.indexOf(k)];
        if (turned[a] && turned[b]) out.shown[k] = [turned[a], turned[b]];
      });
    }
    return out;
  }

  /** Who is holding up the deal: whose turn at the deck it is, or who hasn't delivered. */
  function blame(hand, mp) {
    if (!hand || !hand.players) return [];
    const order = hand.players;
    const n = order.length;
    mp = mp || {};
    const step = mp.deck ? mp.deck.step : -1;
    if (step < 2 * n - 1) return [order[(step + 1) % n]];
    return order.filter((a) => !(mp.pub && mp.pub[a])
      || order.some((b) => a !== b && !(mp.hole && mp.hole[a] && mp.hole[a][b]))
      || (n >= 3 && !(mp.escrow && mp.escrow[a])));
  }

  return { update, blame, myCards: () => myCards };
}
