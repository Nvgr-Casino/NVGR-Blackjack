// The Smithsonian scan shows Discovery as she stands in the museum, wheels
// down. In flight they are stowed, so the landing gear and its open doors
// are cut away: every triangle lying below the belly where the gear hangs.
// The scan's axes: x across the wings, y up, z along the craft, nose at +z;
// metres.
const belly = (z, pts) => {
  for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) {
    const [z0, y0] = pts[i - 1], [z1, y1] = pts[i];
    return y0 + ((z - z0) / (z1 - z0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
};
// Main gear: under the wing roots. Nose gear: under the forward fuselage.
const REGIONS = [
  { z: [-9, 0.5], x: [0.6, 6.5], belly: [[-9, -5.75], [-6, -5.6], [-3, -5.35], [0.5, -5.15]] },
  { z: [12, 17.5], x: [0, 1.6], belly: [[12, -4.3], [14, -4.15], [16, -3.95], [17.5, -3.75]] },
];
export function cutGear(doc, margin = 0.12) {
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices();
  const ia = idx.getArray();
  const below = (v) => {
    const x = Math.abs(pos[v * 3]), y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    return REGIONS.some((r) => z >= r.z[0] && z <= r.z[1] && x >= r.x[0] && x <= r.x[1] && y < belly(z, r.belly) - margin);
  };
  const keep = [];
  let cut = 0;
  for (let t = 0; t < ia.length; t += 3) {
    if (below(ia[t]) && below(ia[t + 1]) && below(ia[t + 2])) { cut++; continue; }
    keep.push(ia[t], ia[t + 1], ia[t + 2]);
  }
  idx.setArray(new Uint32Array(keep));
  return `landing gear cut: ${cut} triangles`;
}
