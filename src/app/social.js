// Friends, presence and direct messages.
//
// Data shape in Realtime Database:
//   users/<key>              { name, online, lastSeen }   public directory
//   friendRequests/<to>/<from> { name, at }               pending invites
//   friends/<key>/<other>    { name, since }              accepted, both ways
//   dms/<threadId>/<pushId>  { from, name, text, at }     the conversation
//   dmInbox/<to>/<from>      { name, preview, at }        unread marker
//
// Messages live in the database rather than in a session, so anything sent
// while someone is offline is simply waiting for them next time they open
// the app.
import { ref, set, push, update, remove, onValue, onDisconnect } from 'firebase/database';
import { db } from '../firebase/config.js';
import { safeKey } from './roomLogic.js';
import { session, refresh } from './session.js';

export let friends = [];      // [{ key, name, online, lastSeen }]
export let requests = [];     // [{ key, name, at }]
export let inbox = {};        // friendKey -> { name, preview, at }
export let dmWith = null;     // { key, name }
export let dmMessages = [];
export let socialNotice = '';

let unsubs = [];
let dmUnsub = null;
const watchedUsers = new Set();

export function setSocialNotice(text) { socialNotice = text; refresh(); }

// Both halves of a conversation share one thread, so the id has to be the
// same whichever side builds it.
export function threadId(a, b) { return [a, b].sort().join('__'); }

export function initSocial() {
  stopSocial();
  if (!session.uid) return;
  const me = safeKey(session.uid);

  // Presence: mark this player online now, and let the server mark them
  // offline if the connection drops without a clean sign-out.
  const meRef = ref(db, 'users/' + me);
  unsubs.push(onValue(ref(db, '.info/connected'), (snap) => {
    if (!snap.val()) return;
    onDisconnect(meRef).update({ online: false, lastSeen: Date.now() })
      .then(() => update(meRef, { name: session.name, online: true, lastSeen: Date.now() }))
      .catch(() => {});
  }));

  unsubs.push(onValue(ref(db, 'friends/' + me), (snap) => {
    const val = snap.val() || {};
    const known = new Map(friends.map((f) => [f.key, f]));
    friends = Object.keys(val).map((k) => known.get(k) || { key: k, name: val[k].name, online: false, lastSeen: 0 });
    friends.forEach((f) => { if (val[f.key] && val[f.key].name) f.name = val[f.key].name; });
    refresh();
    Object.keys(val).forEach(watchUser);
  }));

  unsubs.push(onValue(ref(db, 'friendRequests/' + me), (snap) => {
    const val = snap.val() || {};
    requests = Object.entries(val).map(([key, r]) => ({ key, name: r.name, at: r.at }));
    refresh();
  }));

  unsubs.push(onValue(ref(db, 'dmInbox/' + me), (snap) => {
    inbox = snap.val() || {};
    refresh();
  }));
}

function watchUser(key) {
  if (watchedUsers.has(key)) return;
  watchedUsers.add(key);
  unsubs.push(onValue(ref(db, 'users/' + key), (snap) => {
    const v = snap.val() || {};
    const f = friends.find((x) => x.key === key);
    if (!f) return;
    f.online = !!v.online;
    f.lastSeen = v.lastSeen || 0;
    if (v.name) f.name = v.name;
    refresh();
  }));
}

export function stopSocial() {
  unsubs.forEach((u) => { try { u(); } catch (e) { /* already detached */ } });
  unsubs = [];
  if (dmUnsub) { dmUnsub(); dmUnsub = null; }
  watchedUsers.clear();
  friends = []; requests = []; inbox = {}; dmMessages = []; dmWith = null;
}

export async function goOffline() {
  if (!session.uid) return;
  await update(ref(db, 'users/' + safeKey(session.uid)), { online: false, lastSeen: Date.now() }).catch(() => {});
}

export function isFriend(key) { return friends.some((f) => f.key === key); }
export function requestPending(key) { return requests.some((r) => r.key === key); }

export async function sendFriendRequest(toKey, toName) {
  const me = safeKey(session.uid);
  if (!toKey || toKey === me || isFriend(toKey)) return;
  await set(ref(db, `friendRequests/${toKey}/${me}`), { name: session.name, at: Date.now() });
  setSocialNotice('Friend request sent to ' + toName + '.');
}

export async function acceptRequest(fromKey, fromName) {
  const me = safeKey(session.uid);
  // Both sides of the friendship are written together so a half-accepted
  // state can't survive a dropped connection.
  await update(ref(db), {
    [`friends/${me}/${fromKey}`]: { name: fromName, since: Date.now() },
    [`friends/${fromKey}/${me}`]: { name: session.name, since: Date.now() },
    [`friendRequests/${me}/${fromKey}`]: null,
  });
  setSocialNotice('You and ' + fromName + ' are now friends.');
}

export async function declineRequest(fromKey) {
  const me = safeKey(session.uid);
  await remove(ref(db, `friendRequests/${me}/${fromKey}`));
}

export async function removeFriend(key) {
  const me = safeKey(session.uid);
  await update(ref(db), {
    [`friends/${me}/${key}`]: null,
    [`friends/${key}/${me}`]: null,
  });
}

export function openDm(friendKey, name) {
  dmWith = { key: friendKey, name };
  dmMessages = [];
  session.screen = 'dm';
  const t = threadId(safeKey(session.uid), friendKey);
  if (dmUnsub) dmUnsub();
  dmUnsub = onValue(ref(db, 'dms/' + t), (snap) => {
    const val = snap.val() || {};
    dmMessages = Object.entries(val)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.at || 0) - (b.at || 0));
    refresh();
  });
  markRead(friendKey);
  refresh();
}

export function closeDm() {
  if (dmUnsub) { dmUnsub(); dmUnsub = null; }
  dmWith = null;
  dmMessages = [];
  session.screen = 'friends';
  refresh();
}

async function markRead(friendKey) {
  const me = safeKey(session.uid);
  await remove(ref(db, `dmInbox/${me}/${friendKey}`)).catch(() => {});
}

export async function sendDm(text) {
  const body = (text || '').trim().slice(0, 500);
  if (!body || !dmWith) return;
  const me = safeKey(session.uid);
  const t = threadId(me, dmWith.key);
  await push(ref(db, 'dms/' + t), { from: me, name: session.name, text: body, at: Date.now() });
  // The unread marker is what lights up the other player's Friends button
  // next time they open the app.
  await set(ref(db, `dmInbox/${dmWith.key}/${me}`), {
    name: session.name, preview: body.slice(0, 60), at: Date.now(),
  });
}

export function unreadCount() { return Object.keys(inbox || {}).length; }
export function badgeCount() { return unreadCount() + requests.length; }

export function lastSeenLabel(f) {
  if (f.online) return 'Online';
  if (!f.lastSeen) return 'Offline';
  const mins = Math.floor((Date.now() - f.lastSeen) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}
