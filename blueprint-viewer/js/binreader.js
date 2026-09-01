/* Binary reader for Unreal package files (little-endian). */
(function (global) {
  'use strict';
  var UA = (global.UA = global.UA || {});

  function ParseError(msg, pos) {
    var e = new Error(msg + (pos != null ? ' @' + pos : ''));
    e.name = 'ParseError';
    e.pos = pos;
    return e;
  }
  UA.ParseError = ParseError;

  var MAX_STR = 1 << 22;

  /** Reader over a slice [start,end) of an ArrayBuffer. Sub-readers share the buffer. */
  function Reader(buffer, start, end) {
    this.buffer = buffer;
    this.u8 = new Uint8Array(buffer);
    this.dv = new DataView(buffer);
    this.start = start || 0;
    this.end = end == null ? this.u8.length : end;
    this.pos = this.start;
  }
  Reader.prototype = {
    sub: function (start, end) { return new Reader(this.buffer, start, end); },
    get remaining() { return this.end - this.pos; },
    tell: function () { return this.pos; },
    seek: function (p) { this.pos = p; return this; },
    skip: function (n) { this.pos += n; return this; },
    eof: function () { return this.pos >= this.end; },
    need: function (n) {
      if (n < 0 || this.pos + n > this.end) throw ParseError('read past end (' + n + 'b)', this.pos);
    },
    u8v: function () { this.need(1); return this.u8[this.pos++]; },
    i8: function () { this.need(1); return this.dv.getInt8(this.pos++); },
    u16: function () { this.need(2); var v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; },
    i16: function () { this.need(2); var v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; },
    i32: function () { this.need(4); var v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; },
    u32: function () { this.need(4); var v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; },
    i64: function () {
      this.need(8);
      var v = this.dv.getBigInt64(this.pos, true); this.pos += 8;
      return (v <= 9007199254740991n && v >= -9007199254740991n) ? Number(v) : v;
    },
    u64: function () {
      this.need(8);
      var v = this.dv.getBigUint64(this.pos, true); this.pos += 8;
      return v <= 9007199254740991n ? Number(v) : v;
    },
    f32: function () { this.need(4); var v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; },
    f64: function () { this.need(8); var v = this.dv.getFloat64(this.pos, true); this.pos += 8; return v; },
    bool32: function () { return this.i32() !== 0; },
    bytes: function (n) { this.need(n); var v = this.u8.subarray(this.pos, this.pos + n); this.pos += n; return v; },
    /** 16-byte FGuid as a lowercase hex key. */
    guid: function () {
      this.need(16);
      var s = hex16(this.u8, this.pos);
      this.pos += 16;
      return s;
    },
    /** FString: int32 length; positive = ANSI (incl. null), negative = UTF-16 (incl. null). */
    str: function () {
      var n = this.i32();
      if (n === 0) return '';
      if (n < 0) {
        var chars = -n;
        if (chars > MAX_STR) throw ParseError('bogus utf16 string length ' + n, this.pos - 4);
        this.need(chars * 2);
        var out = '';
        for (var i = 0; i < chars - 1; i++) out += String.fromCharCode(this.dv.getUint16(this.pos + i * 2, true));
        this.pos += chars * 2;
        return out;
      }
      if (n > MAX_STR) throw ParseError('bogus string length ' + n, this.pos - 4);
      this.need(n);
      var b = this.u8.subarray(this.pos, this.pos + n - 1);
      this.pos += n;
      return decodeAnsi(b);
    }
  };

  function decodeAnsi(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    // Names/strings in packages are ANSI; upgrade to UTF-8 when it is valid and multi-byte.
    if (/[\x80-\xff]/.test(s)) {
      try {
        var d = new TextDecoder('utf-8', { fatal: true }).decode(b);
        return d;
      } catch (e) { /* keep latin-1 */ }
    }
    return s;
  }

  var HEX = [];
  for (var i = 0; i < 256; i++) HEX[i] = (i < 16 ? '0' : '') + i.toString(16);
  function hex16(u8, off) {
    var s = '';
    for (var i = 0; i < 16; i++) s += HEX[u8[off + i]];
    return s;
  }
  UA.hex16 = hex16;

  /** UE displays guids as 32 uppercase hex chars; group for readability. */
  UA.formatGuid = function (h) {
    if (!h || h.length !== 32) return h || '';
    var u = h.toUpperCase();
    return u.slice(0, 8) + '-' + u.slice(8, 16) + '-' + u.slice(16, 24) + '-' + u.slice(24);
  };

  UA.Reader = Reader;
})(typeof window !== 'undefined' ? window : globalThis);
