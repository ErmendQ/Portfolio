/* UI wiring: file loading, navigation, inspector and status. */
(function (global) {
  'use strict';
  var UA = global.UA;

  var $ = function (id) { return document.getElementById(id); };
  var state = { model: null, view: null, graph: null, matches: [], matchIndex: 0,
                assets: [], activeId: null };

  /* One definition of "phone": this query sets `body.is-mobile`, which is what
     the stylesheet keys its whole mobile layout off. Feature- and size-based
     rather than user-agent sniffing, so tablets and desktop touch screens land
     in the right mode too. */
  var MOBILE_QUERY = '(max-width: 760px), (pointer: coarse) and (max-width: 1024px)';
  var mobileMQ = window.matchMedia(MOBILE_QUERY);
  function isMobile() { return mobileMQ.matches; }

  function drawerOpen() {
    return $('sidebar').classList.contains('is-open') || $('inspector').classList.contains('is-open');
  }
  function setDrawer(which, open) {
    var el = which === 'nav' ? $('sidebar') : $('inspector');
    var other = which === 'nav' ? $('inspector') : $('sidebar');
    if (open) other.classList.remove('is-open');
    el.classList.toggle('is-open', !!open);
    $('scrim').hidden = !drawerOpen();
  }
  function closeDrawers() {
    $('sidebar').classList.remove('is-open');
    $('inspector').classList.remove('is-open');
    $('scrim').hidden = true;
  }

  /* The search field belongs in the top bar on desktop and inside the drawer on
     a phone, where the bar has no room for it. Moving the element keeps one
     input (and one set of listeners) rather than two that can disagree. */
  var searchHome = null;
  function relocateSearch() {
    var wrap = document.querySelector('.search-wrap');
    if (!wrap) return;
    if (!searchHome) searchHome = { parent: wrap.parentNode, next: wrap.nextSibling };
    if (isMobile()) {
      var sidebar = $('sidebar');
      if (wrap.parentNode !== sidebar) sidebar.insertBefore(wrap, sidebar.firstChild);
    } else if (wrap.parentNode !== searchHome.parent) {
      searchHome.parent.insertBefore(wrap, searchHome.next);
    }
  }

  function applyLayout() {
    var m = isMobile();
    document.body.classList.toggle('is-mobile', m);
    relocateSearch();
    if (!m) closeDrawers();
    var heading = document.querySelector('.dropzone h1');
    if (heading && !LOCKED) heading.textContent = m ? 'Open .uasset files' : 'Drop .uasset files here';
    var open = $('openLabel');
    if (open) open.textContent = m ? 'Open' : 'Open asset';
    if (state.view) state.view.fit();
  }

  function elt(tag, cls, textContent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (textContent != null) n.textContent = textContent;
    return n;
  }

  /* ------------------------------------------------------------ file input */

  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* Every dropped or chosen .uasset joins the content browser rather than
     replacing what is already open. Files are read one at a time so a large
     multi-select keeps the strip responsive instead of freezing on a big batch. */
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var mains = files.filter(function (f) { return /\.(uasset|umap)$/i.test(f.name); });
    if (!mains.length) mains = files.slice(0, 1);
    var uexps = files.filter(function (f) { return /\.uexp$/i.test(f.name); });

    var firstAdded = null;
    var chain = Promise.resolve();
    mains.forEach(function (main) {
      chain = chain.then(function () {
        var base = main.name.replace(/\.[^.]+$/, '');
        var pair = uexps.filter(function (u) {
          return u.name.replace(/\.[^.]+$/, '') === base;
        })[0] || (mains.length === 1 ? uexps[0] : null);

        var reads = [readFile(main)];
        if (pair) reads.push(readFile(pair));
        return Promise.all(reads).then(function (buffers) {
          var entry = addAsset(main.name, buffers[0], buffers[1] || null, main.size);
          if (!firstAdded) { firstAdded = entry; selectAsset(firstAdded.id); }
        });
      });
    });
    chain.catch(function (err) {
      showError('Could not read the file', (err && err.message) || String(err));
    });
  }

  /* ------------------------------------------------------- content browser */

  var nextAssetId = 1;

  function addAsset(name, buffer, uexp, size) {
    var existing = state.assets.filter(function (a) { return a.name === name; })[0];
    var entry = existing || { id: 'a' + (nextAssetId++) };
    entry.name = name;
    entry.buffer = buffer;
    entry.uexp = uexp || null;
    entry.size = size || buffer.byteLength;
    entry.model = null;
    entry.pkg = null;
    entry.error = null;
    if (!existing) state.assets.push(entry);
    parseAsset(entry);
    renderBrowser();
    return entry;
  }

  function parseAsset(entry) {
    if (entry.model || entry.error) return entry;
    try {
      var pkg = UA.parsePackage(entry.buffer, { fileName: entry.name, uexp: entry.uexp });
      entry.pkg = pkg;
      entry.model = UA.buildModel(pkg);
      entry.label = entry.model.asset.name;
      entry.kind = entry.model.asset.className;
      entry.engine = engineLabel(pkg);
    } catch (err) {
      entry.error = (err && err.message) || String(err);
      entry.label = entry.name.replace(/\.[^.]+$/, '');
      entry.kind = null;
    }
    return entry;
  }

  function assetColor(entry) {
    if (entry.error) return 'var(--danger)';
    var k = entry.kind || '';
    if (/Blueprint$/.test(k) && !/Generated/.test(k)) return 'var(--accent)';
    if (k === 'World') return '#4a9bd8';
    if (/Struct|Enum/.test(k)) return '#c78bff';
    return 'var(--text-faint)';
  }

  function renderBrowser() {
    var bar = $('browser'), list = $('browserList');
    bar.hidden = state.assets.length === 0;
    list.innerHTML = '';

    /* Tabs are labelled by asset name, which reads better than the file name —
       unless two open files carry the same one, where the file name is the only
       thing that tells them apart. */
    var seen = {};
    state.assets.forEach(function (a) {
      var l = a.label || a.name;
      seen[l] = (seen[l] || 0) + 1;
    });

    state.assets.forEach(function (a) {
      var tab = elt('button', 'asset-tab' +
        (a.id === state.activeId ? ' is-active' : '') + (a.error ? ' is-bad' : ''));
      tab.type = 'button';
      var dot = elt('span', 'dot');
      dot.style.background = assetColor(a);
      tab.appendChild(dot);
      var label = a.label || a.name;
      tab.appendChild(elt('span', 'name', seen[label] > 1 ? a.name : label));
      tab.appendChild(elt('span', 'meta', a.error ? 'unreadable' : (a.kind || '')));
      tab.title = a.error ? a.name + '\n' + a.error : a.name;
      tab.addEventListener('click', function () { selectAsset(a.id); });

      list.appendChild(tab);
    });
    var active = list.querySelector('.asset-tab.is-active');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function selectAsset(id) {
    var entry = state.assets.filter(function (a) { return a.id === id; })[0];
    if (!entry) return;
    state.activeId = id;
    parseAsset(entry);
    renderBrowser();
    if (entry.error) {
      showError('This file could not be parsed', entry.error);
      return;
    }
    hideError();
    applyAsset(entry);
  }

  function removeAsset(id) {
    var i = -1;
    state.assets.forEach(function (a, n) { if (a.id === id) i = n; });
    if (i < 0) return;
    var wasActive = state.activeId === id;
    state.assets.splice(i, 1);
    if (!wasActive) { renderBrowser(); return; }
    var next = state.assets[Math.min(i, state.assets.length - 1)];
    if (next) selectAsset(next.id);
    else clearViewer();
  }

  function clearViewer() {
    state.activeId = null;
    state.model = null;
    state.graph = null;
    if (state.view) state.view.setGraph(null);
    setCrumbs(null);
    hideError();
    $('dropzone').classList.remove('is-hidden');
    $('stageToolbar').hidden = true;
    if ($('fileChip')) $('fileChip').hidden = true;
    $('sidebarContent').innerHTML = '';
    $('sidebarContent').hidden = true;
    $('sidebarEmpty').hidden = false;
    $('inspectorContent').innerHTML = '';
    $('inspectorContent').hidden = true;
    $('inspectorEmpty').hidden = false;
    $('statusLeft').innerHTML = '';
    $('statusRight').innerHTML = '';
    closeDrawers();
    renderBrowser();
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error('read failed')); };
      fr.readAsArrayBuffer(file);
    });
  }

  /* Show an already-parsed asset. Models stay cached on their browser entry, so
     switching between open assets is instant and never re-reads the file. */
  function applyAsset(entry) {
    var model = entry.model, pkg = entry.pkg;
    state.model = model;
    $('dropzone').classList.add('is-hidden');
    $('stageToolbar').hidden = false;

    var chip = $('fileChip');
    if (chip) {
      chip.hidden = false;
      chip.innerHTML = '';
      chip.appendChild(elt('b', null, entry.name));
      chip.appendChild(elt('span', null, bytes(entry.size) + ' · UE ' + engineLabel(pkg)));
      chip.title = 'legacy ' + pkg.legacyFileVersion + ' · UE4 object version ' + pkg.ue4Version +
        (pkg.ue5Version ? ' · UE5 object version ' + pkg.ue5Version : '');
    }

    buildSidebar(model);
    ensureView();
    var first = model.graphs[0];
    if (first) {
      openGraph(first);
    } else {
      state.view.setGraph(null);
      setCrumbs(null);
    }
    /* On a phone the drawer is the only way to see what the asset contains,
       so show it once the file is open. */
    if (isMobile()) setDrawer('nav', true);
    updateStatus();
  }

  /* Approximate: engine releases share object versions, so these are ranges.
     The exact numbers are always shown in the Diagnostics panel. */
  function engineLabel(pkg) {
    if (pkg.legacyFileVersion <= -9) return '5.7+';
    var v5 = pkg.ue5Version;
    if (v5 >= 1013) return '5.6';
    if (v5 >= 1012) return '5.5';
    if (v5 >= 1010) return '5.3–5.4';
    if (v5 >= 1009) return '5.2';
    if (v5 >= 1004) return '5.1';
    if (v5 > 0) return '5.0';
    if (pkg.ue4Version >= 522) return '4.27';
    if (pkg.ue4Version >= 518) return '4.26';
    if (pkg.ue4Version >= 513) return '4.25';
    if (pkg.ue4Version >= 505) return '4.22–4.24';
    if (pkg.ue4Version > 0) return '4.x';
    return '?';
  }

  /* -------------------------------------------------------------- sidebar */

  function section(title, count, collapsed) {
    var wrap = elt('div', 'section' + (collapsed ? ' is-collapsed' : ''));
    var head = elt('button', 'section-head');
    head.type = 'button';
    head.appendChild(elt('span', 'chev', '▼'));
    head.appendChild(elt('span', null, title));
    if (count != null) head.appendChild(elt('span', 'count', String(count)));
    head.addEventListener('click', function () { wrap.classList.toggle('is-collapsed'); });
    wrap.appendChild(head);
    var body = elt('div', 'section-body');
    wrap.appendChild(body);
    wrap.body = body;
    return wrap;
  }

  var CATEGORY_COLORS = {
    'Event Graph': '#9c2b2b',
    'Construction Script': '#1c5c8c',
    'Function': '#1c5c8c',
    'Macro': '#2f5f96',
    'Interface': '#6b3a92',
    'Event Dispatcher': '#b0553a',
    'Collapsed': '#2b7a4f',
    'Intermediate': '#4a4d55',
    'Other': '#4a4d55'
  };

  function buildSidebar(model) {
    var root = $('sidebarContent');
    root.innerHTML = '';
    root.hidden = false;
    $('sidebarEmpty').hidden = true;

    var card = elt('div', 'asset-card');
    card.appendChild(elt('h2', null, model.asset.name));
    addKV(card, 'Class', model.asset.className);
    if (model.asset.parentClass) addKV(card, 'Parent', model.asset.parentClass);
    if (model.asset.package) addKV(card, 'Package', model.asset.package);
    root.appendChild(card);

    if (model.warnings.length) {
      var warnWrap = elt('div', 'warnings');
      model.warnings.forEach(function (w) {
        var box = elt('div', 'warning');
        box.appendChild(elt('span', null, '⚠'));
        box.appendChild(elt('span', null, w));
        warnWrap.appendChild(box);
      });
      root.appendChild(warnWrap);
    }

    /* Graphs grouped by category, in the order the model sorted them. */
    var byCat = {};
    var catOrder = [];
    model.graphs.forEach(function (g) {
      if (!byCat[g.category]) { byCat[g.category] = []; catOrder.push(g.category); }
      byCat[g.category].push(g);
    });
    catOrder.forEach(function (cat) {
      var list = byCat[cat];
      var sec = section(cat + (list.length > 1 ? 's' : ''), list.length, false);
      list.forEach(function (g) {
        var b = elt('button', 'item');
        b.type = 'button';
        b.dataset.graph = g.id;
        var dot = elt('span', 'dot');
        dot.style.background = CATEGORY_COLORS[cat] || '#4a4d55';
        b.appendChild(dot);
        b.appendChild(elt('span', 'name', g.displayName || g.name));
        b.appendChild(elt('span', 'meta', g.nodes.length + ' nodes'));
        b.addEventListener('click', function () { openGraph(g); });
        sec.body.appendChild(b);
      });
      root.appendChild(sec);
    });

    if (model.variables.length) {
      var vs = section('Variables', model.variables.length, true);
      model.variables.forEach(function (v) {
        var row = elt('button', 'item');
        row.type = 'button';
        var dot = elt('span', 'dot');
        dot.style.background = UA.pinColor({ category: v.category, subCategoryObject: v.typeObject, subCategory: v.subCategory });
        dot.style.borderRadius = v.container ? '2px' : '50%';
        row.appendChild(dot);
        row.appendChild(elt('span', 'name', v.name));
        row.appendChild(elt('span', 'meta', v.typeObject || v.subCategory || v.category || ''));
        row.addEventListener('click', function () { showVariable(v); });
        vs.body.appendChild(row);
      });
      root.appendChild(vs);
    }

    if (model.components.length) {
      var cs = section('Components', model.components.length, true);
      model.components.forEach(function (c) {
        var row = elt('button', 'item depth-' + Math.min(c.depth, 2));
        row.type = 'button';
        row.appendChild(elt('span', 'name', c.name));
        row.appendChild(elt('span', 'meta', c.className || ''));
        row.addEventListener('click', function () { showExport(c.exportIndex); });
        cs.body.appendChild(row);
      });
      root.appendChild(cs);
    }

    var diag = section('Diagnostics', null, true);
    var dg = elt('div', 'insp-group');
    var pk = model.pkg;
    [
      ['File version', 'legacy ' + pk.legacyFileVersion],
      ['UE4 object ver', String(pk.ue4Version)],
      ['UE5 object ver', pk.ue5Version ? String(pk.ue5Version) : '—'],
      ['Licensee ver', String(pk.licenseeVersion)],
      ['Header size', pk.totalHeaderSize == null ? 'not stored' : String(pk.totalHeaderSize)],
      ['Property tags', pk.propertyFormat],
      ['Export entry', (pk.exportLayout ? pk.exportLayout.__size : '?') + ' bytes'],
      ['Summary found', pk.summaryLocatedByScan ? 'by scan' : 'by layout'],
      ['Pin marker', model.stats.pinMode],
      ['Pin direction', Math.round((model.stats.directionConfidence || 0) * 100) + '% confident'],
      ['Cooked', pk.isCooked ? 'yes' : 'no']
    ].forEach(function (row) {
      var el2 = elt('div', 'kv-row');
      el2.appendChild(elt('b', null, row[0]));
      el2.appendChild(elt('span', null, row[1]));
      dg.appendChild(el2);
    });
    diag.body.appendChild(dg);
    root.appendChild(diag);

    var objs = section('All objects', model.pkg.exports.length, true);
    model.pkg.exports.forEach(function (e) {
      var row = elt('button', 'item');
      row.type = 'button';
      row.appendChild(elt('span', 'name', e.objectName));
      row.appendChild(elt('span', 'meta', e.className || ''));
      row.addEventListener('click', function () { showExport(e.index); });
      objs.body.appendChild(row);
    });
    root.appendChild(objs);
  }

  function addKV(parent, k, v) {
    var row = elt('div', 'kv');
    row.appendChild(elt('b', null, k));
    row.appendChild(elt('span', null, v == null ? '—' : String(v)));
    parent.appendChild(row);
  }

  /* --------------------------------------------------------------- canvas */

  function ensureView() {
    if (state.view) return;
    state.view = new UA.GraphView($('canvas'), {
      onSelectNode: showNode,
      onOpenGraph: function (pi) {
        var g = state.model && state.model.graphByExport[pi - 1];
        if (g) openGraph(g);
      },
      onViewChange: function (scale) {
        $('zoomLevel').textContent = Math.round(scale * 100) + '%';
      },
      minFitScale: function () { return isMobile() ? 0.6 : 0.05; }
    });
  }

  function openGraph(graph) {
    if (!graph) return;
    ensureView();
    state.graph = graph;
    state.view.setGraph(graph);
    setCrumbs(graph);
    Array.prototype.forEach.call(document.querySelectorAll('.item[data-graph]'), function (b) {
      b.classList.toggle('is-active', b.dataset.graph === graph.id);
    });
    if (isMobile()) closeDrawers();
    applySearch();
    updateStatus();
    showGraphInfo(graph);
  }

  function setCrumbs(graph) {
    var host = $('crumbs');
    host.innerHTML = '';
    if (!graph) return;
    var chain = [];
    var g = graph, guard = 0;
    while (g && guard++ < 16) {
      chain.unshift(g);
      g = g.parentId ? state.model.graphs.filter(function (x) { return x.id === g.parentId; })[0] : null;
    }
    chain.forEach(function (item, i) {
      if (i) host.appendChild(elt('span', 'sep', '›'));
      var b = elt('button', 'crumb' + (i === chain.length - 1 ? ' current' : ''), item.displayName || item.name);
      b.type = 'button';
      if (i !== chain.length - 1) b.addEventListener('click', function () { openGraph(item); });
      host.appendChild(b);
    });
    host.appendChild(elt('span', 'tag', graph.category));
  }

  /* ------------------------------------------------------------ inspector */

  function inspectorRoot() {
    var host = $('inspectorContent');
    host.innerHTML = '';
    host.hidden = false;
    $('inspectorEmpty').hidden = true;
    return host;
  }

  function showGraphInfo(graph) {
    var host = inspectorRoot();
    var head = elt('div', 'insp-head');
    var kind = elt('span', 'kind', graph.category);
    kind.style.background = CATEGORY_COLORS[graph.category] || '#4a4d55';
    head.appendChild(kind);
    head.appendChild(elt('h3', null, graph.displayName || graph.name));
    head.appendChild(elt('div', 'cls', graph.schema || 'EdGraph'));
    host.appendChild(head);

    var g = elt('div', 'insp-group');
    g.appendChild(elt('h4', null, 'Graph'));
    kv(g, 'Nodes', String(graph.nodes.length));
    kv(g, 'Connections', String(graph.edges.length));
    if (graph.guid) kv(g, 'Guid', UA.formatGuid(graph.guid));
    kv(g, 'Export', '#' + graph.exportIndex);
    host.appendChild(g);

    var counts = {};
    graph.nodes.forEach(function (n) { counts[n.className] = (counts[n.className] || 0) + 1; });
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (keys.length) {
      var b2 = elt('div', 'insp-group');
      b2.appendChild(elt('h4', null, 'Node types'));
      keys.forEach(function (k) { kv(b2, k.replace(/^K2Node_/, ''), String(counts[k])); });
      host.appendChild(b2);
    }
  }

  function kv(parent, k, v) {
    var row = elt('div', 'kv-row');
    row.appendChild(elt('b', null, k));
    row.appendChild(elt('span', null, v));
    parent.appendChild(row);
  }

  function showNode(node) {
    if (!node) { if (state.graph) showGraphInfo(state.graph); return; }
    if (isMobile()) setDrawer('insp', true);
    var host = inspectorRoot();

    var head = elt('div', 'insp-head');
    var kind = elt('span', 'kind', node.kind);
    kind.style.background = UA.kindColor(node.kind);
    head.appendChild(kind);
    head.appendChild(elt('h3', null, node.title));
    head.appendChild(elt('div', 'cls', node.className));
    host.appendChild(head);

    if (node.boundGraph) {
      var target = state.model.graphByExport[node.boundGraph - 1];
      if (target) {
        var open = elt('div', 'insp-group');
        var btn = elt('button', 'btn btn-primary', 'Open ' + (target.displayName || target.name));
        btn.type = 'button';
        btn.addEventListener('click', function () { openGraph(target); });
        open.appendChild(btn);
        host.appendChild(open);
      }
    }

    var d = elt('div', 'insp-group');
    d.appendChild(elt('h4', null, 'Node'));
    kv(d, 'Position', node.x + ', ' + node.y);
    if (node.subtitle) kv(d, 'Subtitle', node.subtitle);
    if (node.comment && node.kind !== 'comment') kv(d, 'Comment', node.comment);
    if (node.guid) kv(d, 'Guid', UA.formatGuid(node.guid));
    kv(d, 'Export', '#' + node.index);
    host.appendChild(d);

    if (node.pins && node.pins.length) {
      var p = elt('div', 'insp-group');
      p.appendChild(elt('h4', null, 'Pins (' + node.pins.length + ')'));
      node.pins.forEach(function (pin) {
        p.appendChild(pinRow(pin));
        pin.links.forEach(function (l) {
          var other = state.model.objects[l.node];
          if (!other) return;
          var otherNode = findNodeByExport(l.node);
          var pinName = otherNode && otherNode.pins[l.slot] ? otherNode.pins[l.slot].name : '?';
          var row = elt('div', 'pin-row');
          row.appendChild(elt('span', 'arrow', '↳'));
          var link = elt('button', 'link-btn', (otherNode ? otherNode.title : other.export.objectName) + ' · ' + pinName);
          link.type = 'button';
          link.addEventListener('click', function () {
            if (!otherNode) return;
            if (isMobile()) closeDrawers();
            state.view.select(otherNode);
            state.view.focusNode(otherNode, true);
          });
          row.appendChild(link);
          p.appendChild(row);
        });
      });
      host.appendChild(p);
    }

    var props = node.props && node.props.props;
    if (props && props.length) {
      var pr = elt('div', 'insp-group');
      pr.appendChild(elt('h4', null, 'Properties'));
      pr.appendChild(propTree(props));
      host.appendChild(pr);
    }
  }

  function pinRow(pin) {
    var row = elt('div', 'pin-row');
    var sw = elt('span', 'swatch' + ((pin.category || '').toLowerCase() === 'exec' ? ' exec' : ''));
    sw.style.background = UA.pinColor(pin);
    row.appendChild(sw);
    row.appendChild(elt('span', 'arrow', pin.direction === 1 ? '→' : (pin.direction === 0 ? '←' : '·')));
    var shown = UA.cleanName(pin.name) || '(unnamed)';
    row.appendChild(elt('span', 'pname', shown));
    if (pin.name && pin.name !== shown) row.title = pin.name;
    row.appendChild(elt('span', 'ptype', UA.pinTypeLabel(pin) + (pin.defaultValue ? ' = ' + pin.defaultValue : '')));
    return row;
  }

  function findNodeByExport(idx) {
    if (!state.graph) return null;
    for (var i = 0; i < state.graph.nodes.length; i++) {
      if (state.graph.nodes[i].index === idx) return state.graph.nodes[i];
    }
    return null;
  }

  function showVariable(v) {
    var host = inspectorRoot();
    var head = elt('div', 'insp-head');
    var kind = elt('span', 'kind', 'variable');
    kind.style.background = UA.pinColor({ category: v.category, subCategoryObject: v.typeObject, subCategory: v.subCategory });
    head.appendChild(kind);
    head.appendChild(elt('h3', null, v.name));
    head.appendChild(elt('div', 'cls', v.typeObject || v.subCategory || v.category || '—'));
    host.appendChild(head);

    var g = elt('div', 'insp-group');
    g.appendChild(elt('h4', null, 'Variable'));
    kv(g, 'Type', v.category || '—');
    if (v.subCategory) kv(g, 'Subtype', v.subCategory);
    if (v.typeObject) kv(g, 'Object', v.typeObject);
    if (v.container) kv(g, 'Container', ['single', 'array', 'set', 'map'][v.container] || String(v.container));
    if (v.group) kv(g, 'Category', v.group);
    if (v.defaultValue) kv(g, 'Default', v.defaultValue);
    host.appendChild(g);

    if (v.struct && v.struct.props) {
      var pr = elt('div', 'insp-group');
      pr.appendChild(elt('h4', null, 'Description'));
      pr.appendChild(propTree(v.struct.props));
      host.appendChild(pr);
    }
  }

  function showExport(idx) {
    var obj = state.model.objects[idx];
    if (!obj) return;
    var node = findNodeByExport(idx);
    if (node) { state.view.select(node); state.view.focusNode(node, true); return; }
    var graph = state.model.graphByExport[idx];
    if (graph) { openGraph(graph); return; }

    var host = inspectorRoot();
    var head = elt('div', 'insp-head');
    var kind = elt('span', 'kind', 'object');
    kind.style.background = '#3d4450';
    head.appendChild(kind);
    head.appendChild(elt('h3', null, obj.export.objectName));
    head.appendChild(elt('div', 'cls', obj.export.className || ''));
    host.appendChild(head);

    var g = elt('div', 'insp-group');
    g.appendChild(elt('h4', null, 'Object'));
    kv(g, 'Export', '#' + idx);
    if (obj.export.outerName) kv(g, 'Outer', obj.export.outerName);
    kv(g, 'Size', bytes(obj.export.serialSize || 0));
    kv(g, 'Offset', String(obj.export.serialOffset));
    host.appendChild(g);

    if (obj.props.props.length) {
      var pr = elt('div', 'insp-group');
      pr.appendChild(elt('h4', null, 'Properties'));
      pr.appendChild(propTree(obj.props.props));
      host.appendChild(pr);
    }
  }

  /* Recursive property tree with lazily expanded children. */
  function propTree(props) {
    var wrap = elt('div', 'tree');
    props.forEach(function (p) { wrap.appendChild(propRow(p.name, p.value, p.type, p.error)); });
    return wrap;
  }

  function childrenOf(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.k === 'struct' && value.props && value.props.length) {
      return value.props.map(function (p) { return { key: p.name, value: p.value, type: p.type, error: p.error }; });
    }
    if ((value.k === 'array' || value.k === 'set') && value.items && value.items.length) {
      return value.items.map(function (v, i) { return { key: '[' + i + ']', value: v, type: value.inner }; });
    }
    if (value.k === 'map' && value.items && value.items.length) {
      return value.items.map(function (kv2, i) {
        return { key: UA.valueToText(kv2.key), value: kv2.value, type: value.valueType };
      });
    }
    return null;
  }

  function valueClass(v) {
    if (typeof v === 'number' || typeof v === 'bigint') return 'num';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'string') return 'str';
    if (v && v.k === 'obj') return 'obj';
    if (v && (v.k === 'name' || v.k === 'text' || v.k === 'soft')) return 'str';
    return '';
  }

  function propRow(key, value, type, error) {
    var node = elt('div', 'tree-node');
    var row = elt('div', 'tree-row');
    var kids = childrenOf(value);
    var tw = elt('span', 'tw', kids ? '▶' : '');
    row.appendChild(tw);
    var shownKey = UA.cleanName(key);
    row.appendChild(elt('span', 'tk', shownKey));
    if (key && key !== shownKey) row.title = key;
    var v = elt('span', 'tv ' + valueClass(value), error ? '⚠ ' + error : UA.valueToText(value));
    row.appendChild(v);
    if (type && !kids) row.appendChild(elt('span', 'tt', String(type).replace(/Property$/, '')));
    node.appendChild(row);

    if (kids) {
      row.classList.add('expandable');
      var box = elt('div', 'tree-children');
      box.hidden = true;
      var built = false;
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        box.hidden = !box.hidden;
        tw.textContent = box.hidden ? '▶' : '▼';
        if (!built) {
          built = true;
          kids.slice(0, 400).forEach(function (c) { box.appendChild(propRow(c.key, c.value, c.type, c.error)); });
          if (kids.length > 400) box.appendChild(elt('div', 'tree-row', '… ' + (kids.length - 400) + ' more'));
        }
      });
      node.appendChild(box);
    }
    return node;
  }

  /* ------------------------------------------------------------- search */

  var lastTerm = null;

  /* Search spans every graph in the asset, not just the visible one. */
  function applySearch() {
    if (!state.view || !state.model) return;
    var input = $('search');
    if (!input) return;
    var term = input.value.trim().toLowerCase();
    state.view.setSearch(term);
    if (term !== lastTerm) { state.matchIndex = 0; lastTerm = term; }
    if (!term) {
      state.matches = [];
      if ($('searchCount')) $('searchCount').textContent = '';
      return;
    }
    var hits = [];
    state.model.graphs.forEach(function (g) {
      g.nodes.forEach(function (n) {
        if ((n.title || '').toLowerCase().indexOf(term) >= 0 ||
            (n.className || '').toLowerCase().indexOf(term) >= 0 ||
            (n.comment || '').toLowerCase().indexOf(term) >= 0) {
          hits.push({ graph: g, node: n });
        }
      });
    });
    state.matches = hits;
    if ($('searchCount')) $('searchCount').textContent = String(hits.length);
  }

  function gotoMatch() {
    if (!state.matches.length) return;
    var i = state.matchIndex % state.matches.length;
    var hit = state.matches[i];
    state.matchIndex = i + 1;
    if (hit.graph !== state.graph) openGraph(hit.graph);
    state.view.select(hit.node);
    state.view.focusNode(hit.node, true);
    if ($('searchCount')) $('searchCount').textContent = (i + 1) + '/' + state.matches.length;
  }

  /* ------------------------------------------------------------- status */

  function updateStatus() {
    var m = state.model;
    if (!m) return;
    var s = m.stats;
    var left = $('statusLeft');
    left.innerHTML = '';
    [['Graphs', s.graphs], ['Nodes', s.nodes], ['Pins', s.pins], ['Wires', s.links]].forEach(function (p) {
      var n = elt('span');
      n.appendChild(elt('b', null, p[0] + ' '));
      n.appendChild(document.createTextNode(String(p[1])));
      left.appendChild(n);
    });
    var right = $('statusRight');
    right.innerHTML = '';
    [['Names', s.names], ['Imports', s.imports], ['Exports', s.exports]].forEach(function (p) {
      var n = elt('span');
      n.appendChild(elt('b', null, p[0] + ' '));
      n.appendChild(document.createTextNode(String(p[1])));
      right.appendChild(n);
    });
    var fmt = elt('span');
    fmt.appendChild(elt('b', null, 'Tags '));
    fmt.appendChild(document.createTextNode(m.pkg.propertyFormat));
    right.appendChild(fmt);
  }

  function showError(title, detail) {
    var host = $('stageError');
    host.hidden = false;
    host.innerHTML = '';
    var box = elt('div', 'box');
    box.appendChild(elt('h2', null, title));
    box.appendChild(elt('p', null,
      'The viewer reads Unreal package files directly. If this is a cooked or encrypted ' +
      'package, or an unsupported engine build, parsing can fail before any graph is found.'));
    box.appendChild(elt('pre', null, detail));
    host.appendChild(box);
  }
  function hideError() { $('stageError').hidden = true; }

  /* --------------------------------------------------------------- boot */

  /* Read-only session: any URL that preloads assets (?src=…) — or an explicit
     ?lock=1 — strips every way of bringing new files in, so a deep link can only
     ever show the assets it shipped with. ?lock=0 opts back out. */
  var LOCKED = (function () {
    var p = new URLSearchParams(location.search);
    if (p.get('lock') === '0') return false;
    return p.get('lock') === '1' || p.getAll('src').length > 0;
  })();

  function applyLock() {
    if (!LOCKED) return;
    document.body.classList.add('is-locked');
    ['openLabel', 'fileInput'].forEach(function (id) {
      var el = $(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    var add = document.querySelector('.browser-add');
    if (add && add.parentNode) add.parentNode.removeChild(add);
    var dz = $('dropzone');
    if (dz) {
      dz.querySelectorAll('label, .hint').forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      var inner = dz.querySelector('.dropzone-inner');
      if (inner) inner.innerHTML = '';
    }
  }

  function init() {
    var fileInput = $('fileInput');
    if (fileInput) fileInput.addEventListener('change', function (e) {
      handleFiles(e.target.files);
      e.target.value = '';       /* so re-picking the same file still fires */
    });

    var dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        e.preventDefault();
        if (!LOCKED) dz.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        e.preventDefault();
        if (ev === 'dragleave' && e.relatedTarget) return;
        dz.classList.remove('is-over');
      });
    });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      if (LOCKED) return;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    $('navToggle').addEventListener('click', function () {
      setDrawer('nav', !$('sidebar').classList.contains('is-open'));
    });
    $('inspToggle').addEventListener('click', function () {
      setDrawer('insp', !$('inspector').classList.contains('is-open'));
    });
    $('scrim').addEventListener('click', closeDrawers);
    if (mobileMQ.addEventListener) mobileMQ.addEventListener('change', applyLayout);
    else if (mobileMQ.addListener) mobileMQ.addListener(applyLayout);
    window.addEventListener('orientationchange', function () { setTimeout(applyLayout, 120); });
    applyLayout();

    $('zoomIn').addEventListener('click', function () { state.view && state.view.zoomBy(1.25); });
    $('zoomOut').addEventListener('click', function () { state.view && state.view.zoomBy(0.8); });
    $('zoomFit').addEventListener('click', function () { state.view && state.view.fit(); });

    var search = $('search');
    if (search) {
      search.addEventListener('input', applySearch);
      search.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        gotoMatch();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'f' && state.view) { state.view.fit(); }
      if (e.key === '/' && search) { e.preventDefault(); search.focus(); }
      if (e.key === 'Escape') {
        if (drawerOpen()) { closeDrawers(); return; }
        if (state.view) { if (search) search.value = ''; applySearch(); state.view.select(null); }
      }
    });
  }

  /* Preset assets via URL: ?src=assets/A.uasset,assets/B.uasset (repeatable).
     Lets another page deep-link straight into a graph with files already open. */
  function preloadFromUrl() {
    var params = new URLSearchParams(location.search);
    var srcs = [];
    params.getAll('src').forEach(function (v) {
      v.split(',').forEach(function (p) { p = p.trim(); if (p) srcs.push(p); });
    });
    if (!srcs.length) return;

    var dz = $('dropzone');
    if (dz) {
      var h = dz.querySelector('h1');
      if (h) h.textContent = 'Loading ' + srcs.length + (srcs.length === 1 ? ' asset…' : ' assets…');
    }

    var first = null;
    var chain = Promise.resolve();
    srcs.forEach(function (url) {
      chain = chain.then(function () {
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error(res.status + ' ' + res.statusText + ' — ' + url);
          return res.arrayBuffer();
        }).then(function (buf) {
          var name = decodeURIComponent(url.split('/').pop().split('?')[0]);
          var entry = addAsset(name, buf, null, buf.byteLength);
          if (!first) {
            first = entry;
            /* Render immediately — waiting for the whole batch leaves the user
               staring at an empty outline for as long as the slowest asset. */
            selectAsset(first.id);
            document.documentElement.classList.remove('locked-boot');
          }
        });
      });
    });
    chain.then(function () {
      var g = params.get('graph');
      if (g && state.model) {
        var hit = (state.model.graphs || []).filter(function (gr) {
          return gr.name && gr.name.toLowerCase() === g.toLowerCase();
        })[0];
        if (hit) openGraph(hit);
      }
    }).catch(function (err) {
      showError('Could not load the preset asset', (err && err.message) || String(err));
    });
  }

  function boot() { applyLock(); init(); preloadFromUrl(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Programmatic entry point (also used by the test harness). */
  UA.loadBuffer = function (name, buffer, uexpBuffer) {
    var entry = addAsset(name, buffer, uexpBuffer || null, buffer.byteLength);
    selectAsset(entry.id);
    return entry;
  };
  UA.app = state;
})(typeof window !== 'undefined' ? window : globalThis);
