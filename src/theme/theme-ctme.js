/**
 * Connectify Theme Files (.ctme)
 *
 * A theme file is a ZIP archive named after the theme ("Test Theme" -> test_theme.ctme) holding theme.json and, when
 * the theme has one, its wallpaper as an image file (theme.json names it in "wallpaper"). Archives are written
 * uncompressed (images are compressed already); reading also accepts deflated entries, so a file re-zipped by the
 * operating system still imports, and plain .json theme files from older versions. Everything read is untrusted:
 * only theme.json and the image it names are taken. Exposes window.ConnectifyThemeCtme.
 */
(() => {
  'use strict';

  const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' };
  const MAX_ENTRY = 64 * 1024 * 1024;

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** "Test Theme" -> "test_theme.ctme" */
  const fileName = name => `${String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'theme'}.ctme`;

  /** Stored (uncompressed) ZIP of [{ name, bytes }]. */
  function zip(entries) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    for (const { name, bytes } of entries) {
      const nameBytes = enc.encode(name), crc = crc32(bytes);
      const local = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4],
        [18, bytes.length, 4], [22, bytes.length, 4], [26, nameBytes.length, 2], [28, 0, 2]]
        .forEach(([at, v, size]) => (size === 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true)));
      const dir = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4],
        [20, bytes.length, 4], [24, bytes.length, 4], [28, nameBytes.length, 2], [42, offset, 4]]
        .forEach(([at, v, size]) => (size === 4 ? dir.setUint32(at, v, true) : dir.setUint16(at, v, true)));
      parts.push(new Uint8Array(local.buffer), nameBytes, bytes);
      central.push(new Uint8Array(dir.buffer), nameBytes);
      offset += 30 + nameBytes.length + bytes.length;
    }
    const dirSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [8, entries.length, 2], [10, entries.length, 2], [12, dirSize, 4], [16, offset, 4]]
      .forEach(([at, v, size]) => (size === 4 ? end.setUint32(at, v, true) : end.setUint16(at, v, true)));
    const out = new Uint8Array(offset + dirSize + 22);
    let at = 0;
    for (const p of [...parts, ...central, new Uint8Array(end.buffer)]) { out.set(p, at); at += p.length; }
    return out;
  }

  async function inflate(bytes, size) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Compressed theme files are not supported here');
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > Math.max(size, 1) || total > MAX_ENTRY) { reader.cancel(); throw new Error('Theme file entry is too large'); }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
  }

  /** Map of entry name -> bytes from a ZIP archive (stored or deflated entries). */
  async function unzip(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('Not a theme file');
    const count = view.getUint16(end + 10, true);
    let p = view.getUint32(end + 16, true);
    const dec = new TextDecoder(), files = new Map();
    for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const method = view.getUint16(p + 10, true), packed = view.getUint32(p + 20, true), size = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true), extra = view.getUint16(p + 30, true), comment = view.getUint16(p + 32, true);
      const local = view.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extra + comment;
      if (size > MAX_ENTRY || local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) continue;
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + packed);
      if (method === 0) files.set(name, data);
      else if (method === 8) files.set(name, await inflate(data, size));
    }
    return files;
  }

  function dataUrlToBytes(url) {
    const m = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(url || '');
    if (!m) return null;
    const type = m[1].toLowerCase();
    if (/;base64/i.test(m[2])) {
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { type, bytes };
    }
    return { type, bytes: new TextEncoder().encode(decodeURIComponent(m[3])) };
  }

  function bytesToDataUrl(bytes, type) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  }

  /** The .ctme archive for a theme object (its "wallpaper" a data URL or null). */
  function pack(theme) {
    const enc = new TextEncoder(), entries = [];
    const wall = dataUrlToBytes(theme.wallpaper);
    const ext = wall && Object.keys(EXT_TYPES).find(e => EXT_TYPES[e] === wall.type);
    const wallName = ext ? `wallpaper.${ext}` : null;
    entries.push({ name: 'theme.json', bytes: enc.encode(JSON.stringify({ ...theme, wallpaper: wallName }, null, 2)) });
    if (wallName) entries.push({ name: wallName, bytes: wall.bytes });
    return zip(entries);
  }

  /** Theme object from a .ctme archive or an older .json file, wallpaper back as a data URL. */
  async function unpack(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return JSON.parse(new TextDecoder().decode(bytes)); // legacy .json
    const files = await unzip(buffer);
    const json = files.get('theme.json') || [...files].find(([n]) => /(^|\/)theme\.json$/i.test(n))?.[1];
    if (!json) throw new Error('The theme file has no theme.json');
    const theme = JSON.parse(new TextDecoder().decode(json));
    const wallName = typeof theme.wallpaper === 'string' && !theme.wallpaper.startsWith('data:') ? theme.wallpaper : null;
    if (wallName) {
      const type = EXT_TYPES[(wallName.split('.').pop() || '').toLowerCase()];
      const wall = files.get(wallName) || [...files].find(([n]) => n.endsWith(`/${wallName}`))?.[1];
      theme.wallpaper = type && wall ? bytesToDataUrl(wall, type) : null;
    }
    return theme;
  }

  /** Theme object from a picked file. Firefox gives content scripts a page-owned buffer from file.arrayBuffer(),
      which they may not read ("Permission denied to access property"); a Response made here returns our own. */
  const unpackFile = async file => unpack(await new Response(file).arrayBuffer());

  window.ConnectifyThemeCtme = { fileName, zip, unzip, pack, unpack, unpackFile, crc32 };
})();
