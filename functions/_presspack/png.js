// Minimal, dependency-free PNG codec for the dynamic per-concert social
// graphics (functions/presspack/generate.js). Not a general-purpose PNG
// library: every asset this module ever decodes (base templates, glyph
// atlases) is produced locally by specs/koncerty-presspack/pngtool.py in one
// guaranteed profile — 8-bit RGBA (color type 6), non-interlaced, filter
// type 0 (None) on every scanline, exactly one IDAT chunk — so the decoder
// below only has to trust that profile, not defend against arbitrary PNGs.
// The encoder always writes that same profile back out, so a round trip
// through decode -> composite -> encode never has to reconcile two formats.
//
// PNG's IDAT payload is zlib (RFC 1950) compressed, which is exactly what
// the Streams API's `CompressionStream('deflate')` / `DecompressionStream
// ('deflate')` implement (Cloudflare Workers ship these natively) — no npm
// zlib shim needed.

function crc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crc32Table();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function inflate(bytes) {
  const ds = new DecompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflate(bytes) {
  const cs = new CompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Reverses the 5 PNG scanline filter types back to raw RGBA bytes. Only
// filter 0 is actually produced by our own encoder, but all five are cheap
// to support and make the decoder robust to any future asset that wasn't
// re-saved through pngtool.py.
function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  let rawPos = 0;
  let prevRowStart = -1;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawPos++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw_x = raw[rawPos + x];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = prevRowStart >= 0 ? out[prevRowStart + x] : 0;
      const c = x >= bpp && prevRowStart >= 0 ? out[prevRowStart + x - bpp] : 0;
      let value;
      switch (filterType) {
        case 0: value = raw_x; break;
        case 1: value = raw_x + a; break;
        case 2: value = raw_x + b; break;
        case 3: value = raw_x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = raw_x + pred;
          break;
        }
        default:
          throw new Error(`unsupported PNG filter type ${filterType}`);
      }
      out[rowStart + x] = value & 0xff;
    }
    rawPos += stride;
    prevRowStart = rowStart;
  }
  return out;
}

// Decodes an RGBA8, non-interlaced PNG into {width, height, pixels}, where
// pixels is a flat Uint8Array of length width*height*4 (row-major RGBA).
export async function decodePNG(bytes) {
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Error("not a PNG file");
  }
  let pos = 8;
  let width, height, bitDepth, colorType;
  const idatParts = [];
  while (pos < bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0);
    const tag = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const bodyStart = pos + 8;
    if (tag === "IHDR") {
      const dv = new DataView(bytes.buffer, bytes.byteOffset + bodyStart, 13);
      width = dv.getUint32(0);
      height = dv.getUint32(4);
      bitDepth = bytes[bodyStart + 8];
      colorType = bytes[bodyStart + 9];
      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(`unsupported PNG profile: depth=${bitDepth} colorType=${colorType}`);
      }
    } else if (tag === "IDAT") {
      idatParts.push(bytes.subarray(bodyStart, bodyStart + length));
    } else if (tag === "IEND") {
      break;
    }
    pos = bodyStart + length + 4; // skip CRC
  }
  let total = 0;
  for (const p of idatParts) total += p.length;
  const idat = new Uint8Array(total);
  let off = 0;
  for (const p of idatParts) { idat.set(p, off); off += p.length; }

  const raw = await inflate(idat);
  const pixels = unfilter(raw, width, height, 4);
  return { width, height, pixels };
}

// Encodes {width, height, pixels} (flat RGBA8 Uint8Array) into a PNG byte
// stream in the exact profile decodePNG() above expects back.
export async function encodePNG({ width, height, pixels }) {
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const rawStart = y * (stride + 1);
    raw[rawStart] = 0; // filter type 0 (None)
    raw.set(pixels.subarray(y * stride, (y + 1) * stride), rawStart + 1);
  }
  const compressed = await deflate(raw);

  function chunk(tag, body) {
    const tagBytes = new Uint8Array([tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)]);
    const lenBytes = new Uint8Array(4);
    new DataView(lenBytes.buffer).setUint32(0, body.length);
    const crcInput = new Uint8Array(tagBytes.length + body.length);
    crcInput.set(tagBytes, 0);
    crcInput.set(body, tagBytes.length);
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crc32(crcInput));
    const out = new Uint8Array(4 + 4 + body.length + 4);
    out.set(lenBytes, 0);
    out.set(tagBytes, 4);
    out.set(body, 8);
    out.set(crcBytes, 8 + body.length);
    return out;
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const parts = [
    new Uint8Array(PNG_SIG),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0)),
  ];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
