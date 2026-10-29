# Third-party art

**Characters and their animations** — Microsoft Rocketbox Avatar Library,
https://github.com/microsoft/Microsoft-Rocketbox, MIT licence (copy in
`rocketbox-LICENSE.md`). Imported into `public/models/characters/rb_*.glb`
by `scripts/import-rocketbox.mjs`. The higher-limit dealers are Rocketbox
avatars re-dyed (`scripts/dealer-recolor.mjs`) and, for the waistcoat
figure, given another avatar's head and hair (`scripts/transplant-head.mjs`):

| File | Body | Head |
|---|---|---|
| rb_dealer_m3 | Business_Male_04 | Male_Adult_20 |
| rb_dealer_m4 | Business_Male_04, black waistcoat | Male_Adult_07 |
| rb_dealer_m5 | Business_Male_04, burgundy waistcoat | Male_Adult_03 |
| rb_dealer_f4 | Female_Adult_13, black | — |
| rb_dealer_f5 | Female_Adult_11, black dress | — |

**Penthouse skyline** — "Shanghai Bund" by Greg Zaal, Poly Haven, CC0. The
sky-and-skyline band of its tonemapped panorama, in
`public/assets/skyline/night_skyline.webp`.

**Furniture and props** — Poly Haven, https://polyhaven.com, CC0 (public
domain). Imported into `public/models/furniture/` by
`scripts/import-polyhaven.mjs`.

**Card faces** — Byron Knoll's Vector Playing Cards, public domain (see
`cards-svg/README.md`). Rendered into `public/cards/` by
`scripts/build-cards.mjs`.
