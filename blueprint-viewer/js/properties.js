/* Tagged property deserialisation.

   Two on-disk tag formats exist and both are supported:
     classic (UE4 .. UE5.3)  Name, Type, Size, ArrayIndex, type-specific data, [guid], value
     modern  (UE5.4+)        Name, FPropertyTypeName (recursive), Size, Flags, value
   The format in use is detected by parsing a few exports each way and keeping
   whichever produces a clean None-terminated chain. */
(function (global) {
  'use strict';
  var UA = global.UA;
  var Reader = UA.Reader, ParseError = UA.ParseError, V = UA.V;

  var FLAG_NATIVE_STRUCT = 0x08;   /* struct body uses a custom serialiser, not tagged props */
  var FLAG_BOOL_TRUE = 0x10;

  function fname(r, pkg) {
    var idx = r.i32(), num = r.i32();
    if (idx < 0 || idx >= pkg.names.length) throw ParseError('bad name index ' + idx, r.pos - 8);
    return pkg.name(idx, num);
  }

  /* FPropertyTypeName: an FName plus a recursive parameter list. */
  function typeName(r, pkg, depth) {
    var name = fname(r, pkg);
    var count = r.i32();
    if (count < 0 || count > 32) throw ParseError('bad type parameter count ' + count, r.pos - 4);
    var params = [];
    if (depth < 8) {
      for (var i = 0; i < count; i++) params.push(typeName(r, pkg, depth + 1));
    } else if (count) {
      throw ParseError('type name nested too deeply', r.pos);
    }
    return { name: name, params: params };
  }

  function readTagModern(r, pkg) {
    var name = fname(r, pkg);
    if (name === 'None') return null;
    var t = typeName(r, pkg, 0);
    var size = r.i32();
    var flags = r.u8v();
    if (size < 0) throw ParseError('negative property size ' + size, r.pos - 5);
    var tag = {
      name: name, type: t.name, params: t.params, size: size, flags: flags, arrayIndex: 0,
      valueStart: r.tell()
    };
    tag.structName = t.params[0] ? t.params[0].name : null;
    tag.innerType = t.params[0] ? t.params[0].name : null;
    tag.keyType = t.params[0] ? t.params[0].name : null;
    tag.valueType = t.params[1] ? t.params[1].name : null;
    tag.boolValue = (flags & FLAG_BOOL_TRUE) !== 0;
    tag.nativeStruct = (flags & FLAG_NATIVE_STRUCT) !== 0;
    return tag;
  }

  function readTagClassic(r, pkg) {
    var name = fname(r, pkg);
    if (name === 'None') return null;
    var type = fname(r, pkg);
    var size = r.i32();
    var arrayIndex = r.i32();
    if (size < 0 || arrayIndex < 0 || arrayIndex > 65535) {
      throw ParseError('implausible property tag for ' + name, r.pos - 8);
    }
    var tag = {
      name: name, type: type, params: [], size: size, flags: 0,
      arrayIndex: arrayIndex, structName: null, innerType: null,
      keyType: null, valueType: null, boolValue: false, nativeStruct: false
    };
    switch (type) {
      case 'StructProperty':
        tag.structName = fname(r, pkg);
        if (pkg.ue4Version >= V.STRUCT_GUID_IN_TAG) r.skip(16);
        break;
      case 'BoolProperty':
        tag.boolValue = r.u8v() !== 0;
        break;
      case 'ByteProperty':
      case 'EnumProperty':
        tag.enumName = fname(r, pkg);
        break;
      case 'ArrayProperty':
        if (pkg.ue4Version >= V.ARRAY_INNER_TAGS) tag.innerType = fname(r, pkg);
        break;
      case 'SetProperty':
        if (pkg.ue4Version >= V.SET_MAP_SUPPORT) tag.innerType = fname(r, pkg);
        break;
      case 'MapProperty':
        if (pkg.ue4Version >= V.SET_MAP_SUPPORT) { tag.keyType = fname(r, pkg); tag.valueType = fname(r, pkg); }
        break;
      default: break;
    }
    if (pkg.ue4Version >= V.PROPERTY_GUID_IN_TAG) {
      if (r.u8v() !== 0) r.skip(16);
    }
    tag.valueStart = r.tell();
    return tag;
  }

  /* Read a None-terminated tagged property chain from [start,end). */
  function readChain(pkg, buffer, start, end, modern, depth) {
    var r = new Reader(buffer, start, end);
    var props = [], terminated = false;
    var guard = 0;
    while (r.pos + 8 <= end && guard++ < 65536) {
      var tag;
      var tagStart = r.tell();
      try {
        tag = modern ? readTagModern(r, pkg) : readTagClassic(r, pkg);
      } catch (e) {
        props.push({ name: '<unreadable>', type: 'Error', error: e.message, offset: tagStart });
        break;
      }
      if (!tag) { terminated = true; break; }
      if (tag.valueStart + tag.size > end) {
        tag.error = 'value extends past the object (' + tag.size + ' bytes)';
        tag.value = { k: 'raw', size: tag.size, hex: '' };
        props.push(tag);
        break;
      }
      try {
        tag.value = decodeValue(pkg, tag, buffer, tag.valueStart, tag.valueStart + tag.size, modern, depth || 0);
      } catch (e) {
        tag.error = e.message;
        tag.value = rawValue(buffer, tag.valueStart, tag.valueStart + tag.size);
      }
      props.push(tag);
      r.seek(tag.valueStart + tag.size);
    }
    return { props: props, terminated: terminated, end: r.tell() };
  }

  function rawValue(buffer, start, end) {
    var u8 = new Uint8Array(buffer, start, Math.max(0, end - start));
    var n = Math.min(u8.length, 64), hex = '';
    for (var i = 0; i < n; i++) hex += ('0' + u8[i].toString(16)).slice(-2) + (i % 4 === 3 ? ' ' : '');
    return { k: 'raw', size: end - start, hex: hex + (u8.length > n ? '…' : '') };
  }

  /* --------------------------------------------------------------- values */

  var OBJECT_TYPES = {
    ObjectProperty: 1, ClassProperty: 1, WeakObjectProperty: 1,
    LazyObjectProperty: 1, InterfaceProperty: 1, AssetObjectProperty: 1
  };

  function decodeValue(pkg, tag, buffer, start, end, modern, depth) {
    var r = new Reader(buffer, start, end);
    var t = tag.type;

    if (OBJECT_TYPES[t]) {
      if (t === 'InterfaceProperty' && end - start >= 4) return objRef(pkg, r.i32());
      return objRef(pkg, r.i32());
    }

    switch (t) {
      case 'BoolProperty': return tag.boolValue;
      case 'IntProperty': return r.i32();
      case 'Int8Property': return r.i8();
      case 'Int16Property': return r.i16();
      case 'Int64Property': return r.i64();
      case 'UInt16Property': return r.u16();
      case 'UInt32Property': return r.u32();
      case 'UInt64Property': return r.u64();
      case 'FloatProperty': return r.f32();
      case 'DoubleProperty': return r.f64();
      case 'NameProperty': return { k: 'name', v: fname(r, pkg) };
      case 'StrProperty': return r.str();
      case 'TextProperty': return { k: 'text', v: readText(r, end) };
      case 'ByteProperty':
        if (end - start === 1) return r.u8v();
        if (end - start >= 8) return { k: 'name', v: fname(r, pkg) };
        return r.u8v();
      case 'EnumProperty':
        if (end - start >= 8) return { k: 'name', v: fname(r, pkg) };
        return r.u8v();
      case 'SoftObjectProperty':
      case 'SoftClassProperty':
        return { k: 'soft', v: readSoftPath(r, pkg, end) };
      case 'DelegateProperty': {
        var o = r.i32();
        return { k: 'delegate', object: objRef(pkg, o), fn: fname(r, pkg) };
      }
      case 'MulticastDelegateProperty':
      case 'MulticastInlineDelegateProperty':
      case 'MulticastSparseDelegateProperty': {
        var n = r.i32(), items = [];
        for (var i = 0; i < n && r.remaining >= 12; i++) {
          items.push({ k: 'delegate', object: objRef(pkg, r.i32()), fn: fname(r, pkg) });
        }
        return { k: 'array', inner: 'Delegate', items: items };
      }
      case 'FieldPathProperty': {
        var c = r.i32(), path = [];
        for (var j = 0; j < c && r.remaining >= 8; j++) path.push(fname(r, pkg));
        return { k: 'name', v: path.join('.') };
      }
      case 'ArrayProperty': return decodeArray(pkg, tag, r, end, modern, depth);
      case 'SetProperty': {
        r.i32();
        return decodeArray(pkg, tag, r, end, modern, depth, true);
      }
      case 'MapProperty': return decodeMap(pkg, tag, r, end, modern, depth);
      case 'StructProperty': return decodeStruct(pkg, tag.structName, buffer, start, end, modern, depth, tag.nativeStruct);
      default:
        return rawValue(buffer, start, end);
    }
  }

  function objRef(pkg, pi) {
    return { k: 'obj', pi: pi, name: pkg.indexName(pi), path: pkg.indexPath(pi) };
  }

  function readSoftPath(r, pkg, end) {
    try {
      var a = fname(r, pkg);
      if (r.remaining >= 8) {
        var save = r.tell();
        try {
          var b = fname(r, pkg);
          var sub = r.remaining >= 4 ? r.str() : '';
          return a + '.' + b + (sub ? ':' + sub : '');
        } catch (e) { r.seek(save); }
      }
      var s = r.remaining >= 4 ? r.str() : '';
      return a + (s ? ':' + s : '');
    } catch (e) { return '<soft path>'; }
  }

  function readText(r, end) {
    try {
      r.i32();                         /* flags */
      var history = r.i8();
      if (history === -1) {
        if (r.remaining >= 4) {
          var has = r.i32();
          if (has && r.remaining >= 4) return r.str();
        }
        return '';
      }
      if (history === 0) {
        r.str(); r.str();              /* namespace, key */
        return r.str();
      }
      return '<localised text>';
    } catch (e) { return '<text>'; }
  }

  /* Fixed-width element readers, used for arrays/sets/maps. */
  function elementReader(pkg, type, structName, modern, depth) {
    switch (type) {
      case 'ObjectProperty': case 'ClassProperty': case 'WeakObjectProperty':
      case 'LazyObjectProperty': case 'InterfaceProperty':
        return function (r) { return objRef(pkg, r.i32()); };
      case 'IntProperty': return function (r) { return r.i32(); };
      case 'Int64Property': return function (r) { return r.i64(); };
      case 'FloatProperty': return function (r) { return r.f32(); };
      case 'DoubleProperty': return function (r) { return r.f64(); };
      case 'ByteProperty': return function (r) { return r.u8v(); };
      case 'BoolProperty': return function (r) { return r.u8v() !== 0; };
      case 'NameProperty': return function (r) { return { k: 'name', v: fname(r, pkg) }; };
      case 'EnumProperty': return function (r) { return { k: 'name', v: fname(r, pkg) }; };
      case 'StrProperty': return function (r) { return r.str(); };
      case 'TextProperty': return function (r) { return { k: 'text', v: readText(r, r.end) }; };
      case 'SoftObjectProperty': case 'SoftClassProperty':
        return function (r) { return { k: 'soft', v: readSoftPath(r, pkg, r.end) }; };
      default:
        return null;
    }
  }

  function decodeArray(pkg, tag, r, end, modern, depth, isSet) {
    var count = r.i32();
    if (count < 0 || count > 1000000) throw ParseError('bogus array count ' + count, r.pos - 4);
    var inner = tag.innerType || (tag.params[0] && tag.params[0].name);
    var items = [];

    if (inner === 'StructProperty') {
      /* The classic format writes a dummy element tag first; the modern one does not. */
      if (!modern && pkg.ue4Version >= V.ARRAY_INNER_TAGS) {
        var save = r.tell();
        try {
          var probe = readTagClassic(r, pkg);
          if (!probe || probe.type !== 'StructProperty') r.seek(save);
          else tag.structName = probe.structName;
        } catch (e) { r.seek(save); }
      }
      var sname = tag.structName || (tag.params[0] && tag.params[0].params[0] && tag.params[0].params[0].name);
      /* Tagged elements are self-delimiting (each ends with None), so their real
         boundary comes from the parse. Natively serialised elements are not, so
         those fall back to an even split of the payload. */
      var perItem = count > 0 ? Math.floor((end - r.tell()) / count) : 0;
      for (var i = 0; i < count; i++) {
        var s = r.tell();
        if (s >= end) break;
        var v = null, next = null;
        try {
          var chain = readChain(pkg, r.buffer, s, end, modern, depth + 1);
          if (chain.terminated && chain.props.length) {
            v = { k: 'struct', name: sname, props: chain.props, __end: chain.end };
            next = chain.end;
          }
        } catch (e) { /* fall through to fixed-stride decoding */ }
        if (!v) {
          var e2 = Math.min(end, s + (perItem || (end - s)));
          try { v = decodeStruct(pkg, sname, r.buffer, s, e2, modern, depth + 1, true); }
          catch (err) { v = rawValue(r.buffer, s, e2); }
          next = (v && typeof v.__end === 'number' && v.__end > s) ? v.__end : e2;
        }
        items.push(v);
        r.seek(next);
      }
      return { k: 'array', inner: sname || 'Struct', items: items };
    }

    var read = elementReader(pkg, inner, null, modern, depth);
    if (!read) return { k: 'array', inner: inner || '?', items: [], raw: rawValue(r.buffer, r.tell(), end) };
    for (var j = 0; j < count; j++) {
      if (r.tell() >= end) break;
      items.push(read(r));
    }
    return { k: isSet ? 'set' : 'array', inner: inner, items: items };
  }

  function decodeMap(pkg, tag, r, end, modern, depth) {
    r.i32();                            /* keys to remove */
    var count = r.i32();
    if (count < 0 || count > 1000000) throw ParseError('bogus map count ' + count, r.pos - 4);
    var kt = tag.keyType || (tag.params[0] && tag.params[0].name);
    var vt = tag.valueType || (tag.params[1] && tag.params[1].name);
    var rk = elementReader(pkg, kt, null, modern, depth);
    var rv = elementReader(pkg, vt, null, modern, depth);
    if (!rk || !rv) return { k: 'map', items: [], raw: rawValue(r.buffer, r.tell(), end) };
    var items = [];
    for (var i = 0; i < count && r.tell() < end; i++) {
      items.push({ key: rk(r), value: rv(r) });
    }
    return { k: 'map', keyType: kt, valueType: vt, items: items };
  }

  /* --------------------------------------------------------------- structs */

  function vec(r, n, wide) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(wide ? r.f64() : r.f32());
    return out;
  }
  function fixed(v) { return Math.abs(v) < 1e-6 ? 0 : Math.round(v * 1e4) / 1e4; }

  var NATIVE = {
    Guid: function (r) { return { k: 'guid', v: r.guid() }; },
    Color: function (r) {
      var b = r.u8v(), g = r.u8v(), rr = r.u8v(), a = r.u8v();
      return { k: 'color', rgba: [rr, g, b, a] };
    },
    LinearColor: function (r) {
      var c = vec(r, 4, false);
      return {
        k: 'color',
        rgba: [Math.round(Math.min(1, Math.max(0, c[0])) * 255), Math.round(Math.min(1, Math.max(0, c[1])) * 255),
               Math.round(Math.min(1, Math.max(0, c[2])) * 255), Math.round(Math.min(1, Math.max(0, c[3])) * 255)],
        linear: c.map(fixed)
      };
    },
    Vector: function (r, size) { return { k: 'vec', v: vec(r, 3, size >= 24).map(fixed), labels: ['X', 'Y', 'Z'] }; },
    Vector3f: function (r) { return { k: 'vec', v: vec(r, 3, false).map(fixed), labels: ['X', 'Y', 'Z'] }; },
    Vector3d: function (r) { return { k: 'vec', v: vec(r, 3, true).map(fixed), labels: ['X', 'Y', 'Z'] }; },
    Vector2D: function (r, size) { return { k: 'vec', v: vec(r, 2, size >= 16).map(fixed), labels: ['X', 'Y'] }; },
    Vector4: function (r, size) { return { k: 'vec', v: vec(r, 4, size >= 32).map(fixed), labels: ['X', 'Y', 'Z', 'W'] }; },
    Rotator: function (r, size) { return { k: 'vec', v: vec(r, 3, size >= 24).map(fixed), labels: ['Pitch', 'Yaw', 'Roll'] }; },
    Quat: function (r, size) { return { k: 'vec', v: vec(r, 4, size >= 32).map(fixed), labels: ['X', 'Y', 'Z', 'W'] }; },
    IntPoint: function (r) { return { k: 'vec', v: [r.i32(), r.i32()], labels: ['X', 'Y'] }; },
    IntVector: function (r) { return { k: 'vec', v: [r.i32(), r.i32(), r.i32()], labels: ['X', 'Y', 'Z'] }; },
    DateTime: function (r) { return { k: 'scalar', v: r.i64() }; },
    Timespan: function (r) { return { k: 'scalar', v: r.i64() }; },
    FrameNumber: function (r) { return { k: 'scalar', v: r.i32() }; },
    RandomStream: function (r) { return { k: 'scalar', v: r.i32() }; },
    /* FEdGraphPinType has a custom serialiser. The three fields that matter sit at
       fixed offsets; the packed flags in the final byte carry the container kind. */
    EdGraphPinType: function (r, size, pkg) {
      function nm() {
        var i = r.i32(), n = r.i32();
        return (i >= 0 && i < pkg.names.length) ? pkg.name(i, n) : null;
      }
      var cat = nm(), sub = nm(), objIdx = r.i32();
      if (!cat) throw ParseError('not a pin type', r.pos);
      var props = [{ name: 'PinCategory', type: 'NameProperty', value: { k: 'name', v: cat } }];
      if (sub && sub !== 'None') props.push({ name: 'PinSubCategory', type: 'NameProperty', value: { k: 'name', v: sub } });
      if (objIdx) props.push({ name: 'PinSubCategoryObject', type: 'ObjectProperty', value: objRef(pkg, objIdx) });
      var container = size > 0 ? r.u8[r.end - 1] : 0;
      if (container >= 1 && container <= 3) {
        props.push({ name: 'ContainerType', type: 'ByteProperty', value: container });
      }
      r.seek(r.end);
      return { k: 'struct', name: 'EdGraphPinType', props: props };
    },
    Transform: function (r, size) {
      var wide = size >= 80;
      return {
        k: 'transform',
        rotation: vec(r, 4, wide).map(fixed),
        translation: vec(r, 3, wide).map(fixed),
        scale: vec(r, 3, wide).map(fixed)
      };
    }
  };

  function decodeStruct(pkg, structName, buffer, start, end, modern, depth, nativeHint) {
    var size = end - start;

    /* Tagged bodies are self-describing, so try that first unless the tag says
       the struct uses a custom serialiser. */
    if (!nativeHint && size >= 8 && depth < 12) {
      var chain = readChain(pkg, buffer, start, end, modern, depth + 1);
      if (chain.terminated && chain.props.length && !chain.props.some(function (p) { return p.error; })) {
        return { k: 'struct', name: structName, props: chain.props, __end: chain.end };
      }
    }

    var fn = NATIVE[structName];
    if (fn) {
      try {
        var r = new Reader(buffer, start, end);
        var v = fn(r, size, pkg);
        if (!v.name) v.name = structName;
        v.__end = r.tell();
        return v;
      } catch (e) { /* fall through */ }
    }

    if (!nativeHint) {
      /* Last resort: an empty struct still terminates with None. */
      var chain2 = readChain(pkg, buffer, start, end, modern, depth + 1);
      if (chain2.terminated) return { k: 'struct', name: structName, props: chain2.props, __end: chain2.end };
    }
    var raw = rawValue(buffer, start, end);
    raw.name = structName;
    raw.__end = end;
    return raw;
  }

  /* ------------------------------------------------------------ public API */

  /* Decide which tag format this package uses by trying both on real exports. */
  UA.detectPropertyFormat = function (pkg) {
    var votes = { modern: 0, classic: 0 };
    var tested = 0;
    for (var i = 0; i < pkg.exports.length && tested < 12; i++) {
      var e = pkg.exports[i];
      var d = pkg.exportDataFor(e);
      if (!d || d.end - d.start < 12) continue;
      tested++;
      var scriptEnd = (e.scriptEnd >= 0 && e.scriptEnd <= e.serialSize) ? d.start + e.scriptEnd : d.end;
      var m = readChain(pkg, d.buffer, d.start + 1, scriptEnd, true, 0);
      var c = readChain(pkg, d.buffer, d.start, scriptEnd, false, 0);
      var ms = scoreChain(m, scriptEnd), cs = scoreChain(c, scriptEnd);
      if (ms > cs) votes.modern++;
      else if (cs > ms) votes.classic++;
    }
    pkg.propertyFormat = votes.modern >= votes.classic && votes.modern > 0 ? 'modern'
      : (votes.classic > 0 ? 'classic' : (pkg.ue5Version >= 1012 ? 'modern' : 'classic'));
    return pkg.propertyFormat;
  };

  function scoreChain(chain, expectedEnd) {
    var s = 0;
    if (chain.terminated) s += 6;
    if (chain.end === expectedEnd) s += 6;
    s += Math.min(chain.props.length, 12);
    for (var i = 0; i < chain.props.length; i++) if (chain.props[i].error) s -= 3;
    return s;
  }

  /* Parse one export's script properties. Returns { props, map, trailingStart }. */
  UA.readExportProperties = function (pkg, e) {
    var d = pkg.exportDataFor(e);
    if (!d) return { props: [], map: {}, trailingStart: null, trailingEnd: null, missing: true };
    var modern = pkg.propertyFormat === 'modern';
    var lead = modern ? 1 : 0;
    var hardEnd = (e.scriptEnd >= 0 && e.scriptEnd <= e.serialSize) ? d.start + e.scriptEnd : d.end;
    var chain = readChain(pkg, d.buffer, d.start + lead, hardEnd, modern, 0);
    if (!chain.terminated && lead) {
      var alt = readChain(pkg, d.buffer, d.start, hardEnd, modern, 0);
      if (alt.terminated) chain = alt;
    }
    var map = {};
    for (var i = 0; i < chain.props.length; i++) {
      if (!(chain.props[i].name in map)) map[chain.props[i].name] = chain.props[i];
    }
    return {
      props: chain.props,
      map: map,
      buffer: d.buffer,
      dataStart: d.start,
      dataEnd: d.end,
      trailingStart: (e.scriptEnd >= 0 && e.scriptEnd <= e.serialSize) ? d.start + e.scriptEnd : chain.end,
      trailingEnd: d.end
    };
  };

  UA.readChain = readChain;

  /* Compact one-line rendering of a decoded value. */
  UA.valueToText = function (v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'string') return v === '' ? '""' : v;
    switch (v.k) {
      case 'name': return v.v;
      case 'text': return v.v || '""';
      case 'obj': return v.pi ? v.name : 'None';
      case 'soft': return v.v;
      case 'guid': return UA.formatGuid(v.v);
      case 'color': return 'RGBA(' + v.rgba.join(', ') + ')';
      case 'vec': return '(' + v.v.map(function (x, i) { return (v.labels[i] || '') + '=' + x; }).join(', ') + ')';
      case 'transform': return 'T' + JSON.stringify(v.translation) + ' R' + JSON.stringify(v.rotation) + ' S' + JSON.stringify(v.scale);
      case 'scalar': return String(v.v);
      case 'struct': return v.name ? v.name + ' { ' + v.props.length + ' }' : '{ ' + v.props.length + ' }';
      case 'array': return (v.inner || '') + '[' + v.items.length + ']';
      case 'set': return 'Set[' + v.items.length + ']';
      case 'map': return 'Map[' + v.items.length + ']';
      case 'delegate': return (v.object && v.object.name) + '::' + v.fn;
      case 'raw': return '<' + v.size + ' bytes>';
      default: return String(v);
    }
  };

  /* Convenience accessors used by the blueprint model. */
  UA.propNumber = function (map, key, dflt) {
    var p = map[key];
    if (!p) return dflt;
    var v = p.value;
    if (typeof v === 'number') return v;
    if (v && v.k === 'scalar' && typeof v.v === 'number') return v.v;
    return dflt;
  };
  UA.propString = function (map, key) {
    var p = map[key];
    if (!p) return null;
    var v = p.value;
    if (typeof v === 'string') return v;
    if (v && (v.k === 'name' || v.k === 'text')) return v.v;
    return null;
  };
  UA.propBool = function (map, key, dflt) {
    var p = map[key];
    if (!p) return dflt;
    return p.value === true;
  };
  UA.propObjIndex = function (map, key) {
    var p = map[key];
    if (p && p.value && p.value.k === 'obj') return p.value.pi;
    return 0;
  };
  UA.propObjArray = function (map, key) {
    var p = map[key];
    if (!p || !p.value || p.value.k !== 'array') return [];
    return p.value.items.filter(function (x) { return x && x.k === 'obj' && x.pi; }).map(function (x) { return x.pi; });
  };
  /* Pull a named field out of a decoded struct value. */
  UA.structField = function (v, key) {
    if (!v || v.k !== 'struct' || !v.props) return null;
    for (var i = 0; i < v.props.length; i++) if (v.props[i].name === key) return v.props[i].value;
    return null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
