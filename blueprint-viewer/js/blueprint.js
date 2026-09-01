/* Builds the browsable model: graphs, their nodes and wires, plus variables,
   components and interfaces. */
(function (global) {
  'use strict';
  var UA = global.UA;

  var GRAPH_SOURCES = [
    ['UbergraphPages', 'Event Graph'],
    ['EventGraphs', 'Event Graph'],
    ['FunctionGraphs', 'Function'],
    ['MacroGraphs', 'Macro'],
    ['DelegateSignatureGraphs', 'Event Dispatcher'],
    ['IntermediateGeneratedGraphs', 'Intermediate']
  ];

  var HEADER_H = 28, SUBTITLE_H = 12, ROW_H = 18, PAD_V = 8;
  var CHAR_W = 6.4, TITLE_CHAR_W = 6.9;

  function textW(s, cw) { return (s ? String(s).length : 0) * cw; }

  /* The editor hides an unconnected self/Target pin (static library calls,
     variable accessors), so leaving it out keeps node sizes true to the graph. */
  function isHiddenPin(p) {
    return p.name === 'self' && (!p.links || !p.links.length);
  }

  function measureNode(node) {
    if (node.kind === 'comment') {
      node.w = Math.max(120, node.commentW || 400);
      node.h = Math.max(60, node.commentH || 200);
      return;
    }
    if (node.kind === 'knot') { node.w = 22; node.h = 22; return; }

    node.pins.forEach(function (p) { p.hidden = isHiddenPin(p); });
    var visible = node.pins.filter(function (p) { return !p.hidden; });

    var ins = visible.filter(function (p) { return p.direction === 0; });
    var outs = visible.filter(function (p) { return p.direction === 1; });
    if (!ins.length && !outs.length && visible.length) {
      /* Direction unavailable: fall back to declaration order. */
      ins = visible.filter(function (p, i) { return i % 2 === 0; });
      outs = visible.filter(function (p, i) { return i % 2 === 1; });
    }
    node.inputs = ins;
    node.outputs = outs;

    var maxIn = 0, maxOut = 0;
    ins.forEach(function (p) { maxIn = Math.max(maxIn, textW(pinLabel(p), CHAR_W)); });
    outs.forEach(function (p) { maxOut = Math.max(maxOut, textW(pinLabel(p), CHAR_W)); });

    node.inLabelMax = maxIn;
    node.outLabelMax = maxOut;

    /* Variable reads are drawn title-less in the editor: the pin label is the name. */
    node.compact = node.kind === 'variableGet';
    node.headerH = node.compact ? 0 : HEADER_H + (node.subtitle ? SUBTITLE_H : 0);

    var rows = Math.max(ins.length, outs.length);
    if (node.compact) {
      node.w = Math.max(112, Math.ceil((maxIn + maxOut + 46) / 2) * 2);
    } else {
      var titleW = textW(node.title, TITLE_CHAR_W) + 24;
      if (node.subtitle) titleW = Math.max(titleW, textW(node.subtitle, CHAR_W * 0.92) + 24);
      node.w = Math.max(136, Math.ceil(Math.max(titleW, maxIn + maxOut + 50) / 2) * 2);
    }
    node.w = Math.min(node.w, 460);
    node.h = node.headerH + rows * ROW_H + PAD_V + (node.compact ? 4 : 0);
  }

  function pinLabel(p) {
    if (!p) return '';
    var n = p.name || '';
    if (n === 'execute' || n === 'then' || n === 'exec') return '';
    if (n === 'self') return 'Target';
    if (n === 'ReturnValue') return 'Return Value';
    return UA.prettify(n);
  }
  UA.pinLabel = pinLabel;

  /* The headline object of a package: the asset itself, not bookkeeping exports. */
  function pickPrimaryExport(pkg) {
    var leaf = (pkg.folderName || '').split('/').pop();
    var byName = null, byFlag = null, firstReal = null;
    for (var i = 0; i < pkg.exports.length; i++) {
      var e = pkg.exports[i];
      if (e.className === 'MetaData' || /^Default__/.test(e.objectName)) continue;
      if (!firstReal) firstReal = e;
      if (!byFlag && e.isAsset && !e.outerIndex) byFlag = e;
      if (!byName && leaf && e.objectName === leaf) byName = e;
    }
    return byName || byFlag || firstReal || pkg.exports[0] || null;
  }

  function nodeGuid(map) {
    var p = map.NodeGuid;
    if (p && p.value && p.value.k === 'guid') return p.value.v;
    return null;
  }

  /**
   * @param {Package} pkg
   * @returns {Object} model
   */
  UA.buildModel = function (pkg) {
    UA.detectPropertyFormat(pkg);

    /* Parse every export's tagged properties once. */
    var objects = {};
    for (var i = 0; i < pkg.exports.length; i++) {
      var e = pkg.exports[i];
      var props;
      try { props = UA.readExportProperties(pkg, e); }
      catch (err) { props = { props: [], map: {}, error: err.message, trailingStart: null }; }
      objects[i] = { index: i, export: e, props: props };
    }

    var pinData = UA.extractPins(pkg, objects);

    var model = {
      pkg: pkg,
      objects: objects,
      graphs: [],
      graphByExport: {},
      variables: [],
      components: [],
      interfaces: [],
      warnings: pkg.warnings.slice(),
      pinStats: pinData.stats
    };

    /* ---- asset summary ---- */
    var bpExport = null, genClass = null;
    for (var b = 0; b < pkg.exports.length; b++) {
      var cn = pkg.exports[b].className || '';
      if (/Blueprint$/.test(cn) && !/GeneratedClass/.test(cn)) { bpExport = pkg.exports[b]; break; }
    }
    for (var g = 0; g < pkg.exports.length; g++) {
      if (/GeneratedClass$/.test(pkg.exports[g].className || '')) { genClass = pkg.exports[g]; break; }
    }
    var bpMap = bpExport ? objects[bpExport.index].props.map : {};
    var primary = bpExport || pickPrimaryExport(pkg);
    model.asset = {
      name: primary ? primary.objectName : pkg.fileName,
      className: primary ? primary.className : '—',
      parentClass: bpMap.ParentClass ? pkg.indexPath(UA.propObjIndex(bpMap, 'ParentClass')) : null,
      generatedClass: genClass ? genClass.objectName : null,
      package: pkg.folderName,
      isBlueprint: !!bpExport
    };

    /* ---- graphs ---- */
    var claimed = {};
    function addGraph(pi, category, parent) {
      if (!pi || pi <= 0) return null;
      var idx = pi - 1;
      var exp = pkg.exports[idx];
      if (!exp || claimed[idx]) return claimed[idx] || null;
      var o = objects[idx];
      if (!o) return null;
      var graph = buildGraph(pkg, model, o, category, parent);
      claimed[idx] = graph;
      model.graphs.push(graph);
      model.graphByExport[idx] = graph;

      /* Nested graphs: explicit SubGraphs plus collapsed-graph nodes. */
      var subs = UA.propObjArray(o.props.map, 'SubGraphs');
      for (var s = 0; s < subs.length; s++) addGraph(subs[s], 'Collapsed', graph);
      for (var n = 0; n < graph.nodes.length; n++) {
        var bg = graph.nodes[n].boundGraph;
        if (bg && bg > 0 && !claimed[bg - 1]) {
          var childCat = graph.nodes[n].className === 'K2Node_MacroInstance' ? 'Macro' : 'Collapsed';
          addGraph(bg, childCat, graph);
        }
      }
      return graph;
    }

    if (bpExport) {
      for (var s2 = 0; s2 < GRAPH_SOURCES.length; s2++) {
        var list = UA.propObjArray(bpMap, GRAPH_SOURCES[s2][0]);
        for (var k = 0; k < list.length; k++) addGraph(list[k], GRAPH_SOURCES[s2][1], null);
      }
      /* Interfaces carry their own graphs. */
      var ifp = bpMap.ImplementedInterfaces;
      if (ifp && ifp.value && ifp.value.k === 'array') {
        ifp.value.items.forEach(function (item) {
          var iface = UA.structField(item, 'Interface');
          var entry = { name: iface && iface.k === 'obj' ? iface.name : 'Interface', graphs: [] };
          var gs = UA.structField(item, 'Graphs');
          if (gs && gs.k === 'array') {
            gs.items.forEach(function (x) {
              if (x && x.k === 'obj' && x.pi) {
                var gr = addGraph(x.pi, 'Interface', null);
                if (gr) entry.graphs.push(gr.id);
              }
            });
          }
          model.interfaces.push(entry);
        });
      }
    }

    /* Anything graph-shaped that the blueprint did not reference. */
    for (var x = 0; x < pkg.exports.length; x++) {
      if (claimed[x]) continue;
      var ex = pkg.exports[x], om = objects[x].props.map;
      var isGraph = (ex.className === 'EdGraph' || /Graph$/.test(ex.className || '')) &&
        om.Nodes && om.Nodes.value && om.Nodes.value.k === 'array';
      if (isGraph) addGraph(x + 1, 'Other', null);
    }

    /* Construction script reads better as its own section. */
    model.graphs.forEach(function (gr) {
      if (gr.name === 'UserConstructionScript') { gr.category = 'Construction Script'; gr.displayName = 'Construction Script'; }
      /* A .umap's script lives on the LevelScriptBlueprint — name it as the editor does. */
      if (model.asset.className === 'LevelScriptBlueprint' && gr.category === 'Event Graph') {
        gr.displayName = 'Level Blueprint';
      }
    });

    /* ---- variables ---- */
    var nv = bpMap.NewVariables;
    if (nv && nv.value && nv.value.k === 'array') {
      nv.value.items.forEach(function (item) {
        var vn = UA.structField(item, 'VarName');
        var vt = UA.structField(item, 'VarType');
        var cat = UA.structField(vt, 'PinCategory');
        var subObj = UA.structField(vt, 'PinSubCategoryObject');
        var sub = UA.structField(vt, 'PinSubCategory');
        var container = UA.structField(vt, 'ContainerType');
        var catName = cat && cat.k === 'name' ? cat.v : null;
        model.variables.push({
          name: vn && vn.k === 'name' ? vn.v : '(unnamed)',
          category: catName,
          subCategory: sub && sub.k === 'name' && sub.v !== 'None' ? sub.v : null,
          typeObject: subObj && subObj.k === 'obj' && subObj.pi ? subObj.name : null,
          container: typeof container === 'number' ? container : 0,
          defaultValue: (function () {
            var d = UA.structField(item, 'DefaultValue');
            return typeof d === 'string' && d ? d : null;
          })(),
          group: (function () {
            var c = UA.structField(item, 'Category');
            return c && c.k === 'text' && c.v && c.v !== 'Default' ? c.v : null;
          })(),
          struct: item
        });
      });
    }

    /* ---- components (simple construction script) ---- */
    var scsPi = UA.propObjIndex(bpMap, 'SimpleConstructionScript');
    if (scsPi > 0 && objects[scsPi - 1]) {
      var scsMap = objects[scsPi - 1].props.map;
      var roots = UA.propObjArray(scsMap, 'RootNodes');
      var all = roots.length ? roots : UA.propObjArray(scsMap, 'AllNodes');
      var seenScs = {};
      (function walk(list, depth) {
        list.forEach(function (pi) {
          var idx = pi - 1;
          if (seenScs[idx] || !objects[idx]) return;
          seenScs[idx] = true;
          var m = objects[idx].props.map;
          var varName = UA.propString(m, 'InternalVariableName');
          var compClass = UA.propObjIndex(m, 'ComponentClass');
          model.components.push({
            name: varName || pkg.exports[idx].objectName,
            className: compClass ? pkg.indexName(compClass) : null,
            depth: depth,
            exportIndex: idx
          });
          walk(UA.propObjArray(m, 'ChildNodes'), depth + 1);
        });
      })(all, 0);
    }

    model.graphs.sort(function (a, b) {
      var order = ['Event Graph', 'Construction Script', 'Function', 'Macro', 'Interface',
        'Event Dispatcher', 'Collapsed', 'Intermediate', 'Other'];
      var d = order.indexOf(a.category) - order.indexOf(b.category);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });

    model.stats = {
      names: pkg.names.length,
      imports: pkg.imports.length,
      exports: pkg.exports.length,
      graphs: model.graphs.length,
      nodes: model.graphs.reduce(function (s, gr) { return s + gr.nodes.length; }, 0),
      pins: pinData.stats.pins,
      links: pinData.stats.links,
      pinMode: pinData.stats.mode,
      directionConfidence: pinData.stats.directionConfidence
    };

    if (pinData.stats.pins === 0 && model.stats.nodes > 0) {
      model.warnings.push('No pin data was recognised in this file, so nodes are shown without ' +
        'connections. Node titles and positions are still accurate.');
    } else if (pinData.stats.directionConfidence < 0.9 && pinData.stats.pins > 0) {
      model.warnings.push('Pin direction could not be confirmed for this engine version; ' +
        'inputs and outputs may be shown on the wrong side.');
    }
    return model;

    /* ------------------------------------------------------------------ */

    function buildGraph(pkg2, model2, o, category, parent) {
      var exp = o.export, map = o.props.map;
      var graph = {
        id: 'g' + o.index,
        exportIndex: o.index,
        name: exp.objectName,
        displayName: exp.objectName,
        category: category,
        parentId: parent ? parent.id : null,
        schema: UA.propObjIndex(map, 'Schema') ? pkg2.indexName(UA.propObjIndex(map, 'Schema')) : null,
        guid: (function () { var p = map.GraphGuid; return p && p.value && p.value.k === 'guid' ? p.value.v : null; })(),
        nodes: [],
        edges: []
      };
      var nodeIdx = UA.propObjArray(map, 'Nodes');
      var slotToNode = {};

      nodeIdx.forEach(function (pi) {
        var idx = pi - 1;
        var no = objects[idx];
        if (!no) return;
        var nmap = no.props.map;
        var pinRec = pinData.byNode[idx];
        var desc = UA.describeNode(pkg2, no, pinRec ? pinRec.pins : null);
        var node = {
          index: idx,
          id: 'n' + idx,
          className: no.export.className,
          objectName: no.export.objectName,
          title: desc.title,
          subtitle: desc.subtitle,
          kind: desc.kind,
          boundGraph: desc.boundGraph || 0,
          x: UA.propNumber(nmap, 'NodePosX', 0),
          y: UA.propNumber(nmap, 'NodePosY', 0),
          commentW: UA.propNumber(nmap, 'NodeWidth', 0),
          commentH: UA.propNumber(nmap, 'NodeHeight', 0),
          comment: UA.propString(nmap, 'NodeComment'),
          guid: nodeGuid(nmap),
          enabled: UA.propNumber(nmap, 'EnabledState', 0),
          advanced: UA.propBool(nmap, 'bCommentBubbleVisible', false),
          pins: pinRec ? pinRec.pins : [],
          props: no.props,
          graphId: graph.id
        };
        if (node.kind === 'comment') {
          var cc = nmap.CommentColor && nmap.CommentColor.value;
          if (cc && cc.k === 'color') node.commentColor = cc.rgba;
        }
        measureNode(node);
        slotToNode[idx] = node;
        graph.nodes.push(node);
      });

      /* Wires, deduplicated and oriented output -> input where known. */
      var seen = {};
      graph.nodes.forEach(function (node) {
        node.pins.forEach(function (pin, slot) {
          pin.links.forEach(function (l) {
            var target = slotToNode[l.node];
            if (!target) return;
            var tp = target.pins[l.slot];
            if (!tp) return;
            var ka = node.index + ':' + slot, kb = target.index + ':' + l.slot;
            var key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
            if (seen[key]) return;
            seen[key] = true;
            var from = pin, to = tp, fromNode = node, toNode = target;
            if (pin.direction === 0 && tp.direction === 1) {
              from = tp; to = pin; fromNode = target; toNode = node;
            }
            graph.edges.push({
              fromNode: fromNode, fromPin: from, toNode: toNode, toPin: to,
              exec: (from.category || '').toLowerCase() === 'exec',
              color: UA.pinColor(from.category ? from : to)
            });
          });
        });
      });

      var bounds = null;
      graph.nodes.forEach(function (n) {
        var b = { x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h };
        bounds = bounds ? {
          x0: Math.min(bounds.x0, b.x0), y0: Math.min(bounds.y0, b.y0),
          x1: Math.max(bounds.x1, b.x1), y1: Math.max(bounds.y1, b.y1)
        } : b;
      });
      graph.bounds = bounds || { x0: 0, y0: 0, x1: 400, y1: 300 };
      return graph;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
