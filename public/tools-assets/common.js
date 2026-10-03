/* ============================================================
   RedactLocal — shared helpers for the Phase 1 file tools.
   Classic script (CSP: script-src 'self'); exposes window.RL.
   Everything runs locally; nothing here makes a network call
   except loading our own same-origin libraries on demand.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- formatting ---------- */
  function fmtBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    var u = ['KB', 'MB', 'GB'], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return (n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
  }

  // Strip directory parts and characters that are unsafe in a download name.
  function sanitizeName(name) {
    var base = String(name || 'file').replace(/[\\/]/g, '_').replace(/[\x00-\x1f<>:"|?*]/g, '').trim();
    return base || 'file';
  }
  function baseName(name) {
    return sanitizeName(name).replace(/\.[^.\/\\]+$/, '') || 'file';
  }

  /* ---------- safe DOM building ---------- */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else if (k === 'html') n.innerHTML = props[k]; // only ever used with our own literals
      else if (k.slice(0, 2) === 'on' && typeof props[k] === 'function') n.addEventListener(k.slice(2), props[k]);
      else if (props[k] != null) n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  /* ---------- blob-url registry (revoke on reset / unload) ---------- */
  var urls = [];
  function objUrl(blob) { var u = URL.createObjectURL(blob); urls.push(u); return u; }
  function revokeAll() { urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} }); urls = []; }
  window.addEventListener('pagehide', revokeAll);

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: sanitizeName(name) });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  }

  /* ---------- lazy library loaders (same-origin, loaded on demand) ---------- */
  var scriptCache = {};
  function loadScript(src) {
    if (scriptCache[src]) return scriptCache[src];
    scriptCache[src] = new Promise(function (res, rej) {
      var s = el('script', { src: src });
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('Could not load a required component.')); };
      document.head.appendChild(s);
    });
    return scriptCache[src];
  }
  function ensurePdfLib() { return window.PDFLib ? Promise.resolve(window.PDFLib) : loadScript('/vendor/pdf-lib.min.js').then(function () { return window.PDFLib; }); }
  function ensureJSZip() { return window.JSZip ? Promise.resolve(window.JSZip) : loadScript('/vendor/jszip.min.js').then(function () { return window.JSZip; }); }

  var pdfjsPromise = null;
  function loadPdfjs() {
    if (pdfjsPromise) return pdfjsPromise;
    if (typeof Promise.withResolvers !== 'function') {
      Promise.withResolvers = function () { var a, b; var p = new Promise(function (res, rej) { a = res; b = rej; }); return { promise: p, resolve: a, reject: b }; };
    }
    pdfjsPromise = import('/pdfjs/pdf.min.mjs').then(function (lib) {
      lib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return lib;
    });
    return pdfjsPromise;
  }
  // Open a PDF with asset paths resolved to our self-hosted copies.
  function openPdf(data) {
    return loadPdfjs().then(function (pdfjs) {
      return pdfjs.getDocument({
        data: data,
        cMapUrl: '/pdfjs/cmaps/', cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
        wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/',
        isEvalSupported: false, disableAutoFetch: true, disableStream: true
      }).promise;
    });
  }

  /* ---------- page-range parsing ("1,3,5-8") ---------- */
  function parseRanges(str, max) {
    var out = [], seen = {};
    var parts = String(str || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return { error: 'Enter at least one page or range, e.g. 1,3,5-8.' };
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) return { error: '"' + parts[i] + '" is not a valid page or range.' };
      var a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
      if (a < 1 || b < 1) return { error: 'Page numbers start at 1.' };
      if (a > max || b > max) return { error: 'This PDF has ' + max + ' page' + (max === 1 ? '' : 's') + '; "' + parts[i] + '" is out of range.' };
      var step = a <= b ? 1 : -1;
      for (var p = a; step > 0 ? p <= b : p >= b; p += step) { if (!seen[p]) { seen[p] = 1; out.push(p); } }
    }
    return { pages: out };
  }

  /* ---------- dropzone wiring (click, keyboard, drag/drop) ---------- */
  function setupDropzone(zone, input, onFiles, opts) {
    opts = opts || {};
    function pick(list) {
      var files = Array.prototype.slice.call(list || []);
      if (opts.accept) files = files.filter(opts.accept);
      if (files.length) onFiles(files);
    }
    zone.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button,a')) return; input.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { pick(input.files); input.value = ''; });
    var depth = 0;
    zone.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; zone.classList.add('drag'); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', function (e) { e.preventDefault(); if (--depth <= 0) { depth = 0; zone.classList.remove('drag'); } });
    zone.addEventListener('drop', function (e) { e.preventDefault(); depth = 0; zone.classList.remove('drag'); pick(e.dataTransfer && e.dataTransfer.files); });
  }

  /* ---------- messages ---------- */
  var icons = {
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };
  function message(box, kind, text) {
    if (!box) return;
    box.className = 'msg msg-' + kind;
    box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    box.innerHTML = icons[kind] || '';
    box.appendChild(el('span', { text: text }));
    box.hidden = false;
  }
  function clearMsg(box) { if (box) { box.hidden = true; box.innerHTML = ''; } }

  window.RL = {
    $: $, $$: $$, el: el, fmtBytes: fmtBytes, sanitizeName: sanitizeName, baseName: baseName,
    objUrl: objUrl, revokeAll: revokeAll, download: download,
    ensurePdfLib: ensurePdfLib, ensureJSZip: ensureJSZip, loadPdfjs: loadPdfjs, openPdf: openPdf,
    parseRanges: parseRanges, setupDropzone: setupDropzone,
    error: function (b, t) { message(b, 'error', t); }, warn: function (b, t) { message(b, 'warn', t); }, clearMsg: clearMsg
  };
})();
