// Rummy's table in 3D: the Hold'em table with its Rummy felt, the players
// in their chairs (pokerController.js does the figures, their plates and
// the camera), and the cards of the deal — each player's thirteen fanned
// face down in front of them, the closed deck in the middle with the wild
// joker turned sideways under it, the open pile beside it. Draws and
// discards slide between them; at the end every hand is laid face up.
// Your own hand is in the HUD, not on the felt in front of the camera.

import * as THREE from 'three';
import { createPokerDriver } from './pokerController.js';
import { createCard, cardBackMaterial, cardEdgeMaterial, CARD_WIDTH, CARD_HEIGHT } from '../scene/card.js';
import { cardSound } from '../scene/sfx.js';
import { dealerReach } from '../scene/dealer.js';
import { animate, easeOutCubic, easeInOutCubic } from '../scene/animator.js';
import { m } from '../scene/scale.js';
import { POKER_SEATS_3D as SEATS, RUMMY_SPOTS } from '../scene/pokerTable.js';

const face = (id) => { const f = id.split('#')[0].split('-'); return [f[0], f[1]]; };

export function createRummyDriver(handles) {
  const base = createPokerDriver(handles);
  const { scene, dealer } = handles;
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ---------- the closed deck ----------
  const DECK_H = m(0.035);
  const deckGeo = new THREE.BoxGeometry(CARD_WIDTH, DECK_H, CARD_HEIGHT);
  deckGeo.translate(0, DECK_H / 2, 0);
  const edge = cardEdgeMaterial();
  const deck = new THREE.Mesh(deckGeo, [edge, edge, cardBackMaterial(), edge, edge, edge]);
  deck.castShadow = true;
  deck.visible = false;
  deck.position.copy(RUMMY_SPOTS.deck);
  root.add(deck);
  const deckTop = () => deck.position.clone().setY(deck.position.y + DECK_H * deck.scale.y + 0.004);
  function setDeckCount(n) { deck.visible = n > 0; deck.scale.y = Math.max(0.05, n / 80); }

  let joker = null;
  const pile = [];            // meshes, bottom to top
  const fans = new Map();     // seat -> [mesh]
  const laid = [];
  let mySeat = null;

  const across = (seat) => { const s = SEATS[seat]; return new THREE.Vector3(s.outward.z, 0, -s.outward.x); };
  // A seat's cards, fanned face down a little toward the middle.
  function fanSpot(seat, i, n) {
    const s = SEATS[seat];
    const off = i - (n - 1) / 2;
    return s.cardSpot.clone().addScaledVector(s.outward, -m(0.04)).addScaledVector(across(seat), off * CARD_WIDTH * 0.16).setY(0.035 + i * 0.0016);
  }
  const fanYaw = (seat, i, n) => SEATS[seat].cardAngle + (i - (n - 1) / 2) * 0.035;
  function relayFan(seat, ms = 220) {
    const cards = fans.get(seat) || [];
    cards.forEach((c, i) => {
      const from = c.position.clone(), to = fanSpot(seat, i, cards.length);
      const y0 = c.rotation.y, y1 = fanYaw(seat, i, cards.length);
      animate({ duration: ms, easing: easeInOutCubic, onUpdate: (t) => { c.position.lerpVectors(from, to, t); c.rotation.y = y0 + (y1 - y0) * t; } });
    });
  }

  function card(id, up) {
    const [r, s] = id ? face(id) : ['A', 'S'];
    const c = createCard(r, s);
    c.rotation.set(up ? 0 : Math.PI, 0, 0);
    c.userData.id = id;
    root.add(c);
    return c;
  }
  // A card slid from `from` to `to`, turning to `up` (face up) on the way.
  function slide(c, to, { yaw = 0, up = false, ms = 300, lift = 0.05, onDone } = {}) {
    const from = c.position.clone();
    const x0 = c.rotation.x, x1 = up ? 0 : Math.PI;
    const y0 = c.rotation.y;
    animate({
      duration: ms, easing: easeOutCubic,
      onUpdate: (t) => {
        c.position.lerpVectors(from, to, t);
        c.position.y += Math.sin(t * Math.PI) * lift;
        c.rotation.x = x0 + (x1 - x0) * t;
        c.rotation.y = y0 + (yaw - y0) * t;
      },
      onComplete: onDone,
    });
  }
  function pileSpot(i) {
    // A little untidy, as a real pile is.
    const j = (i * 7919) % 13;
    return RUMMY_SPOTS.pile.clone().add(new THREE.Vector3((j - 6) * 0.0012, 0.03 + Math.min(i, 8) * 0.002, ((j * 3) % 13 - 6) * 0.0012));
  }
  const pileYaw = (i) => (((i * 31) % 17) - 8) * 0.012;
  function pushPile(c) {
    pile.push(c);
    while (pile.length > 8) root.remove(pile.shift());
  }

  // ---------- the deal ----------
  /** Deals thirteen to each seat (in order), then turns the wild joker and the first open card. */
  function deal(seats, me, wildCard, openCard, closedCount) {
    clear();
    mySeat = me;
    root.visible = true;
    deck.visible = true;
    setDeckCount(closedCount + seats.length * 13 + 1);
    let k = 0;
    const step = 50;
    for (let i = 0; i < 13; i++) {
      seats.forEach((seat) => {
        const delay = 300 + k++ * step;
        setTimeout(() => {
          if (!root.visible) return;
          const c = card(null, false);
          c.position.copy(deckTop());
          if (seat === me) {
            // Yours go toward you and into your hand.
            slide(c, SEATS[seat].cardSpot.clone().setY(0.05), { yaw: SEATS[seat].cardAngle, ms: 260, onDone: () => root.remove(c) });
          } else {
            const list = fans.get(seat) || [];
            fans.set(seat, list);
            list.push(c);
            slide(c, fanSpot(seat, i, 13), { yaw: fanYaw(seat, i, 13), ms: 260 });
          }
          if (k % 4 === 0) cardSound(160);
          setDeckCount(Math.max(1, closedCount + 1 + (seats.length * 13 - Math.round((delay - 300) / step))));
        }, delay);
      });
    }
    if (dealer) dealerReach(dealer, [{ at: 200, pos: RUMMY_SPOTS.deck.clone().setY(0.1) }], { returnMs: 400 });
    const after = 300 + k * step + 300;
    setTimeout(() => {
      if (!root.visible) return;
      // The wild joker, turned and laid sideways half under the deck.
      joker = card(wildCard, false);
      joker.position.copy(deckTop());
      slide(joker, RUMMY_SPOTS.joker.clone().setY(0.028), { yaw: Math.PI / 2, up: true, ms: 420 });
      const o = card(openCard, false);
      o.position.copy(deckTop());
      setTimeout(() => slide(o, pileSpot(0), { yaw: pileYaw(0), up: true, ms: 380 }), 260);
      pushPile(o);
      setDeckCount(closedCount);
    }, after);
    return after + 700;
  }

  // ---------- turns ----------
  const seatTo = (seat) => (seat === mySeat ? SEATS[seat].cardSpot.clone().setY(0.05) : null);
  /** `seat` draws: from the deck, or the top of the open pile. */
  function draw(seat, fromPile, closedCount) {
    let c;
    if (fromPile && pile.length) c = pile.pop();
    else { c = card(null, false); c.position.copy(deckTop()); setDeckCount(closedCount); }
    cardSound(200);
    if (seat === mySeat) { slide(c, seatTo(seat), { yaw: SEATS[seat].cardAngle, ms: 320, onDone: () => root.remove(c) }); return; }
    const list = fans.get(seat) || [];
    fans.set(seat, list);
    list.push(c);
    slide(c, fanSpot(seat, list.length - 1, list.length), { yaw: fanYaw(seat, list.length - 1, list.length), ms: 340 });
    setTimeout(() => relayFan(seat), 200);
  }
  /** `seat` throws `id` onto the open pile, face up. */
  function discard(seat, id) {
    let c;
    if (seat === mySeat) { c = card(id, false); c.position.copy(seatTo(seat)); }
    else {
      const list = fans.get(seat) || [];
      const old = list.pop();
      const at = old ? old.position.clone() : SEATS[seat].cardSpot.clone();
      if (old) root.remove(old);
      c = card(id, false);
      c.position.copy(at);
      c.rotation.y = SEATS[seat].cardAngle;
      setTimeout(() => relayFan(seat), 120);
    }
    const i = pile.length;
    pushPile(c);
    cardSound(180);
    slide(c, pileSpot(i), { yaw: pileYaw(i), up: true, ms: 360 });
  }
  /** `seat` drops: their cards pushed face down to the middle. */
  function drop(seat) {
    const list = fans.get(seat) || [];
    list.forEach((c, i) => slide(c, SEATS[seat].cardSpot.clone().lerp(new THREE.Vector3(0, 0, 0), 0.3).setY(0.035 + i * 0.001), { yaw: SEATS[seat].cardAngle, ms: 380 }));
  }
  /** The end: every hand laid face up in its groups in front of its player. */
  function reveal(bySeat) {
    Object.entries(bySeat).forEach(([seatStr, groups]) => {
      const seat = Number(seatStr);
      (fans.get(seat) || []).forEach((c) => root.remove(c));
      fans.delete(seat);
      if (seat === mySeat) return;
      const flat = [];
      groups.forEach((g, gi) => g.forEach((id) => flat.push({ id, gap: gi })));
      const n = flat.length;
      flat.forEach(({ id, gap }, i) => {
        const c = card(id, false);
        c.position.copy(SEATS[seat].cardSpot).setY(0.04);
        const off = (i - (n - 1) / 2) * CARD_WIDTH * 0.3 + (gap - (groups.length - 1) / 2) * CARD_WIDTH * 0.25;
        const to = SEATS[seat].cardSpot.clone().addScaledVector(SEATS[seat].outward, -m(0.06)).addScaledVector(across(seat), off).setY(0.03 + i * 0.0015);
        laid.push(c);
        setTimeout(() => slide(c, to, { yaw: SEATS[seat].cardAngle, up: true, ms: 420 }), i * 40);
      });
    });
  }

  function clear() {
    [...fans.values()].flat().concat(pile, laid, joker ? [joker] : []).forEach((c) => root.remove(c));
    fans.clear();
    pile.length = 0;
    laid.length = 0;
    joker = null;
    deck.visible = false;
  }
  function setVisible(v) {
    root.visible = v;
    base.setVisible(v);
    if (!v) clear();
  }

  return {
    applySeatCharacter: base.applySeatCharacter, clearSeatCharacter: base.clearSeatCharacter,
    followSeat: base.followSeat, setLabels: base.setLabels, setButton: base.setButton,
    deal, draw, discard, drop, reveal, clear, setVisible, setDeckCount,
  };
}
