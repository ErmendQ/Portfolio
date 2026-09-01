/* SVG blueprint canvas: pan, zoom, node rendering and wire routing. */
(function (global) {
  'use strict';
  var UA = global.UA;
  var NS = 'http://www.w3.org/2000/svg';

  var ROW_H = 18, PIN_INSET = 8, LABEL_INSET = 17, PAD_V = 8;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, str, attrs) {
    var t = el('text', attrs, parent);
    t.textContent = str;
    return t;
  }
  function truncate(s, maxPx, charPx) {
    if (!s) return '';
    var max = Math.floor(maxPx / charPx);
    if (s.length <= max) return s;
    return max > 1 ? s.slice(0, max - 1) + '…' : '';
  }

  function GraphView(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.graph = null;
    this.selected = null;
    this.nodeEls = {};
    this.suppressTapUntil = 0;
    this.build();
  }

  GraphView.prototype.build = function () {
    var self = this;
    this.container.innerHTML = '';
    var svg = el('svg', { class: 'gv-svg' }, this.container);
    this.svg = svg;

    var defs = el('defs', null, svg);
    var pat = el('pattern', { id: 'gv-dots', width: 32, height: 32, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 1, cy: 1, r: 1, fill: 'var(--grid-dot)' }, pat);
    var pat2 = el('pattern', { id: 'gv-grid', width: 128, height: 128, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 128, height: 128, fill: 'url(#gv-dots)' }, pat2);
    el('path', { d: 'M128 0 L0 0 0 128', fill: 'none', stroke: 'var(--grid-line)', 'stroke-width': 1 }, pat2);

    this.bg = el('rect', { class: 'gv-bg', x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#gv-grid)' }, svg);

    this.viewport = el('g', { class: 'gv-viewport' }, svg);
    this.layerComments = el('g', { class: 'gv-comments' }, this.viewport);
    this.layerEdges = el('g', { class: 'gv-edges' }, this.viewport);
    this.layerNodes = el('g', { class: 'gv-nodes' }, this.viewport);

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = svg.getBoundingClientRect();
      var f = Math.exp(-e.deltaY * 0.0015);
      self.zoomAt(e.clientX - rect.left, e.clientY - rect.top, f);
    }, { passive: false });

    /* Mouse: panning is a right-button (or middle-button) drag, as in the
       Blueprint editor, which leaves the left button free to select nodes.
       Touch has no second button, so one finger pans and two pinch to zoom. */
    var PAN_BUTTONS = { 1: true, 2: true };
    var dragging = false, lastX = 0, lastY = 0;
    var touches = new Map();              /* pointerId -> {x, y} */
    var panId = null, pinch = null, moved = 0;

    function isTouch(e) { return e.pointerType === 'touch' || e.pointerType === 'pen'; }

    function pinchOf(points) {
      var a = points[0], b = points[1];
      return {
        dist: Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2
      };
    }

    svg.addEventListener('pointerdown', function (e) {
      if (isTouch(e)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 1) {
          moved = 0;
          panId = e.pointerId;
          lastX = e.clientX; lastY = e.clientY;
        } else if (touches.size === 2) {
          panId = null;
          pinch = pinchOf(Array.from(touches.values()));
        }
        svg.classList.add('is-panning');
        return;
      }
      if (!PAN_BUTTONS[e.button]) return;
      e.preventDefault();
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* uncapturable pointer */ }
      svg.classList.add('is-panning');
    });

    svg.addEventListener('pointermove', function (e) {
      if (isTouch(e)) {
        if (!touches.has(e.pointerId)) return;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size >= 2) {
          var now = pinchOf(Array.from(touches.values()));
          if (pinch && pinch.dist > 0) {
            var rect = svg.getBoundingClientRect();
            self.zoomAt(now.cx - rect.left, now.cy - rect.top, now.dist / pinch.dist);
            self.tx += now.cx - pinch.cx;
            self.ty += now.cy - pinch.cy;
            self.applyTransform();
          }
          pinch = now;
          moved += 12;
        } else if (panId === e.pointerId) {
          var tdx = e.clientX - lastX, tdy = e.clientY - lastY;
          moved += Math.abs(tdx) + Math.abs(tdy);
          lastX = e.clientX; lastY = e.clientY;
          self.tx += tdx; self.ty += tdy;
          self.applyTransform();
        }
        return;
      }
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      self.tx += dx; self.ty += dy;
      self.applyTransform();
    });

    function endPointer(e) {
      if (isTouch(e)) {
        touches.delete(e.pointerId);
        if (touches.size < 2) pinch = null;
        if (touches.size === 1) {
          var only = Array.from(touches.entries())[0];
          panId = only[0];
          lastX = only[1].x; lastY = only[1].y;
        } else if (touches.size === 0) {
          panId = null;
          svg.classList.remove('is-panning');
          /* A drag must not also count as a tap on whatever was underneath. */
          if (moved > 8) self.suppressTapUntil = Date.now() + 350;
        }
        return;
      }
      if (!dragging) return;
      dragging = false;
      svg.classList.remove('is-panning');
      try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);

    /* Without this the browser menu opens when a right-drag is released. */
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* Clicking or tapping empty canvas clears the selection. */
    svg.addEventListener('click', function (e) {
      if (self.suppressTapUntil > Date.now()) return;
      if (e.button === 0 && (e.target === self.bg || e.target === svg)) self.select(null);
    });

    this.resizeObserver = new ResizeObserver(function () {
      self.updateBg();
      /* The canvas can start at zero height inside a still-settling layout;
         fit as soon as it actually has room. */
      if (self.graph && !self.fitted) self.fit();
    });
    this.resizeObserver.observe(this.container);
  };

  GraphView.prototype.updateBg = function () {
    /* Keep the grid anchored to graph space while panning. */
    this.bg.setAttribute('x', 0);
    this.bg.setAttribute('y', 0);
    var s = this.scale;
    this.bg.setAttribute('transform', 'translate(' + (this.tx % (128 * s)) + ',' + (this.ty % (128 * s)) + ') scale(' + s + ')');
    var r = this.container.getBoundingClientRect();
    this.bg.setAttribute('width', (r.width / s) + 256);
    this.bg.setAttribute('height', (r.height / s) + 256);
    this.bg.setAttribute('x', -128);
    this.bg.setAttribute('y', -128);
  };

  GraphView.prototype.applyTransform = function () {
    this.viewport.setAttribute('transform', 'translate(' + this.tx + ',' + this.ty + ') scale(' + this.scale + ')');
    this.updateBg();
    if (this.opts.onViewChange) this.opts.onViewChange(this.scale);
  };

  GraphView.prototype.zoomAt = function (px, py, factor) {
    var s = Math.min(3, Math.max(0.05, this.scale * factor));
    var k = s / this.scale;
    this.tx = px - (px - this.tx) * k;
    this.ty = py - (py - this.ty) * k;
    this.scale = s;
    this.applyTransform();
  };

  GraphView.prototype.zoomBy = function (factor) {
    var r = this.container.getBoundingClientRect();
    this.zoomAt(r.width / 2, r.height / 2, factor);
  };

  GraphView.prototype.fit = function (padding) {
    if (!this.graph) return;
    var b = this.graph.bounds;
    var r = this.container.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { this.fitted = false; return; }
    this.fitted = true;
    var pad = padding == null ? 60 : padding;
    var w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0);
    var s = Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / h);
    /* On a phone, fitting a whole graph to the screen shrinks nodes to a few
       pixels — legible neither to read nor to tap. Keep a floor and let the
       reader pan instead of showing an unusable overview. */
    var floor = this.opts.minFitScale ? this.opts.minFitScale() : 0.05;
    this.scale = Math.min(1.4, Math.max(floor, s));
    this.tx = r.width / 2 - (b.x0 + w / 2) * this.scale;
    this.ty = r.height / 2 - (b.y0 + h / 2) * this.scale;
    this.applyTransform();
  };

  GraphView.prototype.focusNode = function (node, zoom) {
    if (!node) return;
    var r = this.container.getBoundingClientRect();
    if (zoom) this.scale = Math.max(this.scale, 0.75);
    this.tx = r.width / 2 - (node.x + node.w / 2) * this.scale;
    this.ty = r.height / 2 - (node.y + node.h / 2) * this.scale;
    this.applyTransform();
  };

  /* ------------------------------------------------------------- rendering */

  GraphView.prototype.setGraph = function (graph) {
    this.graph = graph;
    this.fitted = false;
    this.selected = null;
    this.nodeEls = {};
    this.layerComments.innerHTML = '';
    this.layerEdges.innerHTML = '';
    this.layerNodes.innerHTML = '';
    if (!graph) return;

    var self = this;
    var detail = graph.nodes.length <= 900;

    graph.nodes.forEach(function (n) {
      if (n.kind === 'comment') self.renderComment(n);
    });
    graph.edges.forEach(function (e) { self.renderEdge(e); });
    graph.nodes.forEach(function (n) {
      if (n.kind !== 'comment') self.renderNode(n, detail);
    });
    this.fit();
  };

  GraphView.prototype.renderComment = function (n) {
    var g = el('g', { class: 'gv-comment', 'data-node': n.id }, this.layerComments);
    var c = n.commentColor || [110, 120, 135, 160];
    var fill = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.13)';
    var stroke = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.55)';
    el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 3, fill: fill, stroke: stroke, 'stroke-width': 1.5 }, g);
    el('rect', { x: n.x, y: n.y, width: n.w, height: 26, rx: 3, fill: stroke, opacity: 0.55 }, g);
    text(g, truncate(n.title, n.w - 16, 8.4), {
      x: n.x + 8, y: n.y + 18, class: 'gv-comment-label', 'font-size': 15
    });
    this.nodeEls[n.id] = g;
    this.bindNode(g, n);
  };

  GraphView.prototype.renderNode = function (n, detail) {
    var g = el('g', { class: 'gv-node gv-kind-' + n.kind, 'data-node': n.id }, this.layerNodes);

    if (n.kind === 'knot') {
      el('circle', { cx: n.x + 11, cy: n.y + 11, r: 7, class: 'gv-knot' }, g);
      this.nodeEls[n.id] = g;
      this.bindNode(g, n);
      return;
    }

    var body = el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 5, class: 'gv-node-body' }, g);
    if (n.compact) {
      body.setAttribute('fill', UA.kindColor(n.kind));
      body.setAttribute('fill-opacity', '0.5');
    } else {
      el('path', {
        d: roundedTop(n.x, n.y, n.w, n.headerH, 5),
        fill: UA.kindColor(n.kind), class: 'gv-node-header'
      }, g);
    }
    el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 5, class: 'gv-node-outline' }, g);

    if (detail) {
      if (!n.compact) {
        text(g, truncate(n.title, n.w - 16, 6.9), {
          x: n.x + 9, y: n.y + 18, class: 'gv-node-title'
        });
        if (n.subtitle) {
          text(g, truncate(n.subtitle, n.w - 18, 6.0), {
            x: n.x + 9, y: n.y + 29, class: 'gv-node-subtitle'
          });
        }
      }
      this.renderPins(g, n);
    }
    this.nodeEls[n.id] = g;
    this.bindNode(g, n);
  };

  GraphView.prototype.renderPins = function (g, n) {
    var self = this;
    var CW = 6.4;                                  /* must match the width measurement */
    var inner = n.w - LABEL_INSET - 10;
    var inBudget = Math.max(28, inner - (n.outLabelMax ? n.outLabelMax + 14 : 4));
    var outBudget = Math.max(28, inner - (n.inLabelMax ? n.inLabelMax + 14 : 4));

    (n.inputs || []).forEach(function (p, i) {
      var y = pinY(n, i);
      self.renderPin(g, n.x + PIN_INSET, y, p, false);
      var label = UA.pinLabel(p);
      var showDefault = p.defaultValue && !(p.links && p.links.length);
      if (label) {
        text(g, truncate(label, inBudget, CW), { x: n.x + LABEL_INSET, y: y + 4, class: 'gv-pin-label' });
        if (showDefault) {
          var used = Math.min(label.length * CW, inBudget);
          var room = inBudget - used - 10;
          if (room > 20) {
            text(g, truncate('= ' + p.defaultValue, room, 6.0), {
              x: n.x + LABEL_INSET + used + 8, y: y + 4, class: 'gv-pin-default'
            });
          }
        }
      } else if (showDefault) {
        text(g, truncate(p.defaultValue, inBudget, 6.0), {
          x: n.x + LABEL_INSET, y: y + 4, class: 'gv-pin-default'
        });
      }
    });

    (n.outputs || []).forEach(function (p, i) {
      var y = pinY(n, i);
      self.renderPin(g, n.x + n.w - PIN_INSET, y, p, true);
      var label = UA.pinLabel(p);
      if (label) {
        text(g, truncate(label, outBudget, CW), {
          x: n.x + n.w - LABEL_INSET, y: y + 4, class: 'gv-pin-label', 'text-anchor': 'end'
        });
      }
    });
  };

  GraphView.prototype.renderPin = function (g, x, y, pin, isOut) {
    var color = UA.pinColor(pin);
    var connected = pin.links && pin.links.length > 0;
    var cat = (pin.category || '').toLowerCase();
    if (cat === 'exec') {
      var d = 'M' + (x - 4.5) + ' ' + (y - 5.5) + ' L' + (x + 4.5) + ' ' + y + ' L' + (x - 4.5) + ' ' + (y + 5.5) + ' Z';
      el('path', { d: d, fill: connected ? color : 'none', stroke: color, 'stroke-width': 1.4, class: 'gv-pin' }, g);
    } else {
      el('circle', {
        cx: x, cy: y, r: 4.2, fill: connected ? color : 'none',
        stroke: color, 'stroke-width': 1.6, class: 'gv-pin'
      }, g);
    }
  };

  GraphView.prototype.renderEdge = function (e) {
    var fromIdx = (e.fromNode.outputs || []).indexOf(e.fromPin);
    var toIdx = (e.toNode.inputs || []).indexOf(e.toPin);
    var x1, y1, x2, y2;
    if (fromIdx >= 0) { x1 = e.fromNode.x + e.fromNode.w - PIN_INSET; y1 = pinY(e.fromNode, fromIdx); }
    else { x1 = e.fromNode.x + e.fromNode.w / 2; y1 = e.fromNode.y + e.fromNode.h / 2; }
    if (toIdx >= 0) { x2 = e.toNode.x + PIN_INSET; y2 = pinY(e.toNode, toIdx); }
    else { x2 = e.toNode.x + e.toNode.w / 2; y2 = e.toNode.y + e.toNode.h / 2; }
    if (e.fromNode.kind === 'knot') { x1 = e.fromNode.x + 11; y1 = e.fromNode.y + 11; }
    if (e.toNode.kind === 'knot') { x2 = e.toNode.x + 11; y2 = e.toNode.y + 11; }

    var dx = Math.max(40, Math.min(220, Math.abs(x2 - x1) * 0.6));
    var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2;
    var path = el('path', {
      d: d, fill: 'none', stroke: e.color, 'stroke-width': e.exec ? 2.6 : 1.9,
      class: 'gv-edge', 'stroke-linecap': 'round'
    }, this.layerEdges);
    path.__edge = e;
    e.el = path;
  };

  function pinY(n, i) {
    return n.y + n.headerH + (n.compact ? 4 : PAD_V / 2) + i * ROW_H + ROW_H / 2;
  }
  function roundedTop(x, y, w, h, r) {
    return 'M' + x + ' ' + (y + h) + ' L' + x + ' ' + (y + r) +
      ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
      ' L' + (x + w - r) + ' ' + y +
      ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) +
      ' L' + (x + w) + ' ' + (y + h) + ' Z';
  }

  /* ---------------------------------------------------------- interaction */

  GraphView.prototype.bindNode = function (g, n) {
    var self = this;
    /* Only swallow the mouse's left button: a right-drag (or any touch drag)
       that starts over a node must still reach the canvas and pan. */
    g.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button === 0) e.stopPropagation();
    });
    g.addEventListener('click', function (e) {
      e.stopPropagation();
      if (self.suppressTapUntil > Date.now()) return;
      self.select(n);
    });
    g.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      if (n.boundGraph && self.opts.onOpenGraph) self.opts.onOpenGraph(n.boundGraph);
    });
  };

  GraphView.prototype.select = function (node) {
    if (this.selected && this.nodeEls[this.selected.id]) {
      this.nodeEls[this.selected.id].classList.remove('is-selected');
    }
    this.selected = node;
    this.svg.classList.toggle('has-selection', !!node);
    if (node && this.nodeEls[node.id]) this.nodeEls[node.id].classList.add('is-selected');
    if (this.graph) {
      this.graph.edges.forEach(function (e) {
        if (!e.el) return;
        var on = node && (e.fromNode === node || e.toNode === node);
        e.el.classList.toggle('is-active', !!on);
      });
    }
    if (this.opts.onSelectNode) this.opts.onSelectNode(node);
  };

  GraphView.prototype.setSearch = function (term) {
    var t = (term || '').trim().toLowerCase();
    var matches = [];
    if (!this.graph) return matches;
    var self = this;
    this.graph.nodes.forEach(function (n) {
      var g = self.nodeEls[n.id];
      if (!g) return;
      var hit = t && ((n.title || '').toLowerCase().indexOf(t) >= 0 ||
        (n.className || '').toLowerCase().indexOf(t) >= 0 ||
        (n.comment || '').toLowerCase().indexOf(t) >= 0);
      g.classList.toggle('is-match', !!hit);
      if (hit) matches.push(n);
    });
    this.svg.classList.toggle('has-search', !!t);
    return matches;
  };

  GraphView.prototype.destroy = function () {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.container.innerHTML = '';
  };

  UA.GraphView = GraphView;
})(typeof window !== 'undefined' ? window : globalThis);
