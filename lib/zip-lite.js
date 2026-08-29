// VibeDesign — minimal ZIP writer (v3.0)
//
//   VD_ZIP.zip([{ path: 'a/b.txt', text: '…' }, …]) → Uint8Array
//
// Store-only (compression method 0): every entry is written verbatim with a
// CRC-32 and a local header, followed by a central directory. No deflate, no
// dependency, no build step — the extension ships no bundler and pulling in a
// zip library for a handful of text files would be the larger cost.
//
// The bundle is a few dozen KB of markdown, CSS and JSON. Deflate would save
// perhaps 70% of that; a wrong byte in a hand-rolled deflate would cost a
// corrupt download nobody can open. Store is the honest trade here.
//
// Every unzip implementation reads store-only archives: macOS Archive Utility,
// Windows Explorer, `unzip`, Python's zipfile, Node's yauzl.
//
// Text is encoded UTF-8. Filenames are UTF-8 with the language-encoding flag
// set (bit 11), so non-ASCII paths survive.

const VD_ZIP = (() => {
  'use strict';

  // ── CRC-32 (IEEE 802.3), table-driven ───────────────────────────────────
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // TextEncoder exists in the extension pages and in Node ≥11. Falling back
  // would mean hand-rolling UTF-8; there is no runtime here without it.
  const encoder = new TextEncoder();
  const utf8 = s => encoder.encode(String(s));

  // ── little-endian writers ───────────────────────────────────────────────
  function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
  function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

  // A fixed timestamp. A zip whose bytes change every second cannot be diffed
  // or checksummed in a test, and the mtime of a generated file carries no
  // information anyway. 1980-01-01 00:00:00 is the DOS epoch, the lowest value
  // the format can express.
  const DOS_TIME = 0;
  const DOS_DATE = 33;   // (1980-1980)<<9 | 1<<5 | 1

  function normalizePath(p) {
    return String(p)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(seg => seg && seg !== '.' && seg !== '..')   // no zip-slip
      .join('/');
  }

  function zip(entries) {
    if (!Array.isArray(entries) || !entries.length) return null;

    const local = [];        // local header + data, in order
    const central = [];      // central directory records (2 chunks per entry)
    let count = 0;           // entries actually written — NOT central.length
    let offset = 0;

    entries.forEach(entry => {
      const path = normalizePath(entry.path);
      if (!path) return;
      const nameBytes = utf8(path);
      const data = entry.bytes instanceof Uint8Array ? entry.bytes : utf8(entry.text || '');
      const sum = crc32(data);

      // bit 11 = filename and comment are UTF-8
      const flags = 0x0800;

      const localHeader = [].concat(
        u32(0x04034b50),      // local file header signature
        u16(20),              // version needed (2.0)
        u16(flags),
        u16(0),               // method 0 = stored
        u16(DOS_TIME), u16(DOS_DATE),
        u32(sum),
        u32(data.length),     // compressed size == uncompressed size
        u32(data.length),
        u16(nameBytes.length),
        u16(0)                // extra field length
      );
      local.push(Uint8Array.from(localHeader), nameBytes, data);

      central.push(Uint8Array.from([].concat(
        u32(0x02014b50),      // central directory header signature
        u16(20),              // version made by
        u16(20),              // version needed
        u16(flags),
        u16(0),               // method
        u16(DOS_TIME), u16(DOS_DATE),
        u32(sum),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),               // extra
        u16(0),               // comment
        u16(0),               // disk number start
        u16(0),               // internal attributes
        u32(0),               // external attributes
        u32(offset)           // offset of the local header
      )), nameBytes);

      offset += localHeader.length + nameBytes.length + data.length;
      count++;
    });

    if (!central.length) return null;

    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = Uint8Array.from([].concat(
      u32(0x06054b50),        // end of central directory
      u16(0), u16(0),         // disk numbers
      u16(count),             // records on this disk
      u16(count),             // total records
      u32(centralSize),
      u32(offset),
      u16(0)                  // comment length
    ));

    const chunks = local.concat(central, [end]);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    chunks.forEach(c => { out.set(c, at); at += c.length; });
    return out;
  }

  return { zip, _crc32: crc32, _normalizePath: normalizePath };
})();

if (typeof self !== 'undefined') self.VD_ZIP = VD_ZIP;
if (typeof module !== 'undefined' && module.exports) module.exports = VD_ZIP;
