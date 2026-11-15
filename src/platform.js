// Where the game is running, decided once for every module.
//
// IN_APP: inside the Android app (Capacitor) rather than a browser. The
// app is Golden Ace Casino, presented by NVGR Casino; the website stays
// NVGR. (?app=1 shows the app's version in the dev server.)
//
// PHONE_LITE: draw the lighter version of the casino (smaller textures, a
// lower resolution, fewer figures and machines) because the screen is a
// phone's. A phone's browser gets it; the app never does: it plays at full
// quality on every phone.
export const IN_APP = !!(globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform())
  || (import.meta.env.DEV && /[?&]app=1/.test(location.search));

const PHONE_SCREEN = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
export const PHONE_LITE = PHONE_SCREEN && !IN_APP;
