// Generates the five per-concert social graphics (FB square/landscape/event
// cover post + safe-zone event cover + Story/Reels 9:16) entirely dynamically, from the concert's
// real D1 data — nothing about a specific show is ever baked into a static
// asset. Every other pixel (band photo, ghost logo, duotone grade, diagonal
// band shape, wordmark, tribute line, "fromnothing.pl") is identical for
// every concert, so it lives once per format in a pre-rendered "base
// template" PNG (R2, key presspack-gen/<format>-base.png — a separate
// prefix from presspack/, which is the promoter-facing shared-files pool
// managed from /koncerty). Only the 4 fields that truly vary — date, city,
// venue, address — get drawn at request time, using the dependency-free
// PNG codec (./png.js) and bitmap-font compositor (./textcomposite.js).
//
// Regenerating a base template (design change) means re-running the
// pipeline in specs/koncerty-presspack/ and re-uploading; nothing here
// needs to change for that.

import { decodePNG, encodePNG } from "./png.js";
import { drawText } from "./textcomposite.js";
import { ANTON_META, ANTON_GLYPHS } from "./glyphmetrics.js";
import { SPACEMONO_META, SPACEMONO_GLYPHS } from "./glyphmetrics.js";
import { ANTON_ATLAS_B64, SPACEMONO_ATLAS_B64 } from "./glyphatlas.js";

const BLACK = [10, 9, 8];
const CREAM = [242, 237, 224];
const SCARLET = [232, 64, 56];
const MUTED = [164, 159, 146];

// x/baselineY are in the target format's pixel space; align is where x
// anchors the string. Positions were measured directly off the tuned HTML
// mockups (specs/koncerty-presspack/base-templates/field-regions.json) —
// see that directory's README for how to re-measure them if a base
// template's layout ever changes.
const FORMATS = {
  square: {
    width: 1080, height: 1080, base: "presspack-gen/square-base.png",
    filename: (slug) => `FromNothing-fb-post-square-${slug}.png`,
    fields: {
      date:    { font: "anton", size: 96,  x: 31,  baselineY: 646,  color: BLACK,   align: "left" },
      city:    { font: "anton", size: 26,  x: 60,  baselineY: 845,  color: CREAM,   align: "left" },
      venue:   { font: "mono",  size: 14,  x: 1017,baselineY: 845,  color: CREAM,   align: "right" },
      address: { font: "mono",  size: 12,  x: 61,  baselineY: 1049, color: MUTED,   align: "left" },
    },
  },
  landscape: {
    width: 1200, height: 630, base: "presspack-gen/landscape-base.png",
    filename: (slug) => `FromNothing-fb-post-landscape-${slug}.png`,
    fields: {
      date:    { font: "anton", size: 70,  x: 714, baselineY: 186, color: BLACK,   align: "left" },
      city:    { font: "anton", size: 30,  x: 714, baselineY: 440, color: SCARLET, align: "left" },
      venue:   { font: "mono",  size: 15,  x: 714, baselineY: 475, color: CREAM,   align: "left" },
      address: { font: "mono",  size: 12,  x: 715, baselineY: 568, color: MUTED,   align: "left" },
    },
  },
  cover: {
    width: 1920, height: 1005, base: "presspack-gen/cover-base.png",
    filename: (slug) => `FromNothing-fb-event-cover-${slug}.png`,
    fields: {
      date:    { font: "anton", size: 104, x: 1250, baselineY: 280, color: BLACK,   align: "left" },
      city:    { font: "anton", size: 46,  x: 1250, baselineY: 657, color: SCARLET, align: "left" },
      venue:   { font: "mono",  size: 20,  x: 1251, baselineY: 706, color: CREAM,   align: "left" },
      address: { font: "mono",  size: 17,  x: 1251, baselineY: 906, color: MUTED,   align: "left" },
    },
  },
  // "Safe-zone" variant of the event cover. Measured on a real FB event
  // (25.10.2026 Wrocław, phone screenshots): desktop shows the full 1.91:1;
  // the mobile app shows only the CENTRAL SQUARE (x 458-1462) in the event
  // header, with a white fade over its bottom ~35%, and the feed card crops
  // that square again to a 1.91:1 strip (y 240-766). So faces, wordmark and
  // the whole date/city/venue/address lockup live in y 240-766 of the
  // centre square; the lockup is black-on-red inside the diagonal band so
  // it stays readable under the header's white fade. Date is right-aligned
  // to x=930, the three text lines left-aligned from x=975. Flanks are
  // only extended wall/vignette. Kept as an additional file next to the
  // classic two-column cover; base rendered from
  // specs/koncerty-presspack/graphics-gen/cover-safe-src/.
  coverSafe: {
    width: 1920, height: 1005, base: "presspack-gen/cover-safe-base.png",
    filename: (slug) => `FromNothing-fb-event-cover-safe-${slug}.png`,
    fields: {
      date:    { font: "anton", size: 96, x: 930, baselineY: 754, color: BLACK, align: "right" },
      city:    { font: "anton", size: 40, x: 975, baselineY: 713, color: BLACK, align: "left" },
      venue:   { font: "mono",  size: 17, x: 975, baselineY: 735, color: BLACK, align: "left" },
      address: { font: "mono",  size: 15, x: 975, baselineY: 754, color: BLACK, align: "left" },
    },
  },
  story: {
    width: 1080, height: 1920, base: "presspack-gen/story-base.png",
    filename: (slug) => `FromNothing-story-9x16-${slug}.png`,
    fields: {
      date:    { font: "anton", size: 104, x: 31,  baselineY: 1185, color: BLACK, align: "left" },
      city:    { font: "anton", size: 34,  x: 60,  baselineY: 1501, color: CREAM, align: "left" },
      venue:   { font: "mono",  size: 17,  x: 1017,baselineY: 1501, color: CREAM, align: "right" },
      address: { font: "mono",  size: 15,  x: 61,  baselineY: 1876, color: MUTED, align: "left" },
    },
  },
};

export const FORMAT_NAMES = Object.keys(FORMATS);

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let fontsPromise = null;
async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const [antonAtlas, spacemonoAtlas] = await Promise.all([
        decodePNG(b64ToBytes(ANTON_ATLAS_B64)),
        decodePNG(b64ToBytes(SPACEMONO_ATLAS_B64)),
      ]);
      return {
        anton: { meta: ANTON_META, glyphs: ANTON_GLYPHS, atlas: antonAtlas },
        mono: { meta: SPACEMONO_META, glyphs: SPACEMONO_GLYPHS, atlas: spacemonoAtlas },
      };
    })();
  }
  return fontsPromise;
}

// Builds the four dynamic strings from a concert row. Mirrors the address
// formatting already used elsewhere (functions/index.js addressLine) —
// street only; postal/locality aren't part of these compact graphics.
function fieldTextsFor(concert) {
  const [y, m, d] = concert.date.split("-");
  return {
    date: `${d}.${m}.${y}`,
    city: concert.city || "",
    venue: concert.venue_name || "",
    address: concert.address_street ? concert.address_street : "",
  };
}

// Renders one format for one concert. Returns a JPEG-less raw PNG byte
// array (the caller re-encodes to JPEG via a plain quality re-save is not
// available without a codec, so these ship as PNG in the zip — see the
// route's comment for why that's the right tradeoff here).
export async function generateGraphic(env, formatName, concert) {
  const fmt = FORMATS[formatName];
  if (!fmt) throw new Error(`unknown presspack graphic format: ${formatName}`);

  const [fonts, baseObj] = await Promise.all([
    loadFonts(),
    env.MEDIA.get(fmt.base),
  ]);
  if (!baseObj) throw new Error(`missing base template: ${fmt.base}`);
  const baseBytes = new Uint8Array(await baseObj.arrayBuffer());
  const image = await decodePNG(baseBytes);
  if (image.width !== fmt.width || image.height !== fmt.height) {
    throw new Error(`base template ${fmt.base} is ${image.width}x${image.height}, expected ${fmt.width}x${fmt.height}`);
  }

  const texts = fieldTextsFor(concert);
  for (const [field, text] of Object.entries(texts)) {
    if (!text) continue;
    const spec = fmt.fields[field];
    const font = fonts[spec.font];
    drawText(image, font, text, spec.x, spec.baselineY, spec.size, spec.color, spec.align);
  }

  return { bytes: await encodePNG(image), filename: fmt.filename };
}
