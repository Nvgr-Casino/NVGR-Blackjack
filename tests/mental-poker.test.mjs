// Simulates whole hands of mental poker between N clients over a shared
// in-memory "database", with the real rules engine and protocol driver.
import * as R from '../src/poker/rules.js';
import * as MP from '../src/poker/mentalPoker.js';
import { createProtocol } from '../src/poker/protocol.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const clone = (o) => JSON.parse(JSON.stringify(o));
// What the database does to everything it stores: no empty object or
// array survives, and null fields vanish.
const strip = (o) => {
  if (Array.isArray(o)) { const a = o.map(strip).filter((v) => v !== undefined); return a.length ? a : undefined; }
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) { const w = strip(v); if (w !== undefined) out[k] = w; }
    return Object.keys(out).length ? out : undefined;
  }
  return o === null ? undefined : o;
};
const viaDb = (room) => { const r = strip(clone(room)); Object.keys(room).forEach((k) => delete room[k]); Object.assign(room, r); };
const setPath = (obj, path, value) => {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {};
  o[path[path.length - 1]] = value;
};

// Crypto basics.
{
  const s1 = MP.newSecrets([0]), s2 = MP.newSecrets([0]);
  const m = MP.encode(5);
  const c = MP.modpow(MP.modpow(m, s1.e), s2.e);
  ok(MP.decode(MP.modpow(MP.modpow(c, s1.d), s2.d)) === MP.CARDS[5], 'locks come off in any order');
  ok(MP.unpackSecrets(MP.packSecrets(s1)).e === s1.e, 'secrets survive a reload');
  ok(new Set(MP.CARDS.map((_, i) => MP.encode(i).toString())).size === 52, '52 distinct encodings');
}

async function playHand({ n, script, dropAfterDeal = null, label }) {
  const room = { sb: 50, bb: 100, players: {}, log: [], buttonSeat: n - 1 };
  for (let i = 0; i < n; i++) room.players['p' + i] = { name: 'P' + i, seat: i, stack: 10000, status: 'active', waitBB: false, timeouts: 0, timeBank: 30 };
  R.startHand(room, 'H' + Math.random().toString(36).slice(2), Date.now());
  const mp = {};
  const clients = Object.keys(room.players).map((k) => {
    const store = new Map();
    return { key: k, proto: createProtocol({ me: k, storage: { get: (s) => store.get(s), set: (s, v) => store.set(s, v) } }), cards: null, dropped: false };
  });
  let rounds = 0;
  let clockOffset = 0;
  while (room.hand && room.hand.phase !== 'done' && rounds++ < 400) {
    for (const c of clients) {
      if (c.dropped) continue;
      const res = await c.proto.update({ hand: clone(room.hand), mp: clone(mp), players: clone(room.players), now: Date.now() + clockOffset });
      if (res.error) throw new Error(c.key + ': ' + res.error);
      for (const w of res.writes) {
        if (w.ifStep !== undefined && ((mp.deck && mp.deck.step) ?? -1) !== w.ifStep) continue;
        setPath(mp, w.path, clone(w.value));
      }
      if (res.myCards) c.cards = res.myCards;
      viaDb(room);
      const h = room.hand;
      if (h.phase === 'deal' && res.ready) R.onDealt(room);
      if (h.phase === 'board' && res.board) R.onBoard(room, res.board);
      if (h.phase === 'showdown') Object.entries(res.shown).forEach(([k, cards]) => R.onShown(room, k, cards));
    }
    viaDb(room);
    const h = room.hand;
    if (h.phase === 'betting') {
      const who = h.toAct;
      const legal = R.legalActions(room, who);
      const move = script(room, who, legal);
      if (!R.applyAction(room, who, move[0], move[1])) throw new Error('illegal ' + move);
    }
    if (dropAfterDeal && h.phase !== 'deal') {
      const c = clients.find((x) => x.key === dropAfterDeal);
      if (!c.dropped) { c.dropped = true; room.players[dropAfterDeal].online = false; }
    }
    // Let time pass for custodians when stuck.
    if (rounds % 20 === 0) clockOffset += 6000;
  }
  return { room, mp, clients, rounds };
}

const passive = (room, who, legal) => (legal.check ? ['check'] : ['call']);

for (const n of [2, 3, 6]) {
  const { room, mp, clients, rounds } = await playHand({ n, script: passive });
  const h = room.hand;
  ok(h && h.phase === 'done', `n=${n}: hand played to the end (${rounds} rounds)`);
  ok(clients.every((c) => c.cards && c.cards.length === 2), `n=${n}: every player decrypted their own two cards`);
  const all = clients.flatMap((c) => c.cards).concat(h.board);
  ok(new Set(all).size === 2 * n + 5, `n=${n}: no card dealt twice (${all.length})`);
  ok(h.board.length === 5 && Object.keys(h.shown).length === n, `n=${n}: board of five, every hand shown`);
  ok(clients.every((c) => h.shown[c.key].join() === c.cards.join()), `n=${n}: shown cards are the ones each player was dealt`);
  const conserved = Object.values(room.players).reduce((s, p) => s + p.stack, 0) === 10000 * n;
  ok(conserved, `n=${n}: chips conserved`);
  // Nothing public reveals a hole card before showdown: the only keys for
  // hole positions published are at showdown, and the deliveries are sealed.
  ok(Object.values(mp.hole || {}).every((row) => Object.values(row).every((box) => box.iv && box.ct)), `n=${n}: hole-card keys only ever travel sealed`);
}

// Fold before the flop: no board turned.
{
  let first = true;
  const { room, mp } = await playHand({ n: 3, script: (r, who, legal) => (first ? (first = false, ['raise', 400]) : ['fold']) });
  ok(room.hand.phase === 'done' && !mp.reveal, 'everyone folds to a raise: no card ever revealed');
}

// A player drops out after the deal: their custodian turns their keys.
{
  const { room } = await playHand({ n: 3, dropAfterDeal: 'p1', script: passive });
  ok(room.hand.phase === 'done' && room.hand.board.length === 5, 'a player gone after the deal: the custodian turns the board and the hand plays out');
}

// Timing: one full shuffle pass per player.
{
  const s = MP.newSecrets(Array.from({ length: 20 }, (_, i) => i));
  const t0 = performance.now();
  const d1 = MP.shufflePass(MP.plainDeck(), s);
  MP.relockPass(d1, s);
  ok(true, `one player's shuffle + relock: ${(performance.now() - t0).toFixed(0)} ms`);
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
