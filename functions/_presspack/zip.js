// Dependency-free ZIP writer. The leading underscore on `_presspack` keeps
// Cloudflare Pages Functions routing from treating this directory as a
// route — this module only exports helpers for functions/presspack/[token].js.
//
// We only ever need the STORE method (no compression — the presspack
// contents are already-compressed media most of the time, and re-inflating
// them here on every request would cost CPU for no size win), so this is a
// small, self-contained subset of the ZIP spec (APPNOTE.TXT): local file
// headers + file data, repeated per entry, followed by one central
// directory record per entry, followed by a single end-of-central-directory
// (EOCD) record. No zip64 — fine as long as the archive stays under 4 GiB
// and under 65535 entries, both true here (presspack assets are a handful
// of press photos/logos/bios).
//
// Layout of the archive we produce:
//
//   [local file header 1][file name 1][file data 1]
//   [local file header 2][file name 2][file data 2]
//   ...
//   [central directory header 1][file name 1]
//   [central directory header 2][file name 2]
//   ...
//   [end of central directory record]
//
// Every multi-byte integer in the ZIP format is little-endian, hence
// `DataView#set*(offset, value, true)` (the `true` = littleEndian) throughout.

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const LOCAL_FILE_HEADER_SIZE = 30; // fixed part, before the file name
const CENTRAL_DIRECTORY_HEADER_SIZE = 46; // fixed part, before the file name
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;

const VERSION_NEEDED = 20; // ZIP 2.0 — plenty for STORE, no encryption
const GP_FLAG_UTF8 = 0x0800; // general-purpose bit 11: names are UTF-8
const METHOD_STORE = 0;

// --- CRC-32 (polynomial 0xEDB88320, the standard "zip"/"gzip" polynomial) --
// Classic table-based implementation: precompute the remainder for every
// possible byte value once, then fold each input byte through the table.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Of(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- DOS date/time -----------------------------------------------------
// ZIP stores timestamps in the ancient MS-DOS packed format: two 16-bit
// words. We derive it from the current time at build time (either a fixed
// stamp or a derived one is fine per spec — a live timestamp is simplest and
// still deterministic-enough since nothing in this repo asserts on it).
//   time: bits 15-11 hours, 10-5 minutes, 4-0 seconds/2
//   date: bits 15-9 year-1980, 8-5 month (1-12), 4-0 day (1-31)
function dosDateTime(date) {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >>> 1) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Build a complete ZIP archive (STORE method, no compression) from a list of
 * in-memory entries.
 *
 * @param {Array<{name: string, data: Uint8Array}>} entries
 * @returns {Uint8Array} the full archive, ready to serve as-is
 */
export function buildZip(entries) {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = dosDateTime(new Date());

  const localChunks = []; // local file headers + names + data, in order
  const centralChunks = []; // central directory headers + names, in order
  let localOffset = 0; // running byte offset from the start of the archive
  let centralDirectorySize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32Of(data);
    const size = data.length;

    // --- Local file header (30 bytes, immediately followed by the name and
    // then the raw file data — STORE means "raw" is literally the content).
    const local = new Uint8Array(LOCAL_FILE_HEADER_SIZE);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL_FILE_HEADER_SIGNATURE, true);
    lv.setUint16(4, VERSION_NEEDED, true);
    lv.setUint16(6, GP_FLAG_UTF8, true);
    lv.setUint16(8, METHOD_STORE, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size == uncompressed (STORE)
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra field length — none

    localChunks.push(local, nameBytes, data);

    // --- Central directory header (46 bytes, followed by the same name).
    // Mirrors the local header's metadata plus the offset of that local
    // header within the archive, so a reader can locate the actual data.
    const central = new Uint8Array(CENTRAL_DIRECTORY_HEADER_SIZE);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
    cv.setUint16(4, VERSION_NEEDED, true); // version made by
    cv.setUint16(6, VERSION_NEEDED, true); // version needed to extract
    cv.setUint16(8, GP_FLAG_UTF8, true);
    cv.setUint16(10, METHOD_STORE, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra field length
    cv.setUint16(32, 0, true); // file comment length
    cv.setUint16(34, 0, true); // disk number where the file starts
    cv.setUint16(36, 0, true); // internal file attributes
    cv.setUint32(38, 0, true); // external file attributes
    cv.setUint32(42, localOffset, true); // offset of the local header

    centralChunks.push(central, nameBytes);
    centralDirectorySize += central.length + nameBytes.length;

    localOffset += local.length + nameBytes.length + size;
  }

  const centralDirectoryOffset = localOffset; // central dir starts right
  // after the last entry's data — `localOffset` has been walked forward by
  // every entry's total size in the loop above.

  // --- End of central directory record: a single fixed-size trailer that
  // tells a reader how many entries exist and where the central directory
  // (the index) begins, so it never has to scan the whole file linearly.
  const eocd = new Uint8Array(END_OF_CENTRAL_DIRECTORY_SIZE);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  ev.setUint16(4, 0, true); // number of this disk
  ev.setUint16(6, 0, true); // disk where the central directory starts
  ev.setUint16(8, entries.length, true); // central dir records on this disk
  ev.setUint16(10, entries.length, true); // total central dir records
  ev.setUint32(12, centralDirectorySize, true);
  ev.setUint32(16, centralDirectoryOffset, true);
  ev.setUint16(20, 0, true); // comment length — none

  const totalSize = centralDirectoryOffset + centralDirectorySize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let pos = 0;
  for (const chunk of localChunks) {
    archive.set(chunk, pos);
    pos += chunk.length;
  }
  for (const chunk of centralChunks) {
    archive.set(chunk, pos);
    pos += chunk.length;
  }
  archive.set(eocd, pos);

  return archive;
}
