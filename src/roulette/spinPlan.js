// How a spin unfolds, as a real wheel's does — the same for every client,
// drawn from a seed the spin itself carries (its start and its number), so
// the picture (src/scene/rouletteWheel.js) and the sound (src/scene/sfx.js)
// follow one plan and everyone at the table sees and hears the same run.
//
// The croupier sends the ball clockwise round the rim, against the rotor
// turning the other way, fast enough for twenty-odd laps. It slows on the
// rim until it can no longer hold it — always at about the same speed, so
// only the time it spends there varies — then spirals down the sloping
// track, strikes one of the diamonds, and falls onto the rotor, where it
// bounces from pocket to pocket, each hop shorter and lower than the one
// before, and settles. All of it takes about sixteen seconds.

// A small seeded generator (mulberry32): the same seed, the same run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedFor = (start, number) => ((Math.floor(start) % 2147483647) ^ Math.imul(number + 1, 2654435761)) >>> 0;

// The radius, in metres from the wheel's centre, of the pockets the ball
// settles in (inside the ring of numbers).
export const POCKET_R = 0.241;
export const LEAVE_SPEED = 5.6;   // rad/s: the ball's pace as it leaves the rim (under a lap a second)

// Times are seconds from the spin's start.
export function spinPlan(seed) {
  const r = rng(seed);
  const launch = r() * Math.PI * 2;        // where the croupier lets it go
  const w0 = 14.5 + r() * 2.5;             // rad/s at launch: about two and a half laps a second
  const T1 = 10.6 + r() * 1.6;             // on the rim
  const spiral = 1.25 + r() * 0.35;        // down the track
  const T2 = T1 + spiral;                  // onto the rotor
  const TD = T1 + spiral * 0.7;            // the diamond it strikes on the way
  const hops = [];
  let t = T2;
  let d = 0.5 + r() * 0.12;
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const dur = d * (0.85 + r() * 0.3);
    // Where each hop comes down, from the wheel's centre (metres): the first
    // skip over the numbers' ring, the last few drop into the pockets'
    // ring inside it, the very last into the pocket itself.
    const land = i === n - 1 ? POCKET_R : i >= n - 3 ? 0.232 + r() * 0.02 : 0.262 + r() * 0.07;
    hops.push({ t0: t, dur, h: 0.03 * Math.pow(0.68, i) * (0.8 + r() * 0.4), jitter: (r() * 2 - 1) * (1 - i / n), r: land });
    t += dur;
    d *= 0.76;
  }
  const T3 = t;                            // settled
  const turns = 1.6 + r() * 2;             // how far round the rotor, in half turns, the bounces carry it
  return { launch, w0, wLeave: LEAVE_SPEED, T1, spiral, T2, TD, hops, T3, turns };
}

// The ball's angle round the wheel (world, radians, increasing clockwise
// seen from above) and its speed, while on the rim and down the track.
export function ballRun(plan, t) {
  const { launch, w0, wLeave, T1, spiral } = plan;
  if (t <= T1) {
    const a = (w0 - wLeave) / T1;
    return { angle: launch + w0 * t - 0.5 * a * t * t, speed: w0 - a * t };
  }
  const atT1 = launch + w0 * T1 - 0.5 * ((w0 - wLeave) / T1) * T1 * T1;
  const s = Math.min(t - T1, spiral);
  const a2 = (0.3 * wLeave) / spiral;
  return { angle: atT1 + wLeave * s - 0.5 * a2 * s * s, speed: wLeave - a2 * s };
}
