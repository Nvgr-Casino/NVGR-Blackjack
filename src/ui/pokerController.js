import * as THREE from 'three';
import { cardSound, chipSound, shufflerSound } from '../scene/sfx.js';
import { createCard, cardBackMaterial, cardEdgeMaterial, CARD_WIDTH, CARD_HEIGHT } from '../scene/card.js';
import { createValueStack, CHIP_HEIGHT, CHIP_RADIUS } from '../scene/chip.js';
import { createCharacter } from '../scene/character.js';
import { dealerReach } from '../scene/dealer.js';
import { cameraOverride } from '../scene/cameraFocus.js';
import { animate, easeOutCubic, easeInOutCubic } from '../scene/animator.js';
import { isTallScreen } from '../scene/seats.js';
import { m, FLOOR_Y, SEAT_TOP_Y } from '../scene/scale.js';
import { POKER_SEATS_3D as SEATS, POKER_DEALER, BOARD_SPOTS, POT_SPOT, MUCK_SPOT, SHUFFLER } from '../scene/pokerTable.js';

// The Hold'em table's 3D driver: what the table shows, and nothing of the
// rules. src/app/pokerBridge.js watches the room and calls these.
//
// The deck comes from the shuffler in the table: it rises up the
// machine's elevator, shuffled, and the dealer lifts it off and sets it
// down by their hands. They pitch each card low across the felt to its
// seat — a poker dealer does not walk a card round a table this size, they
// slide it — and turn the board from the same deck, burning one first; at
// the end they push the pot to the winner, and every card of the hand is
// swept into the machine, which shuffles while the next hand is waited for. Chips are built from the
// table's own ladder of values, a column a value.

const CARD_Y = 0.04;
const PITCH_MS = 260;          // one card's slide to its seat
const BOARD_MS = 420;
const PUSH_MS = 650;

export function createPokerDriver({ scene, camera, controls, dealer }) {
  const root = new THREE.Group();
  scene.add(root);

  // ---------- seated figures ----------
  const figures = new Map(); // seat -> { id, group }
  let viewSeat = null;
  let followed = false;
  function applySeatCharacter(seatIndex, id) {
    const have = figures.get(seatIndex);
    if (have && have.id === id) return;
    if (have) release(have.group);
    const seat = SEATS[seatIndex];
    const group = createCharacter(id);
    group.position.copy(seat.position);
    group.rotation.y = seat.facingAngle;
    root.add(group);
    figures.set(seatIndex, { id, group });
  }
  function clearSeatCharacter(seatIndex) {
    const have = figures.get(seatIndex);
    if (!have) return;
    release(have.group);
    figures.delete(seatIndex);
  }
  function release(group) {
    root.remove(group);
    if (group.userData.release) group.userData.release();
  }

  // A figure whose head is between the camera and what it is looking at is
  // not drawn, nor one the camera is inside — the whole figure, as at the
  // blackjack table. Otherwise everyone is, you included: from behind your
  // chair you see your own shoulders, and turning the view round shows
  // you in your seat.
  const head = new THREE.Vector3();
  const seg = new THREE.Line3();
  const near = new THREE.Vector3();
  const lookPoint = new THREE.Vector3(0, 0, 0);
  const prior = scene.onBeforeRender;
  scene.onBeforeRender = (...args) => {
    if (root.visible) {
      // Where the camera is aimed: the board, or wherever it was turned to.
      lookPoint.copy(cameraOverride.active ? lookPoint : controls.target);
      // Plates are sized by the screen's height; on a narrow phone that
      // made each a fifth of its width, so they shrink with the aspect.
      const k = Math.max(0.85, Math.min(1, camera.aspect / 0.7));
      labels.forEach((sprite) => sprite.scale.set(0.19 * k, 0.06 * k, 1));
      figures.forEach(({ group }, seatIndex) => {
        const model = group.children[0];
        if (!model) return;
        const seat = SEATS[seatIndex];
        head.copy(seat.position).addScaledVector(seat.outward, -m(0.2)).setY(SEAT_TOP_Y + m(0.72));
        let hidden = camera.position.distanceTo(head) < m(0.35);
        if (!hidden) {
          seg.set(camera.position, lookPoint);
          seg.closestPointToPoint(head, true, near);
          hidden = near.distanceTo(head) < m(0.2);
        }
        model.visible = !hidden;
      });
    }
    prior.apply(scene, args);
  };

  // ---------- camera ----------
  const VIEWS = { wide: { back: m(1.05), height: m(2.3), toDealer: 0.18 }, tall: { back: m(2.4), height: m(3.45), toDealer: 0.05 } };
  function viewFor(seatIndex) {
    const v = isTallScreen() ? VIEWS.tall : VIEWS.wide;
    // Watching without a seat: from in front of the table, between the two
    // front seats.
    const seat = seatIndex === null || seatIndex === undefined ? null : SEATS[seatIndex];
    const out = seat ? seat.outward.clone() : new THREE.Vector3(0, 0, 1);
    const base = seat ? seat.position.clone() : new THREE.Vector3(0, 0, m(1.4));
    const position = base.addScaledVector(out, v.back).setY(FLOOR_Y + v.height);
    // Aimed at the board, drawn a little toward the dealer so they are in
    // the picture too.
    const look = new THREE.Vector3(0, 0.1, 0).lerp(POKER_DEALER.position, v.toDealer);
    return { position, look };
  }
  function followSeat(seatIndex, animated = true) {
    if (seatIndex === viewSeat && followed) return;
    // The first view at a table is a cut, not a sweep from wherever the
    // camera last was.
    if (!followed) animated = false;
    followed = true;
    viewSeat = seatIndex;
    const { position, look } = viewFor(seatIndex);
    lookPoint.copy(look);
    if (!animated) {
      camera.position.copy(position);
      camera.lookAt(look);
      controls.target.copy(look);
      return;
    }
    const from = camera.position.clone();
    const fromLook = controls.target.clone();
    cameraOverride.active = true;
    animate({
      duration: 650,
      easing: easeInOutCubic,
      onUpdate: (t) => {
        camera.position.lerpVectors(from, position, t);
        const l = fromLook.clone().lerp(look, t);
        camera.lookAt(l);
      },
      onComplete: () => {
        camera.position.copy(position);
        controls.target.copy(look);
        camera.lookAt(look);
        cameraOverride.active = false;
      },
    });
  }
  let wasTall = isTallScreen();
  window.addEventListener('resize', () => {
    if (!root.visible || isTallScreen() === wasTall) return;
    wasTall = isTallScreen();
    followSeat(viewSeat, false);
  });

  // ---------- the shuffler's deck ----------
  // One deck, stood on its bottom face so it can rise out of the elevator
  // (scaled up from the lid) and thin as it is dealt from.
  const DECK_H = m(0.028);
  const deckGeo = new THREE.BoxGeometry(CARD_WIDTH, DECK_H, CARD_HEIGHT);
  deckGeo.translate(0, DECK_H / 2, 0);
  const edge = cardEdgeMaterial();
  const deck = new THREE.Mesh(deckGeo, [edge, edge, cardBackMaterial(), edge, edge, edge]);
  deck.castShadow = true;
  root.add(deck);
  const light = new THREE.Mesh(new THREE.BoxGeometry(SHUFFLER.w * 0.42, 0.003, m(0.008)), new THREE.MeshBasicMaterial({ color: 0x3ecf7a }));
  light.position.copy(SHUFFLER.light);
  root.add(light);
  const READY = 0x3ecf7a, BUSY = 0xe0a040;
  let deckState = 'ready';    // 'ready' (up on the elevator) | 'held' (by the dealer) | 'shuffling'
  let deckLeft = 52;
  let deckGen = 0;            // bumped to cancel what was under way
  const deckScale = () => 0.3 + 0.7 * (deckLeft / 52);
  function deckReady() {
    deckState = 'ready';
    deckLeft = 52;
    deck.visible = true;
    deck.position.copy(SHUFFLER.elevator);
    deck.rotation.set(0, 0, 0);
    deck.scale.set(1, 1, 1);
    light.material.color.setHex(READY);
  }
  deckReady();
  if (import.meta.env.DEV) window.__shuffler = { deck, light, state: () => deckState };
  // Up the elevator, out of the lid.
  function raiseDeck(ms = 700) {
    const gen = ++deckGen;
    deckReady();
    deck.scale.y = 0.001;
    animate({ duration: ms, easing: easeInOutCubic, onUpdate: (t) => { if (gen === deckGen) deck.scale.y = Math.max(0.001, t); } });
  }
  // The dealer's left hand to the elevator, and the deck with it to where
  // they deal from. Returns how long that takes.
  function takeDeck() {
    if (deckState === 'held') return 0;
    if (deckState === 'shuffling') raiseDeck(300);
    const gen = deckGen;
    deckState = 'held';
    const from = SHUFFLER.elevator.clone();
    const to = SHUFFLER.hold.clone();
    const lift = from.clone().lerp(to, 0.5).setY(m(0.12));
    dealerReach(dealer, [
      { at: 240, pos: from.clone().setY(DECK_H) },
      { at: 520, pos: lift },
      { at: 760, pos: to.clone().setY(DECK_H) },
    ], { hand: 'left', returnMs: 360 });
    const start = performance.now() + 240;
    animate({
      duration: 760,
      easing: (t) => t,
      onUpdate: () => {
        if (gen !== deckGen) return;
        const t = (performance.now() - start) / 520;
        if (t <= 0) return;
        const e = easeInOutCubic(Math.min(1, t));
        deck.position.lerpVectors(from, to, e);
        deck.position.y = from.y + (to.y - from.y) * e + Math.sin(e * Math.PI) * m(0.1);
        deck.rotation.y = -0.12 * e;
      },
    });
    return 820;
  }
  // The top of the deck, where a card leaves it.
  const deckTop = () => deck.position.clone().setY(deck.position.y + DECK_H * deck.scale.y);
  function drawFromDeck() {
    deckLeft = Math.max(1, deckLeft - 1);
    deck.scale.y = deckScale();
  }

  // ---------- cards ----------
  const hole = new Map();     // seat -> [mesh, mesh]
  let board = [];
  const loose = [];           // burns and mucked cards on their way out

  const holeSpot = (seat, i) => {
    const s = SEATS[seat];
    const across = new THREE.Vector3(s.outward.z, 0, -s.outward.x);
    return s.cardSpot.clone().addScaledVector(across, (i - 0.5) * CARD_WIDTH * 0.62).setY(CARD_Y + i * 0.004);
  };

  // A card slid from the dealer's hands to `to`, face down, turned to `yaw`.
  function pitch(to, yaw, delay = 0) {
    const card = createCard('A', 'S');
    card.userData = { back: true };   // its face is never seen; turnUp swaps it
    card.rotation.set(Math.PI, 0, 0);
    card.visible = false;
    root.add(card);
    setTimeout(() => {
      card.visible = true;
      const from = deckTop();
      drawFromDeck();
      card.position.copy(from);
      const spin = (Math.random() - 0.5) * 0.4;
      // The dealer's right hand sends it, out toward where it is going.
      dealerReach(dealer, [{ at: 120, pos: from.clone().lerp(to, 0.25) }], { returnMs: 260 });
      cardSound(PITCH_MS * 0.8);
      animate({
        duration: PITCH_MS,
        easing: easeOutCubic,
        onUpdate: (t) => {
          card.position.lerpVectors(from, to, t);
          card.position.y = to.y + Math.sin(t * Math.PI) * 0.03;
          card.rotation.y = yaw + spin * (1 - t);
        },
      });
    }, delay);
    return card;
  }

  // Turns a card over where it lies — to its face, the rank and suit given,
  // drawn sharp enough to zoom right in on.
  function turnUp(card, rank, suit, { lift = 0.06, duration = 360 } = {}) {
    const face = createCard(rank, suit, { sharp: true });
    face.position.copy(card.position);
    face.rotation.copy(card.rotation);
    root.remove(card);
    root.add(face);
    const x0 = face.rotation.x;
    const y0 = face.position.y;
    animate({
      duration,
      easing: easeOutCubic,
      onUpdate: (t) => {
        face.rotation.x = x0 * (1 - t);
        face.position.y = y0 + Math.sin(t * Math.PI) * lift;
      },
    });
    return face;
  }

  /** Deals two cards to each seat in `seats` (dealing order), one round at a time. */
  function dealHoleCards(seats) {
    // The deck off the machine first.
    const lead = takeDeck();
    let k = 0;
    for (let round = 0; round < 2; round++) {
      seats.forEach((seat) => {
        const cards = hole.get(seat) || [];
        cards[round] = pitch(holeSpot(seat, round), SEATS[seat].cardAngle, lead + (k++) * (PITCH_MS * 0.55));
        hole.set(seat, cards);
      });
    }
    return lead + k * PITCH_MS * 0.55 + PITCH_MS;
  }

  // Your own two cards, peeked: turned face up where they lie, so you can
  // read them from your seat. Anyone else sees only their backs.
  function revealMine(seat, cards) {
    const meshes = hole.get(seat);
    if (!meshes || meshes.some((c) => !c || !c.userData.back)) return;
    hole.set(seat, meshes.map((mesh, i) => {
      const [rank, suit] = cards[i].split('-');
      const face = turnUp(mesh, rank, suit, { lift: 0.03 });
      face.userData.peek = true;
      return face;
    }));
  }

  /** Turns `seat`'s cards up for the showdown. */
  function showHand(seat, cards) {
    const meshes = hole.get(seat);
    if (!meshes) return;
    hole.set(seat, meshes.map((mesh, i) => {
      // Already face up (your own, peeked): it stays.
      if (mesh && !mesh.userData.back) return mesh;
      const [rank, suit] = cards[i].split('-');
      return turnUp(mesh, rank, suit);
    }));
  }

  /** Slides `seat`'s cards in to the muck: a fold. */
  function muck(seat) {
    const meshes = hole.get(seat);
    if (!meshes) return;
    hole.delete(seat);
    meshes.forEach((mesh) => {
      if (!mesh) return;
      const from = mesh.position.clone();
      const x0 = mesh.rotation.x;
      const to = MUCK_SPOT.clone().setY(0.03 + loose.length * 0.002);
      loose.push(mesh);
      animate({
        duration: 420,
        easing: easeInOutCubic,
        onUpdate: (t) => {
          mesh.position.lerpVectors(from, to, t);
          mesh.position.y += Math.sin(t * Math.PI) * 0.04;
          // Face down as it goes, if it was showing.
          mesh.rotation.x = x0 + (Math.PI - x0) * t;
        },
      });
    });
  }

  /**
   * Turns the board up to `cards` (all of it so far): a burn card first for
   * each street, then the new cards, one after another.
   */
  function dealBoard(cards) {
    const start = board.length;
    if (cards.length <= start) return 0;
    // The burn, off the top of the deck.
    const lead = takeDeck();
    const burn = createCard('A', 'S');
    burn.rotation.set(Math.PI, 0, 0);
    burn.visible = false;
    root.add(burn);
    loose.push(burn);
    const burnTo = MUCK_SPOT.clone().setY(0.03 + loose.length * 0.002);
    setTimeout(() => {
      const from = deckTop();
      drawFromDeck();
      burn.position.copy(from);
      burn.visible = true;
      animate({ duration: 260, easing: easeOutCubic, onUpdate: (t) => burn.position.lerpVectors(from, burnTo, t) });
    }, lead);
    let delay = lead + 260;
    for (let i = start; i < cards.length; i++) {
      const spot = BOARD_SPOTS[i];
      const [rank, suit] = cards[i].split('-');
      const d = delay;
      const back = pitch(spot, 0, d);
      board[i] = back;
      setTimeout(() => {
        if (board[i] !== back) return;
        board[i] = turnUp(back, rank, suit);
      }, d + PITCH_MS);
      delay += BOARD_MS * 0.6;
    }
    return delay + PITCH_MS + 360;
  }

  // ---------- chips ----------
  let ladder = [100];
  /** The table's chip values, smallest first. */
  function setLadder(values) { ladder = values.slice().sort((a, b) => a - b); }

  // Chips for `amount`, largest values first, a column a value, the columns
  // side by side — as a player stacks a bet.
  function chipsFor(amount, maxColumn = 10) {
    const group = new THREE.Group();
    let rest = amount;
    let col = 0;
    for (let i = ladder.length - 1; i >= 0 && rest > 0; i--) {
      let n = Math.floor(rest / ladder[i]);
      if (!n) continue;
      rest -= n * ladder[i];
      while (n > 0) {
        const c = Math.min(n, maxColumn);
        const stack = createValueStack(ladder[i], i, c);
        stack.position.x = col * CHIP_RADIUS * 2.1;
        group.add(stack);
        col++;
        n -= c;
      }
    }
    // Centred over its spot.
    group.children.forEach((c) => { c.position.x -= ((col - 1) * CHIP_RADIUS * 2.1) / 2; });
    group.userData.amount = amount;
    return group;
  }

  const bets = new Map();    // seat -> group
  const stacks = new Map();  // seat -> group
  let pot = null;

  function place(group, spot, seatIndex = null) {
    group.position.copy(spot);
    if (seatIndex !== null) group.rotation.y = SEATS[seatIndex].facingAngle;
    root.add(group);
  }
  function slide(group, to, duration, onDone) {
    const from = group.position.clone();
    animate({
      duration,
      easing: easeInOutCubic,
      onUpdate: (t) => { group.position.lerpVectors(from, to, t); group.position.y = from.y + (to.y - from.y) * t + Math.sin(t * Math.PI) * 0.05; },
      onComplete: () => { chipSound(3); if (onDone) onDone(); },
    });
  }
  const dispose = (group) => { if (group) root.remove(group); };

  /** Each seat's bet in front of them on this street. */
  function setBets(amounts) {
    SEATS.forEach((s) => {
      const want = amounts[s.index] || 0;
      const have = bets.get(s.index);
      if ((have ? have.userData.amount : 0) === want) return;
      dispose(have);
      bets.delete(s.index);
      if (!want) return;
      const g = chipsFor(want);
      place(g, s.stackSpot, s.index);
      bets.set(s.index, g);
      slide(g, s.betSpot, 360);
    });
  }

  /** The bets swept in to the middle at the end of a street; the pot. */
  function gatherBets(potAmount) {
    bets.forEach((g) => slide(g, POT_SPOT, 420, () => dispose(g)));
    bets.clear();
    setTimeout(() => setPot(potAmount), bets.size ? 440 : 0);
  }
  function setPot(amount) {
    if (pot && pot.userData.amount === amount) return;
    dispose(pot);
    pot = amount ? chipsFor(amount, 14) : null;
    if (pot) place(pot, POT_SPOT);
  }

  /** The pot pushed to the winners: [{ seat, amount }]. */
  function pushPot(awards) {
    if (pot) { dispose(pot); pot = null; }
    awards.forEach(({ seat, amount }, i) => {
      const g = chipsFor(amount, 14);
      place(g, POT_SPOT.clone());
      setTimeout(() => {
        dealerReach(dealer, [
          { at: 200, pos: POT_SPOT },
          { at: 200 + PUSH_MS * 0.6, pos: POT_SPOT.clone().lerp(SEATS[seat].betSpot, 0.45) },
        ], { returnMs: 300 });
        slide(g, SEATS[seat].stackSpot, PUSH_MS, () => dispose(g));
      }, i * 500);
    });
  }

  /** The chips each player has behind, by their place at the rail. */
  function setStacks(amounts) {
    SEATS.forEach((s) => {
      const want = amounts[s.index];
      const have = stacks.get(s.index);
      if (have && have.userData.amount === want) return;
      dispose(have);
      stacks.delete(s.index);
      if (!want) return;
      const g = chipsFor(want, 12);
      place(g, s.stackSpot, s.index);
      g.scale.setScalar(0.85);
      stacks.set(s.index, g);
    });
  }

  // ---------- the dealer button ----------
  const button = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2efe8';
    ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1b1b1b';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = "700 58px Cinzel, Georgia, serif";
    ctx.fillText('DEALER', 128, 132);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    const side = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 });
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(CHIP_RADIUS * 1.25, CHIP_RADIUS * 1.25, 0.03, 40), [side, top, top]);
    puck.castShadow = true;
    puck.visible = false;
    root.add(puck);
    return puck;
  })();
  function setButton(seatIndex) {
    if (seatIndex === null || seatIndex === undefined) { button.visible = false; return; }
    const to = SEATS[seatIndex].buttonSpot.clone().setY(0.025);
    if (!button.visible) { button.position.copy(to); button.visible = true; return; }
    const from = button.position.clone();
    animate({ duration: 500, easing: easeInOutCubic, onUpdate: (t) => button.position.lerpVectors(from, to, t) });
  }

  // ---------- seat labels ----------
  // Name and stack on a small plate above each player's place, with the
  // last thing they did; the one to act edged in brass.
  const labels = new Map();
  function labelSprite() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // The same size on screen however near or far the seat: a plate by the
    // camera no longer fills the view, nor one across the table shrink away.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    sprite.scale.set(0.19, 0.06, 1);
    sprite.renderOrder = 10;
    sprite.userData = { canvas: c, tex, key: '' };
    root.add(sprite);
    return sprite;
  }
  function setLabels(info) {
    SEATS.forEach((s) => {
      // Not your own: the camera is right behind it, and you have the HUD.
      const d = s.index === viewSeat ? null : info[s.index];
      let sprite = labels.get(s.index);
      if (!d) { if (sprite) sprite.visible = false; return; }
      if (!sprite) { sprite = labelSprite(); labels.set(s.index, sprite); }
      sprite.visible = true;
      sprite.position.copy(s.position).addScaledVector(s.outward, -m(0.05)).setY(SEAT_TOP_Y + m(1.08));
      const key = [d.name, d.stack, d.action, d.active, d.folded, d.away].join('|');
      if (sprite.userData.key === key) return;
      sprite.userData.key = key;
      const ctx = sprite.userData.canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 160);
      ctx.globalAlpha = d.folded || d.away ? 0.55 : 1;
      ctx.fillStyle = 'rgba(14,12,11,0.82)';
      ctx.beginPath(); ctx.roundRect(6, 6, 500, 148, 26); ctx.fill();
      if (d.active) { ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 8; ctx.stroke(); }
      ctx.fillStyle = '#efe8de';
      ctx.textAlign = 'center';
      ctx.font = "600 46px Inter, Arial, sans-serif";
      ctx.fillText(d.name.slice(0, 16), 256, 62);
      ctx.fillStyle = d.action ? '#c8a46a' : '#a1988d';
      ctx.font = "600 38px Inter, Arial, sans-serif";
      ctx.fillText(d.action ? d.action : d.stack.toLocaleString(), 256, 120);
      ctx.globalAlpha = 1;
      sprite.userData.tex.needsUpdate = true;
    });
  }

  /** Everything of the last hand off the felt, ready for the next. */
  // Every card of the hand swept into the shuffler's intake, and down into
  // it; the rest of the deck after them. The machine shuffles — its light
  // amber, a soft whirr — and a fresh deck rises for the next hand.
  const SHUFFLE_MS = 2400;
  function clearHand() {
    const gone = [...hole.values()].flat().concat(board, loose).filter(Boolean);
    const intake = SHUFFLER.intake.clone();
    gone.forEach((card, i) => {
      const from = card.position.clone();
      const x0 = card.rotation.x;
      const y0 = card.rotation.y;
      const wait = Math.min(i * 25, 300);
      const t0 = performance.now() + wait;
      animate({
        duration: 520 + wait,
        easing: (t) => t,
        onUpdate: () => {
          const t = Math.max(0, Math.min(1, (performance.now() - t0) / 520));
          if (!t) return;
          const e = easeInOutCubic(t);
          card.position.lerpVectors(from, intake, e);
          card.position.y += Math.sin(e * Math.PI) * 0.03;
          // Face down and square to the slot as it goes; then down into it.
          card.rotation.x = x0 + (Math.PI - x0) * e;
          card.rotation.y = y0 * (1 - e);
          if (t > 0.85) card.position.y = intake.y - ((t - 0.85) / 0.15) * 0.03;
        },
        onComplete: () => root.remove(card),
      });
    });
    if (gone.length || deckState === 'held') {
      const gen = ++deckGen;
      const left = deck.position.clone();
      const wasHeld = deckState === 'held';
      deckState = 'shuffling';
      light.material.color.setHex(BUSY);
      if (wasHeld) {
        animate({
          duration: 520,
          easing: easeInOutCubic,
          onUpdate: (t) => {
            if (gen !== deckGen) return;
            deck.position.lerpVectors(left, intake, t);
            deck.position.y += Math.sin(t * Math.PI) * 0.04;
            deck.rotation.y *= 1 - t;
            if (t > 0.8) deck.scale.y = Math.max(0.001, deckScale() * (1 - (t - 0.8) / 0.2));
          },
          onComplete: () => { if (gen === deckGen) deck.visible = false; },
        });
      } else {
        deck.visible = false;
      }
      setTimeout(() => { if (gen === deckGen && root.visible) shufflerSound(SHUFFLE_MS - 900); }, 600);
      setTimeout(() => { if (gen === deckGen) raiseDeck(); }, SHUFFLE_MS);
    }
    hole.clear();
    board = [];
    loose.length = 0;
    bets.forEach((g) => dispose(g));
    bets.clear();
    setPot(0);
  }

  function setVisible(v) {
    root.visible = v;
    if (!v) { followed = false; deckGen++; deckReady(); }
  }

  return {
    applySeatCharacter, clearSeatCharacter, followSeat,
    dealHoleCards, revealMine, showHand, muck, dealBoard,
    setLadder, setBets, gatherBets, setPot, pushPot, setStacks,
    setButton, setLabels, clearHand, setVisible,
    hasHole: (seat) => hole.has(seat),
    boardCount: () => board.length,
    card: { width: CARD_WIDTH, height: CARD_HEIGHT },
  };
}
