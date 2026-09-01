/* Unreal package (.uasset/.umap) container parsing: summary, names, imports, exports.
   Table layouts are version dependent, so they are chosen by matching the byte stride
   the summary implies rather than trusting version constants alone. */
(function (global) {
  'use strict';
  var UA = global.UA;
  var Reader = UA.Reader, ParseError = UA.ParseError;

  var PACKAGE_TAG = 0x9E2A83C1;
  var PKG_FILTER_EDITOR_ONLY = 0x80000000;

  var V = {
    ARRAY_INNER_TAGS: 282,
    LOAD_FOR_EDITOR_GAME: 365,
    STRUCT_GUID_IN_TAG: 441,
    SERIALIZE_TEXT_IN_PACKAGES: 459,
    COOKED_ASSETS_IN_EDITOR: 485,
    SET_MAP_SUPPORT: 500,
    PROPERTY_GUID_IN_TAG: 503,
    NAME_HASHES_SERIALIZED: 504,
    PRELOAD_DEPS: 507,
    SIZE_64BIT: 511,
    LOCALIZATION_ID: 516,
    NON_OUTER_PACKAGE_IMPORT: 520,
    TEMPLATE_INDEX_IN_COOKED: 600
  };
  UA.V = V;

  function Package() {
    this.names = [];
    this.imports = [];
    this.exports = [];
    this.warnings = [];
  }

  Package.prototype.name = function (idx, num) {
    var s = (idx >= 0 && idx < this.names.length) ? this.names[idx] : '<bad name ' + idx + '>';
    return num ? s + '_' + (num - 1) : s;
  };

  /* Resolve an FPackageIndex: 0 = null, >0 = export, <0 = import. */
  Package.prototype.resolve = function (pi) {
    if (!pi) return null;
    if (pi > 0) { var e = this.exports[pi - 1]; return e ? { kind: 'export', obj: e } : null; }
    var im = this.imports[-pi - 1];
    return im ? { kind: 'import', obj: im } : null;
  };

  Package.prototype.indexName = function (pi) {
    var r = this.resolve(pi);
    return r ? r.obj.objectName : (pi ? '<missing ' + pi + '>' : 'None');
  };

  /* Full object path following the Outer chain. */
  Package.prototype.indexPath = function (pi) {
    var r = this.resolve(pi);
    if (!r) return pi ? '<missing ' + pi + '>' : 'None';
    var parts = [], cur = r, guard = 0;
    while (cur && guard++ < 32) {
      parts.unshift(cur.obj.objectName);
      cur = cur.obj.outerIndex ? this.resolve(cur.obj.outerIndex) : null;
    }
    if (r.kind === 'import' && r.obj.packageName && r.obj.packageName !== 'None' && parts.length === 1) {
      return r.obj.packageName + '.' + parts[0];
    }
    return parts.join('.');
  };

  function readFNameFrom(r, pkg) {
    var idx = r.i32(), num = r.i32();
    if (idx < 0 || idx >= pkg.names.length) throw ParseError('name index ' + idx + ' out of range', r.pos - 8);
    return pkg.name(idx, num);
  }
  UA.readFNameFrom = readFNameFrom;

  /* ---------------------------------------------------------------- summary */

  function parseSummary(r, pkg, fileSize) {
    var tag = r.u32();
    if (tag !== PACKAGE_TAG) {
      if (tag === 0xC1832A9E) throw ParseError('big-endian packages are not supported', 0);
      throw ParseError('not an Unreal package (bad magic 0x' + tag.toString(16) + ')', 0);
    }
    pkg.legacyFileVersion = r.i32();
    if (pkg.legacyFileVersion > 0 || pkg.legacyFileVersion < -32) {
      throw ParseError('unrecognised legacy file version ' + pkg.legacyFileVersion, 4);
    }
    if (pkg.legacyFileVersion !== -4) r.i32();
    pkg.ue4Version = r.i32();
    pkg.ue5Version = pkg.legacyFileVersion <= -8 ? r.i32() : 0;
    pkg.licenseeVersion = r.i32();
    var afterVersions = r.tell();

    /* The custom version block sits between the versions and the summary body.
       Its entry size, and in UE 5.7 (legacy -9) even the position of its count,
       have all moved between engine releases — and -9 additionally dropped
       TotalHeaderSize from the front of the body. Nothing here needs the custom
       version values, so try the known shapes, then fall back to locating the
       body by its own contents. */
    var cvCount = -1;
    try { cvCount = r.i32(); } catch (e) { /* truncated header */ }
    var afterCount = afterVersions + 4;
    var candidates = [];
    if (cvCount >= 0 && cvCount <= 4096) {
      candidates.push(afterCount + cvCount * 20);   /* guid + version */
      candidates.push(afterCount + cvCount * 8);    /* pre-4.13 enum form */
      if (cvCount === 0) candidates.push(afterCount);
    }
    for (var i = 0; i < candidates.length; i++) {
      if (tryBodyAt(r, pkg, fileSize, candidates[i])) return pkg;
    }

    /* Variable-size entries (guid + version + friendly name). */
    try {
      r.seek(afterCount);
      for (var j = 0; j < cvCount; j++) { r.skip(20); r.str(); }
      if (tryBodyAt(r, pkg, fileSize, r.tell())) return pkg;
    } catch (e) { /* not this shape either */ }

    /* Follow the (FGuid, int32) rhythm of the entries themselves. This finds the
       end of the block without knowing where its count is stored, which is what
       legacy -9 needs. */
    var walk = null;
    for (var k = 0; k <= 16; k += 4) {
      var w = walkCustomVersions(r, afterVersions + k);
      if (!walk || w.count > walk.count) walk = w;
    }
    if (walk && walk.count > 0 && tryBodyAt(r, pkg, fileSize, walk.end)) {
      pkg.customVersionsWalked = walk.count;
      return pkg;
    }

    if (scanForBody(r, pkg, fileSize, afterVersions)) return pkg;
    throw ParseError('could not locate the package summary body', afterVersions);
  }

  /* Custom version entries are a 16-byte guid followed by a small int32 version.
     Walking that shape locates the end of the block on any layout. */
  function walkCustomVersions(r, start) {
    var p = start, n = 0;
    while (p + 20 <= r.end && n < 4096) {
      var v = r.dv.getInt32(p + 16, true);
      if (v < 0 || v > 1000000) break;
      p += 20;
      n++;
    }
    return { end: p, count: n };
  }

  /* Try both body shapes at one position: with and without a leading
     TotalHeaderSize (removed in legacy -9). */
  function tryBodyAt(r, pkg, fileSize, pos) {
    if (pos < 0 || pos + 24 > r.end) return false;
    if (trySummaryTail(r, pkg, fileSize, pos, true)) return true;
    return trySummaryTail(r, pkg, fileSize, pos, false);
  }

  /* Locate the summary body by its own shape: a short printable FolderName
     followed by flags and a name table that actually reads back. */
  function scanForBody(r, pkg, fileSize, from) {
    var dv = r.dv, u8 = r.u8;
    var limit = Math.min(from + 262144, r.end - 32);
    for (var p = from; p < limit; p++) {
      var len = dv.getInt32(p, true);
      if (len < 2 || len > 512) continue;
      if (p + 4 + len > r.end) continue;
      if (u8[p + 4 + len - 1] !== 0) continue;
      var printable = true;
      for (var i = 0; i < len - 1; i++) {
        var c = u8[p + 4 + i];
        if (c < 32 || c > 126) { printable = false; break; }
      }
      if (!printable) continue;
      if (trySummaryTail(r, pkg, fileSize, p, false)) {
        pkg.summaryLocatedByScan = true;
        return true;
      }
      if (p >= 4 && trySummaryTail(r, pkg, fileSize, p - 4, true)) {
        pkg.summaryLocatedByScan = true;
        return true;
      }
    }
    return false;
  }

  function trySummaryTail(r, pkg, fileSize, pos, withHeaderSize) {
    var save = r.tell();
    try {
      r.seek(pos);
      var totalHeaderSize = null;
      if (withHeaderSize) {
        totalHeaderSize = r.i32();
        if (totalHeaderSize <= 0 || totalHeaderSize > fileSize) { r.seek(save); return false; }
      }
      var folderName = r.str();
      var packageFlags = r.u32();
      var nameCount = r.i32(), nameOffset = r.i32();
      if (nameCount < 1 || nameCount > 4000000 || nameOffset < 16 || nameOffset > fileSize) {
        r.seek(save); return false;
      }
      var bodyEnd = r.tell();

      /* Three optional blocks follow. Try each combination and keep the one whose
         import/export offsets are mutually consistent. */
      var afterNames = r.tell();
      var best = null;
      for (var mask = 0; mask < 8; mask++) {
        r.seek(afterNames);
        try {
          if (mask & 1) { r.i32(); r.i32(); }
          if (mask & 2) { r.str(); }
          if (mask & 4) { r.i32(); r.i32(); }
          var exportCount = r.i32(), exportOffset = r.i32();
          var importCount = r.i32(), importOffset = r.i32();
          var dependsOffset = r.i32();
          if (exportCount < 1 || exportCount > 4000000 || importCount < 0 || importCount > 4000000) continue;
          if (nameOffset < bodyEnd) continue;                 /* tables follow the summary */
          if (exportOffset < 0 || exportOffset > fileSize || importOffset < 0 || importOffset > fileSize) continue;
          if (dependsOffset < 0 || dependsOffset > fileSize) continue;
          if (nameOffset > importOffset || importOffset > exportOffset) continue;
          /* legacy -9 stopped writing a depends map, leaving this slot at zero. */
          if (dependsOffset > 0 && exportOffset >= dependsOffset) continue;

          /* Collect the offsets that follow, so the export table can be bounded
             even when DependsOffset no longer marks its end. */
          var lookahead = [], la = r.tell();
          for (var t = 0; t < 32 && la + 4 <= r.end; t++, la += 4) {
            var lv = r.dv.getInt32(la, true);
            if (lv > exportOffset && lv <= fileSize) lookahead.push(lv);
          }
          if (dependsOffset > exportOffset) lookahead.push(dependsOffset);

          var cand = {
            mask: mask, exportCount: exportCount, exportOffset: exportOffset,
            importCount: importCount, importOffset: importOffset,
            dependsOffset: dependsOffset, tableEnds: lookahead, score: 0
          };
          if (importCount > 0 && (exportOffset - importOffset) % importCount === 0) cand.score += 2;
          for (var q = 0; q < lookahead.length; q++) {
            if (exportCount > 0 && (lookahead[q] - exportOffset) % exportCount === 0) { cand.score += 2; break; }
          }
          if (!best || cand.score > best.score) best = cand;
        } catch (e) { /* next combination */ }
      }
      if (!best) { r.seek(save); return false; }

      /* Decisive check: the name table must read back cleanly and stop where the
         next table begins. This is what keeps the scan from accepting garbage. */
      var names = tryNameTable(r, pkg, nameCount, nameOffset, best.importOffset);
      if (!names || !looksLikeNameTable(names.names)) { r.seek(save); return false; }

      pkg.totalHeaderSize = totalHeaderSize;
      pkg.folderName = folderName;
      pkg.packageFlags = packageFlags;
      pkg.nameCount = nameCount;
      pkg.nameOffset = nameOffset;
      pkg.names = names.names;
      pkg.nameTableEnd = names.end;
      pkg.nameHashes = names.hashes;
      pkg.exportCount = best.exportCount;
      pkg.exportOffset = best.exportOffset;
      pkg.importCount = best.importCount;
      pkg.importOffset = best.importOffset;
      pkg.dependsOffset = best.dependsOffset;
      pkg.exportTableEnds = best.tableEnds;
      pkg.isCooked = (packageFlags & PKG_FILTER_EDITOR_ONLY) !== 0;
      return true;
    } catch (e) {
      r.seek(save);
      return false;
    }
  }

  /* A real name table is mostly short printable identifiers. */
  function looksLikeNameTable(names) {
    if (!names.length) return false;
    var good = 0;
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (!n || n.length > 512) continue;
      var clean = true;
      for (var c = 0; c < n.length; c++) {
        var code = n.charCodeAt(c);
        if (code < 32 && code !== 9) { clean = false; break; }
      }
      if (clean) good++;
    }
    return good / names.length >= 0.9;
  }

  /* Read the name table both with and without the trailing hash fields and keep
     whichever lands inside the gap before the next table. */
  function tryNameTable(r, pkg, nameCount, nameOffset, importOffset) {
    if (nameCount === 0) return { names: [], end: nameOffset, hashes: false };
    var modes = pkg.ue4Version >= V.NAME_HASHES_SERIALIZED ? [true, false] : [false, true];
    for (var m = 0; m < modes.length; m++) {
      var sub = r.sub(nameOffset, r.end);
      var names = [];
      try {
        for (var i = 0; i < nameCount; i++) {
          var s = sub.str();
          if (s.length > 8192) throw ParseError('implausible name length', sub.pos);
          names.push(s);
          if (modes[m]) sub.skip(4);
        }
      } catch (e) { continue; }
      if (sub.tell() > importOffset) continue;
      return { names: names, end: sub.tell(), hashes: modes[m] };
    }
    return null;
  }

  /* ------------------------------------------------------------------ names */

  function readNames(r, pkg) {
    if (pkg.names && pkg.names.length === pkg.nameCount) return;   /* already read while validating */
    var withHashes = pkg.ue4Version >= V.NAME_HASHES_SERIALIZED;
    for (var attempt = 0; attempt < 2; attempt++) {
      var hashes = attempt === 0 ? withHashes : !withHashes;
      r.seek(pkg.nameOffset);
      var names = [];
      try {
        for (var i = 0; i < pkg.nameCount; i++) {
          names.push(r.str());
          if (hashes) r.skip(4);
        }
        pkg.names = names;
        pkg.nameTableEnd = r.tell();
        if (attempt === 1) pkg.warnings.push('Name table read without the expected hash fields.');
        return;
      } catch (e) { /* retry with the other layout */ }
    }
    throw ParseError('could not read the name table', pkg.nameOffset);
  }

  /* ---------------------------------------------------------------- imports */

  function readImports(r, pkg) {
    var n = pkg.importCount;
    pkg.imports = [];
    if (!n) return;
    var span = pkg.exportOffset - pkg.importOffset;
    var stride = span > 0 && span % n === 0 ? span / n : 0;
    var hasPackageName = pkg.ue4Version >= V.NON_OUTER_PACKAGE_IMPORT && !pkg.isCooked;
    var hasOptional = pkg.ue5Version > 0;
    if (stride) {
      var combos = [[false, false], [true, false], [false, true], [true, true]];
      var found = null;
      for (var c = 0; c < combos.length; c++) {
        var sz = 28 + (combos[c][0] ? 8 : 0) + (combos[c][1] ? 4 : 0);
        if (sz === stride) {
          found = combos[c];
          if (combos[c][0] === hasPackageName && combos[c][1] === hasOptional) break;
        }
      }
      if (found) { hasPackageName = found[0]; hasOptional = found[1]; }
    }
    for (var i = 0; i < n; i++) {
      if (stride) r.seek(pkg.importOffset + i * stride);
      var im = { index: i };
      im.classPackage = readFNameFrom(r, pkg);
      im.className = readFNameFrom(r, pkg);
      im.outerIndex = r.i32();
      im.objectName = readFNameFrom(r, pkg);
      if (hasPackageName) im.packageName = readFNameFrom(r, pkg);
      if (hasOptional) im.optional = r.i32() !== 0;
      pkg.imports.push(im);
    }
  }

  /* ---------------------------------------------------------------- exports */

  var EXPORT_OPTIONALS = [
    ['templateIndex', 4], ['size64', 8], ['packageGuid', 16], ['editorGame', 4],
    ['isAsset', 4], ['publicHash', 4], ['extraFlag', 4], ['preloadDeps', 20], ['scriptOffsets', 16]
  ];

  function exportLayouts(pkg, stride) {
    var out = [];
    var n = EXPORT_OPTIONALS.length;
    for (var m = 0; m < (1 << n); m++) {
      var size = 48; /* class,super,outer,name(8),flags,size32,off32,forced,notClient,notServer,pkgFlags */
      var cfg = {};
      for (var b = 0; b < n; b++) {
        var on = (m >> b) & 1;
        cfg[EXPORT_OPTIONALS[b][0]] = !!on;
        if (on) size += EXPORT_OPTIONALS[b][1];
      }
      if (stride && size !== stride) continue;
      cfg.__size = size;
      var pred = 0;
      if (cfg.templateIndex === (pkg.ue4Version >= V.TEMPLATE_INDEX_IN_COOKED)) pred++;
      if (cfg.size64 === (pkg.ue4Version >= V.SIZE_64BIT)) pred++;
      if (cfg.editorGame === (pkg.ue4Version >= V.LOAD_FOR_EDITOR_GAME)) pred++;
      if (cfg.isAsset === (pkg.ue4Version >= V.COOKED_ASSETS_IN_EDITOR)) pred++;
      if (cfg.preloadDeps === (pkg.ue4Version >= V.PRELOAD_DEPS)) pred++;
      if (cfg.packageGuid === (pkg.ue5Version < 1012)) pred++;
      if (cfg.scriptOffsets === (pkg.ue5Version >= 1012)) pred++;
      cfg.__pred = pred;
      out.push(cfg);
    }
    out.sort(function (a, b) { return b.__pred - a.__pred; });
    return out;
  }

  function readExportsWith(r, pkg, cfg, dataLimit) {
    var list = [], stride = cfg.__size;
    for (var i = 0; i < pkg.exportCount; i++) {
      r.seek(pkg.exportOffset + i * stride);
      var e = { index: i, packageIndex: i + 1 };
      e.classIndex = r.i32();
      e.superIndex = r.i32();
      e.templateIndex = cfg.templateIndex ? r.i32() : 0;
      e.outerIndex = r.i32();
      var ni = r.i32(), nn = r.i32();
      e.nameIndex = ni;
      e.objectName = pkg.name(ni, nn);
      e.objectFlags = r.u32();
      e.serialSize = cfg.size64 ? r.i64() : r.i32();
      e.serialOffset = cfg.size64 ? r.i64() : r.i32();
      e.forcedExport = r.i32() !== 0;
      r.i32(); r.i32();
      if (cfg.packageGuid) r.skip(16);
      e.packageFlags = r.u32();
      if (cfg.editorGame) r.i32();
      e.isAsset = cfg.isAsset ? r.i32() !== 0 : false;
      if (cfg.publicHash) r.i32();
      if (cfg.extraFlag) r.i32();
      if (cfg.preloadDeps) r.skip(20);
      if (cfg.scriptOffsets) { e.scriptStart = r.i64(); e.scriptEnd = r.i64(); }
      else { e.scriptStart = 0; e.scriptEnd = -1; }
      list.push(e);
    }
    var score = 0;
    for (var k = 0; k < list.length; k++) {
      var x = list[k];
      if (x.nameIndex >= 0 && x.nameIndex < pkg.names.length) score += 2;
      if (x.classIndex >= -pkg.importCount && x.classIndex <= pkg.exportCount) score += 1;
      if (x.outerIndex >= -pkg.importCount && x.outerIndex <= pkg.exportCount) score += 1;
      if (typeof x.serialSize === 'number' && x.serialSize >= 0 && x.serialSize <= dataLimit) score += 2;
      if (typeof x.serialOffset === 'number' && x.serialOffset >= 0 && x.serialOffset <= dataLimit) score += 2;
      if (x.scriptEnd >= -1 && x.scriptEnd <= x.serialSize) score += 1;
    }
    /* Export payloads are written back to back, so each entry's offset plus its
       size must land on the next entry's offset. A misread field layout breaks
       this immediately, which makes it the sharpest test available. */
    var chained = 0;
    for (var c = 0; c + 1 < list.length; c++) {
      var a = list[c], b = list[c + 1];
      if (typeof a.serialOffset === 'number' && typeof a.serialSize === 'number' &&
          a.serialOffset + a.serialSize === b.serialOffset) chained++;
    }
    score += chained * 4;
    return { list: list, score: score, max: list.length * 9 + Math.max(0, list.length - 1) * 4 };
  }

  function readExports(r, pkg, dataLimit) {
    pkg.exports = [];
    if (!pkg.exportCount) return;

    /* Any summary offset that lies just past the export table bounds it, which
       gives an exact entry stride. DependsOffset used to be that bound; since
       legacy -9 it is zero, so the following offsets are used instead. */
    var ends = (pkg.exportTableEnds || []).slice();
    if (pkg.dependsOffset > pkg.exportOffset) ends.push(pkg.dependsOffset);
    ends.sort(function (a, b) { return a - b; });
    var strides = [];
    for (var s = 0; s < ends.length; s++) {
      var span = ends[s] - pkg.exportOffset;
      if (span > 0 && span % pkg.exportCount === 0) {
        var st = span / pkg.exportCount;
        if (st >= 48 && st <= 512 && strides.indexOf(st) < 0) strides.push(st);
      }
    }
    pkg.exportStrides = strides;

    var cands = [];
    for (var i2 = 0; i2 < strides.length; i2++) cands = cands.concat(exportLayouts(pkg, strides[i2]));
    if (!cands.length) cands = exportLayouts(pkg, 0);
    var best = null, tried = 0;
    for (var i = 0; i < cands.length && tried < 200; i++) {
      tried++;
      var res;
      try { res = readExportsWith(r, pkg, cands[i], dataLimit); } catch (e) { continue; }
      if (!best || res.score > best.score) { best = res; best.cfg = cands[i]; }
      if (best.score === best.max) break;
    }
    if (!best) throw ParseError('could not read the export table', pkg.exportOffset);
    pkg.exports = best.list;
    pkg.exportLayout = best.cfg;
    if (best.score < best.max * 0.9) {
      pkg.warnings.push('Export table layout is uncertain; some object metadata may be wrong.');
    }
    for (var j = 0; j < pkg.exports.length; j++) {
      var e = pkg.exports[j];
      e.className = pkg.indexName(e.classIndex);
      e.outerName = e.outerIndex ? pkg.indexName(e.outerIndex) : null;
    }
  }

  /* ------------------------------------------------------------------ entry */

  UA.parsePackage = function (uassetBuf, opts) {
    opts = opts || {};
    var pkg = new Package();
    pkg.fileName = opts.fileName || 'package.uasset';
    pkg.fileSize = uassetBuf.byteLength;
    pkg.uexp = opts.uexp || null;

    var r = new Reader(uassetBuf);
    parseSummary(r, pkg, uassetBuf.byteLength);
    readNames(r, pkg);
    readImports(r, pkg);

    /* Export payloads live inside the .uasset for editor assets and in a sibling
       .uexp for cooked ones, where offsets stay relative to the combined stream. */
    var dataLimit = pkg.uexp
      ? (pkg.totalHeaderSize || uassetBuf.byteLength) + pkg.uexp.byteLength
      : uassetBuf.byteLength;
    readExports(r, pkg, dataLimit);

    pkg.exportDataFor = function (e) {
      var start = e.serialOffset, size = e.serialSize;
      if (typeof start !== 'number' || typeof size !== 'number' || size < 0) return null;
      if (start + size <= uassetBuf.byteLength) return { buffer: uassetBuf, start: start, end: start + size };
      if (pkg.uexp) {
        var headerSize = pkg.totalHeaderSize || uassetBuf.byteLength;
        var s = start - headerSize;
        if (s >= 0 && s + size <= pkg.uexp.byteLength) return { buffer: pkg.uexp, start: s, end: s + size };
      }
      return null;
    };

    if (pkg.isCooked) {
      pkg.warnings.push('This package is cooked. Blueprint graphs are stripped during cooking, so only ' +
        'the compiled class remains — open the uncooked editor asset to see graphs.');
    }
    if (!pkg.uexp && pkg.exports.length && !pkg.exportDataFor(pkg.exports[0])) {
      pkg.warnings.push('Export payloads live outside this file — add the matching .uexp file.');
    }
    return pkg;
  };

  UA.Package = Package;
})(typeof window !== 'undefined' ? window : globalThis);
