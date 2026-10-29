// Mental poker: a deck shuffled and dealt by the players themselves, so
// that no one — no player, and no server, since there is none — ever sees a
// card that isn't theirs to see.
//
// It is the SRA scheme (Shamir, Rivest, Adleman, 1979), with per-card keys
// as Barnett and Smart describe. Encryption is exponentiation modulo a
// large prime p: E_k(m) = m^k mod p. Exponents multiply, so locks put on in
// any order come off in any order: (m^a)^b = (m^b)^a. Two passes round the
// table make the deck:
//
//   1. Shuffle. Each player in turn locks every card with one secret key
//      of their own and shuffles the whole deck. After the last of them,
//      nobody knows where any card is.
//   2. Relock. Each player in turn takes their shuffle key off every card
//      that will be used and puts on a different secret key per card.
//
// A card is then readable only when every player's key for it is taken
// off — and keys are per card, so a player can hand over the key to one
// card without giving away any other. Hole cards: everyone else sends the
// owner their keys for the owner's two cards, privately (channel.js). The
// board, and the hands at showdown: everyone publishes their keys for
// those cards.
//
// The prime is a safe prime, p = 2q + 1 (RFC 2409's 1024-bit MODP group),
// and cards are encoded as squares, so every card lies in the subgroup of
// order q where all of this holds and which hides which card is which —
// with p itself, half the cards could be told apart from the other half by
// a Legendre symbol.

export const P = BigInt('0x'
  + 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1'
  + '29024E088A67CC74020BBEA63B139B22514A08798E3404DD'
  + 'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245'
  + 'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED'
  + 'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381'
  + 'FFFFFFFFFFFFFFFF');
export const Q = (P - 1n) / 2n;

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const CARDS = SUITS.flatMap((s) => RANKS.map((r) => r + '-' + s));

export function modpow(base, exp, mod = P) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

// a^-1 mod m, by the extended Euclidean algorithm.
export function modinv(a, m = Q) {
  let [r0, r1] = [((a % m) + m) % m, m];
  let [s0, s1] = [1n, 0n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new Error('not invertible');
  return ((s0 % m) + m) % m;
}

const cryptoApi = () => globalThis.crypto;

/** A uniformly random exponent in [2, q-1] — a key. */
export function randomKey() {
  const bytes = new Uint8Array(136);
  cryptoApi().getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return (n % (Q - 2n)) + 2n;
}

/** A uniformly random integer in [0, n). */
function randomBelow(n) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  for (;;) {
    cryptoApi().getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** Fisher–Yates, from a cryptographic source. */
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Card i is (i + 2)^2 mod p: a square, so in the order-q subgroup.
export const encode = (i) => modpow(BigInt(i + 2), 2n);
const DECODE = new Map(CARDS.map((c, i) => [encode(i).toString(16), c]));
export const decode = (m) => DECODE.get(m.toString(16)) || null;

export const toHex = (n) => n.toString(16);
export const fromHex = (h) => BigInt('0x' + h);

/** The deck as it starts: every card, in order, unlocked. */
export const plainDeck = () => CARDS.map((_, i) => encode(i));

/**
 * A player's keys for one hand: the shuffle key and its inverse, and a key
 * (and inverse) for each deck position that will be used.
 */
export function newSecrets(positions) {
  const e = randomKey();
  const s = { e, d: modinv(e), k: {}, kinv: {} };
  positions.forEach((pos) => {
    const k = randomKey();
    s.k[pos] = k;
    s.kinv[pos] = modinv(k);
  });
  return s;
}

/** Secrets to and from plain strings, to survive a page reload. */
export function packSecrets(s) {
  const hex = (o) => Object.fromEntries(Object.entries(o).map(([p, v]) => [p, toHex(v)]));
  return JSON.stringify({ e: toHex(s.e), d: toHex(s.d), k: hex(s.k), kinv: hex(s.kinv) });
}
export function unpackSecrets(text) {
  const o = JSON.parse(text);
  const big = (m) => Object.fromEntries(Object.entries(m).map(([p, v]) => [p, fromHex(v)]));
  return { e: fromHex(o.e), d: fromHex(o.d), k: big(o.k), kinv: big(o.kinv) };
}

/** Pass 1: lock every card with the shuffle key, and shuffle. */
export function shufflePass(cards, secrets) {
  return shuffle(cards.map((c) => modpow(c, secrets.e)));
}

/**
 * Pass 2: on each position that will be used, swap the shuffle key for
 * that position's own key — in one exponentiation, by d·k.
 */
export function relockPass(cards, secrets) {
  return cards.map((c, pos) => {
    const k = secrets.k[pos];
    return k ? modpow(c, (secrets.d * k) % Q) : c;
  });
}

/** Takes every listed key off a card; the card, or null if it isn't one. */
export function unlock(cipher, inverses) {
  const exp = inverses.reduce((acc, x) => (acc * x) % Q, 1n);
  return decode(modpow(cipher, exp));
}
