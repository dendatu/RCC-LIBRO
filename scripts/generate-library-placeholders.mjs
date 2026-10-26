// Generates the placeholder library artwork in public/images/library.
// Real RCC photographs can replace these 1:1 by keeping the same file names,
// or be added and referenced from src/lib/library-images.ts.
//   node scripts/generate-library-placeholders.mjs
import { mkdir, writeFile } from "node:fs/promises";

const OUT = "public/images/library";

const PALETTE = {
  brown: "#6F4E37",
  darkBrown: "#46301F",
  cream: "#F5F0E6",
  gold: "#D4A373",
  ink: "#2D2D2D",
  parchment: "#FBF8F2",
};

const shell = (label, body, w = 1600, h = 900) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
  <title>${label}</title>
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PALETTE.parchment}"/>
      <stop offset="1" stop-color="${PALETTE.cream}"/>
    </linearGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PALETTE.brown}"/>
      <stop offset="1" stop-color="${PALETTE.darkBrown}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#paper)"/>
  ${body}
</svg>`;

/** Three tiers of shelves with varied spine widths and gold lettering bands. */
function shelves(y, height, tint) {
  const rows = 3;
  const rowH = height / rows;
  let out = "";
  for (let r = 0; r < rows; r += 1) {
    const ry = y + r * rowH;
    let x = 40;
    while (x < 1560) {
      const w = 18 + ((x * 7 + r * 13) % 26);
      const bh = rowH - 26 - ((x % 5) * 4);
      const colors = [PALETTE.brown, PALETTE.gold, tint, PALETTE.darkBrown, PALETTE.ink];
      const fill = colors[(x + r) % colors.length];
      out += `<rect x="${x}" y="${ry + (rowH - 12 - bh)}" width="${w}" height="${bh}" rx="2" fill="${fill}" opacity="${0.55 + ((x % 4) * 0.12)}"/>`;
      if (x % 3 === 0) {
        out += `<rect x="${x + 3}" y="${ry + (rowH - 12 - bh) + 10}" width="${w - 6}" height="4" fill="${PALETTE.cream}" opacity="0.6"/>`;
      }
      x += w + 4;
    }
    out += `<rect x="24" y="${ry + rowH - 12}" width="1552" height="10" rx="3" fill="${PALETTE.darkBrown}" opacity="0.75"/>`;
  }
  return out;
}

const art = {
  "hero-01.svg": shell(
    "RCC LIBRO reading room",
    `<g>${shelves(150, 560, "#A97D55")}
      <rect x="0" y="710" width="1600" height="190" fill="url(#warm)"/>
      <circle cx="1250" cy="220" r="120" fill="${PALETTE.gold}" opacity="0.35"/>
      <text x="80" y="800" font-family="Georgia,serif" font-size="66" fill="${PALETTE.cream}">Reading Room</text>
      <text x="82" y="850" font-family="Helvetica,Arial,sans-serif" font-size="24" letter-spacing="6" fill="${PALETTE.gold}">REPUBLIC CENTRAL COLLEGES</text>
    </g>`,
  ),
  "hero-02.svg": shell(
    "Library arch and stacks",
    `<path d="M120 860V420a680 680 0 0 1 1360 0v440z" fill="url(#warm)" opacity="0.9"/>
     <path d="M220 860V440a580 580 0 0 1 1160 0v420z" fill="${PALETTE.parchment}" opacity="0.96"/>
     ${shelves(470, 350, "#C9A68C")}
     <circle cx="800" cy="330" r="86" fill="${PALETTE.gold}" opacity="0.5"/>
     <text x="800" y="345" text-anchor="middle" font-family="Georgia,serif" font-size="52" fill="${PALETTE.darkBrown}">RCC</text>`,
  ),
  "reading-room.svg": shell(
    "Study tables in the reading room",
    `<rect x="0" y="0" width="1600" height="380" fill="url(#warm)" opacity="0.85"/>
     ${shelves(60, 300, "#C9A68C")}
     <rect x="0" y="380" width="1600" height="520" fill="${PALETTE.parchment}"/>
     ${[220, 700, 1180]
       .map(
         (x) => `<g>
        <rect x="${x}" y="620" width="320" height="18" rx="6" fill="${PALETTE.brown}"/>
        <rect x="${x + 20}" y="638" width="14" height="170" fill="${PALETTE.darkBrown}"/>
        <rect x="${x + 286}" y="638" width="14" height="170" fill="${PALETTE.darkBrown}"/>
        <rect x="${x + 60}" y="560" width="90" height="58" rx="4" fill="${PALETTE.gold}" opacity="0.8"/>
        <rect x="${x + 160}" y="572" width="70" height="46" rx="4" fill="${PALETTE.brown}" opacity="0.7"/>
        <path d="M${x + 240} 480h20l14 78h-48z" fill="${PALETTE.ink}" opacity="0.7"/>
        <ellipse cx="${x + 250}" cy="474" rx="46" ry="16" fill="${PALETTE.gold}"/>
      </g>`,
       )
       .join("")}`,
  ),
  "circulation-desk.svg": shell(
    "Circulation desk with QR scanning station",
    `<rect x="0" y="560" width="1600" height="340" fill="url(#warm)"/>
     <rect x="120" y="520" width="1360" height="60" rx="10" fill="${PALETTE.gold}" opacity="0.9"/>
     ${shelves(80, 400, "#A97D55")}
     <g fill="${PALETTE.cream}">
       ${[0, 1, 2, 3, 4, 5, 6]
         .map((i) =>
           [0, 1, 2, 3, 4, 5, 6]
             .map((j) =>
               (i + j) % 3 === 0
                 ? `<rect x="${1120 + i * 26}" y="${620 + j * 26}" width="22" height="22"/>`
                 : "",
             )
             .join(""),
         )
         .join("")}
     </g>
     <text x="1120" y="830" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="3" fill="${PALETTE.gold}">SCAN TO BORROW</text>`,
  ),
  "branch-elementary.svg": shell(
    "Elementary library corner",
    `<rect x="0" y="640" width="1600" height="260" fill="${PALETTE.cream}"/>
     ${[120, 520, 920, 1320]
       .map(
         (x, i) =>
           `<g transform="translate(${x} 300)">
        <rect x="0" y="0" width="300" height="340" rx="18" fill="${[PALETTE.gold, "#C9A68C", PALETTE.brown, "#A97D55"][i]}" opacity="0.9"/>
        ${[0, 1, 2]
          .map(
            (r) =>
              `<rect x="24" y="${40 + r * 100}" width="252" height="72" rx="8" fill="${PALETTE.parchment}" opacity="0.9"/>` +
              [0, 1, 2, 3, 4, 5]
                .map(
                  (b) =>
                    `<rect x="${34 + b * 40}" y="${52 + r * 100}" width="26" height="50" rx="3" fill="${[PALETTE.brown, PALETTE.gold, PALETTE.ink, "#A97D55", PALETTE.darkBrown, "#C9A68C"][(b + r) % 6]}"/>`,
                )
                .join(""),
          )
          .join("")}
      </g>`,
       )
       .join("")}
     <text x="800" y="760" text-anchor="middle" font-family="Georgia,serif" font-size="56" fill="${PALETTE.brown}">Elementary Library</text>`,
  ),
  "branch-highschool.svg": shell(
    "High school library stacks",
    `<rect x="0" y="0" width="1600" height="900" fill="${PALETTE.parchment}"/>
     ${[0, 1, 2, 3]
       .map(
         (i) =>
           `<g transform="translate(${60 + i * 380} 140)">
        <rect x="0" y="0" width="300" height="600" rx="8" fill="${PALETTE.brown}" opacity="${0.85 - i * 0.08}"/>
        ${[0, 1, 2, 3, 4, 5]
          .map(
            (r) =>
              `<rect x="16" y="${26 + r * 96}" width="268" height="66" rx="4" fill="${PALETTE.cream}" opacity="0.92"/>` +
              [0, 1, 2, 3, 4, 5, 6, 7]
                .map(
                  (b) =>
                    `<rect x="${24 + b * 32}" y="${32 + r * 96}" width="24" height="54" rx="2" fill="${[PALETTE.darkBrown, PALETTE.gold, PALETTE.ink, "#A97D55"][b % 4]}" opacity="0.8"/>`,
                )
                .join(""),
          )
          .join("")}
      </g>`,
       )
       .join("")}`,
  ),
  "branch-college.svg": shell(
    "College and graduate school library",
    `<rect x="0" y="0" width="1600" height="900" fill="url(#warm)"/>
     <path d="M0 900 800 300 1600 900z" fill="${PALETTE.parchment}" opacity="0.12"/>
     ${[300, 640, 980]
       .map(
         (x) =>
           `<g>
        <rect x="${x}" y="360" width="60" height="440" fill="${PALETTE.cream}" opacity="0.85"/>
        <rect x="${x - 30}" y="330" width="120" height="30" rx="6" fill="${PALETTE.gold}"/>
      </g>`,
       )
       .join("")}
     <rect x="220" y="250" width="1160" height="80" rx="10" fill="${PALETTE.cream}" opacity="0.9"/>
     <text x="800" y="305" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="${PALETTE.darkBrown}">College &amp; Graduate School Library</text>
     <text x="800" y="870" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="24" letter-spacing="5" fill="${PALETTE.gold}">REFERENCE · RESEARCH · CIRCULATION</text>`,
  ),
  "og-cover.svg": shell(
    "RCC LIBRO cover",
    `<rect x="0" y="0" width="1600" height="900" fill="url(#warm)"/>
     ${shelves(560, 300, "#C9A68C")}
     <text x="120" y="260" font-family="Georgia,serif" font-size="110" fill="${PALETTE.cream}">RCC LIBRO</text>
     <text x="124" y="330" font-family="Helvetica,Arial,sans-serif" font-size="30" letter-spacing="4" fill="${PALETTE.gold}">LIBRARY INVENTORY &amp; BOOK RECORDING ORGANIZER</text>`,
  ),
};

await mkdir(OUT, { recursive: true });
for (const [name, svg] of Object.entries(art)) {
  await writeFile(`${OUT}/${name}`, svg, "utf8");
}
console.log(`Wrote ${Object.keys(art).length} placeholder artworks to ${OUT}`);
