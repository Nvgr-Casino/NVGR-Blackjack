// Private messages between two players through a room everyone can read:
// each player publishes an ECDH public key for the hand, and a message to
// one of them is sealed with AES-GCM under the key the two share — which
// no one else can derive. This is how a player's hole-card keys reach them
// (mentalPoker.js) without the room, or anyone reading it, learning them.
// Web Crypto, so the keys never leave the browser's own key store except
// as the JWK kept for a reload.

const subtle = () => globalThis.crypto.subtle;
const CURVE = { name: 'ECDH', namedCurve: 'P-256' };

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

/** A new key pair; extractable so it can be kept across a reload. */
export async function newKeyPair() {
  return subtle().generateKey(CURVE, true, ['deriveKey']);
}

export async function exportKeyPair(pair) {
  return JSON.stringify({
    pub: await subtle().exportKey('jwk', pair.publicKey),
    priv: await subtle().exportKey('jwk', pair.privateKey),
  });
}
export async function importKeyPair(text) {
  const { pub, priv } = JSON.parse(text);
  return {
    publicKey: await subtle().importKey('jwk', pub, CURVE, true, []),
    privateKey: await subtle().importKey('jwk', priv, CURVE, true, ['deriveKey']),
  };
}

/** The public half, as a string to put in the room. */
export async function publicKeyText(pair) {
  return JSON.stringify(await subtle().exportKey('jwk', pair.publicKey));
}

const shared = new Map();
async function sharedKey(myPrivate, theirPublicText) {
  const cacheKey = theirPublicText;
  if (shared.has(cacheKey) && shared.get(cacheKey).priv === myPrivate) return shared.get(cacheKey).key;
  const theirs = await subtle().importKey('jwk', JSON.parse(theirPublicText), CURVE, false, []);
  const key = await subtle().deriveKey({ name: 'ECDH', public: theirs }, myPrivate, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  shared.set(cacheKey, { priv: myPrivate, key });
  return key;
}

/** Seals `value` (anything JSON) for the holder of `theirPublicText`. */
export async function seal(myPair, theirPublicText, value) {
  const key = await sharedKey(myPair.privateKey, theirPublicText);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: b64(iv), ct: b64(ct) };
}

/** Opens a message sealed for us by the holder of `theirPublicText`. */
export async function open(myPair, theirPublicText, box) {
  const key = await sharedKey(myPair.privateKey, theirPublicText);
  const data = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return JSON.parse(new TextDecoder().decode(data));
}
