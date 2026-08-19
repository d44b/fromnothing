// Draws arbitrary strings onto a decoded RGBA image using a pre-rasterized
// glyph atlas — the dependency-free stand-in for a font-shaping engine
// (Workers have no Canvas2D/OffscreenCanvas and no font rasterizer). Atlas
// PNGs and their metrics (functions/_presspack/glyphmetrics.js) are
// generated once, offline, from the same Anton / Space Mono files embedded
// in the poster HTML templates — see specs/koncerty-presspack/atlas-gen.py.
//
// Every glyph in an atlas is solid white on transparent, drawn at a shared
// y (baselineY) within its cell, so glyph alpha is a pure coverage mask:
// compositing just alpha-blends the caller's chosen flat color through that
// mask — no per-glyph vertical bookkeeping needed at draw time.

// Only the characters covered by the atlas can appear in generated
// graphics. `.toUpperCase()` (case-fold Polish diacritics included) happens
// here, and unsupported characters silently advance the pen by a fallback
// width rather than throwing — a truncated/misspelled venue name is a far
// smaller failure than a broken presspack download.
const FALLBACK_ADVANCE_FRACTION = 0.6;

function blendPixel(dst, di, r, g, b, a) {
  if (a <= 0) return;
  if (a >= 255) {
    dst[di] = r; dst[di + 1] = g; dst[di + 2] = b; dst[di + 3] = 255;
    return;
  }
  const dstA = dst[di + 3] / 255;
  const srcA = a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  dst[di] = Math.round((r * srcA + dst[di] * dstA * (1 - srcA)) / outA);
  dst[di + 1] = Math.round((g * srcA + dst[di + 1] * dstA * (1 - srcA)) / outA);
  dst[di + 2] = Math.round((b * srcA + dst[di + 2] * dstA * (1 - srcA)) / outA);
  dst[di + 3] = Math.round(outA * 255);
}

// Blits one glyph cell from the atlas into `dest` at (dx, dy) = the glyph's
// top-left in destination pixels, box-filtering (area-average) from the
// atlas's native size down to `scale` (dest px per atlas px, always <= 1
// here since every target font size is smaller than the atlas's baked
// size). `color` is [r,g,b]; alpha comes from the atlas's own alpha channel.
function blitGlyphScaled(dest, destW, destH, atlas, atlasW, glyphX, glyphW, cellH, dx, dy, scale, color) {
  const outW = Math.max(1, Math.round(glyphW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const invScale = 1 / scale;
  for (let oy = 0; oy < outH; oy++) {
    const py = dy + oy;
    if (py < 0 || py >= destH) continue;
    const srcY0 = Math.floor(oy * invScale);
    const srcY1 = Math.max(srcY0 + 1, Math.floor((oy + 1) * invScale));
    for (let ox = 0; ox < outW; ox++) {
      const px = dx + ox;
      if (px < 0 || px >= destW) continue;
      const srcX0 = Math.floor(ox * invScale);
      const srcX1 = Math.max(srcX0 + 1, Math.floor((ox + 1) * invScale));
      let sum = 0, count = 0;
      for (let sy = srcY0; sy < srcY1; sy++) {
        if (sy < 0 || sy >= cellH) continue;
        const rowBase = (sy * atlasW + glyphX) * 4;
        for (let sx = srcX0; sx < srcX1 && glyphX + sx < atlasW; sx++) {
          const ai = rowBase + sx * 4 + 3;
          sum += atlas[ai];
          count++;
        }
      }
      if (count === 0) continue;
      const a = sum / count;
      if (a < 2) continue;
      const di = (py * destW + px) * 4;
      blendPixel(dest, di, color[0], color[1], color[2], a);
    }
  }
}

// Measures the rendered width (in target-font pixels) of `text` set in
// `font` at `targetSize`, without drawing — used for right-aligned and
// centered fields.
export function measureText(text, font, targetSize) {
  const { glyphs, meta } = font;
  const scale = targetSize / meta.size;
  let width = 0;
  for (const ch of text.toUpperCase()) {
    const g = glyphs[ch];
    width += (g ? g.adv : meta.size * FALLBACK_ADVANCE_FRACTION) * scale;
  }
  return width;
}

// Draws `text` into `image` ({width,height,pixels}) at `targetSize` using
// `font` ({glyphs, meta, atlas: {width,height,pixels}}), with the string's
// baseline at (x, baselineY) for align:"left", right edge at x for
// align:"right", or centered on x for align:"center". `color` is [r,g,b].
export function drawText(image, font, text, x, baselineY, targetSize, color, align = "left") {
  const { glyphs, meta, atlas } = font;
  const scale = targetSize / meta.size;
  const totalWidth = align === "left" ? 0 : measureText(text, font, targetSize);

  let penX;
  if (align === "right") penX = x - totalWidth;
  else if (align === "center") penX = x - totalWidth / 2;
  else penX = x;

  const topY = Math.round(baselineY - meta.baselineY * scale);

  for (const ch of text.toUpperCase()) {
    const g = glyphs[ch];
    if (!g) {
      penX += meta.size * FALLBACK_ADVANCE_FRACTION * scale;
      continue;
    }
    if (g.w > 0) {
      blitGlyphScaled(
        image.pixels, image.width, image.height,
        atlas.pixels, atlas.width,
        g.x, g.w, meta.cellH,
        Math.round(penX), topY, scale, color
      );
    }
    penX += g.adv * scale;
  }
}
