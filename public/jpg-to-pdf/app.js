/* JPG/PNG/WebP to PDF — build one PDF locally with pdf-lib. */
(function () {
  'use strict';
  var RL = window.RL, el = RL.el;
  var drop = RL.$('#drop'), input = RL.$('#file'), err = RL.$('#err'), work = RL.$('#work');
  var MAX_DIM = 2600; // downscale images whose long side exceeds this
  var OK = /^image\/(jpeg|png|webp)$/;
  var items = []; // {id, file, url, w, h, name}
  var opts = { size: 'auto', orient: 'auto', margin: 'none' };
  var seq = 0, building = false;

  RL.setupDropzone(drop, input, addFiles, { accept: function (f) { return OK.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name); } });

  function addFiles(files) {
    RL.clearMsg(err);
    var imgs = files.filter(function (f) { return OK.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name); });
    var rejected = files.length - imgs.length;
    var pending = imgs.length;
    if (!pending) { if (rejected) RL.error(err, 'Those files aren’t supported images. Use JPG, PNG, or WebP.'); return; }
    imgs.forEach(function (f) {
      var url = RL.objUrl(f);
      var img = new Image();
      img.onload = function () { items.push({ id: ++seq, file: f, url: url, w: img.naturalWidth, h: img.naturalHeight, name: f.name }); if (--pending === 0) done(); };
      img.onerror = function () { if (--pending === 0) done(); };
      img.src = url;
    });
    function done() { if (rejected) RL.warn(err, rejected + ' file' + (rejected === 1 ? ' was' : 's were') + ' skipped — only JPG, PNG, and WebP are supported.'); render(); }
  }

  function removeItem(id) { items = items.filter(function (it) { return it.id !== id; }); if (!items.length) reset(); else render(); }
  function move(id, dir) {
    var i = items.findIndex(function (it) { return it.id === id; });
    var j = i + dir; if (j < 0 || j >= items.length) return;
    var t = items[i]; items[i] = items[j]; items[j] = t; render();
  }
  function reset() { RL.revokeAll(); items = []; work.hidden = true; work.innerHTML = ''; drop.hidden = false; RL.clearMsg(err); }

  function render() {
    if (!items.length) { reset(); return; }
    drop.hidden = true; work.hidden = false; work.innerHTML = '';

    var list = el('ul', { class: 'filelist' });
    items.forEach(function (it, idx) {
      var li = el('li', { class: 'fileitem', draggable: 'true', 'data-id': it.id });
      li.appendChild(el('span', { class: 'fi-handle', title: 'Drag to reorder', 'aria-hidden': 'true', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>' }));
      li.appendChild(el('img', { class: 'fi-thumb', src: it.url, alt: 'Preview of ' + it.name }));
      li.appendChild(el('div', { class: 'fi-main' }, [
        el('div', { class: 'fi-name', text: it.name, title: it.name }),
        el('div', { class: 'fi-meta', text: it.w + '×' + it.h + ' · ' + RL.fmtBytes(it.file.size) })
      ]));
      var up = el('button', { class: 'fi-remove', type: 'button', 'aria-label': 'Move up', title: 'Move up', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>', onclick: function () { move(it.id, -1); } });
      var dn = el('button', { class: 'fi-remove', type: 'button', 'aria-label': 'Move down', title: 'Move down', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>', onclick: function () { move(it.id, 1); } });
      if (idx === 0) up.disabled = true; if (idx === items.length - 1) dn.disabled = true;
      li.appendChild(up); li.appendChild(dn);
      li.appendChild(el('button', { class: 'fi-remove', type: 'button', 'aria-label': 'Remove ' + it.name, title: 'Remove', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', onclick: function () { removeItem(it.id); } }));
      wireDrag(li, list);
      list.appendChild(li);
    });
    work.appendChild(list);

    // controls
    var controls = el('div', { class: 'controls' });
    controls.appendChild(seg('Page size', [['auto', 'Auto'], ['a4', 'A4'], ['letter', 'Letter']], 'size'));
    controls.appendChild(seg('Orientation', [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], 'orient'));
    controls.appendChild(seg('Margin', [['none', 'None'], ['small', 'Small'], ['normal', 'Normal']], 'margin'));
    work.appendChild(controls);

    var actions = el('div', { class: 'actions' });
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Create PDF', onclick: build }));
    actions.appendChild(el('label', { class: 'btn btn-secondary', text: 'Add more images' }, [mkAddInput()]));
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    work.appendChild(actions);

    work.appendChild(el('div', { id: 'status' }));
  }

  function mkAddInput() {
    var inp = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', multiple: 'true', class: 'sr-only' });
    inp.addEventListener('change', function () { addFiles(Array.prototype.slice.call(inp.files)); inp.value = ''; });
    return inp;
  }

  function seg(label, options, key) {
    var group = el('div', { class: 'segmented', role: 'group', 'aria-label': label });
    options.forEach(function (o) {
      group.appendChild(el('button', { type: 'button', text: o[1], 'aria-pressed': opts[key] === o[0] ? 'true' : 'false',
        onclick: function () { opts[key] = o[0]; RL.$$('button', group).forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === o[1] ? 'true' : 'false'); }); } }));
    });
    return el('div', { class: 'control' }, [el('label', { text: label }), group]);
  }

  var dragId = null;
  function wireDrag(li, list) {
    li.addEventListener('dragstart', function (e) { dragId = +li.getAttribute('data-id'); li.classList.add('dragging'); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (x) {} } });
    li.addEventListener('dragend', function () { li.classList.remove('dragging'); RL.$$('.fileitem', list).forEach(function (n) { n.classList.remove('dragover'); }); });
    li.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; li.classList.add('dragover'); });
    li.addEventListener('dragleave', function () { li.classList.remove('dragover'); });
    li.addEventListener('drop', function (e) {
      e.preventDefault(); li.classList.remove('dragover');
      var from = items.findIndex(function (it) { return it.id === dragId; });
      var to = items.findIndex(function (it) { return it.id === +li.getAttribute('data-id'); });
      if (from < 0 || to < 0 || from === to) return;
      var moved = items.splice(from, 1)[0]; items.splice(to, 0, moved); render();
    });
  }

  function build() {
    if (building || !items.length) return;
    building = true; RL.clearMsg(err);
    var status = RL.$('#status'); status.innerHTML = '';
    var label = el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Preparing images…' })]);
    var bar = el('div', { class: 'progress-bar' });
    status.appendChild(el('div', { class: 'progress' }, [label, el('div', { class: 'progress-track' }, [bar])]));

    RL.ensurePdfLib().then(function (PDFLib) {
      var pdf;
      return PDFLib.PDFDocument.create().then(function (doc) {
        pdf = doc;
        var i = 0;
        function next() {
          if (i >= items.length) return pdf;
          label.lastChild.textContent = 'Adding image ' + (i + 1) + ' of ' + items.length + '…';
          return prepare(items[i]).then(function (prep) {
            return embed(PDFLib, pdf, prep);
          }).then(function () {
            bar.style.width = Math.round((i + 1) / items.length * 100) + '%';
            i++;
            return new Promise(function (r) { setTimeout(function () { r(next()); }, 0); });
          });
        }
        return next();
      }).then(function () {
        return pdf.save({ useObjectStreams: true });
      });
    }).then(function (bytes) {
      building = false; status.innerHTML = '';
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var name = items.length === 1 ? RL.baseName(items[0].name) + '.pdf' : 'images-to-pdf.pdf';
      var box = el('div', { class: 'result' });
      box.appendChild(el('h3', { text: 'Your PDF is ready' }));
      box.appendChild(el('p', { text: items.length + ' image' + (items.length === 1 ? '' : 's') + ' on ' + items.length + ' page' + (items.length === 1 ? '' : 's') + '.' }));
      box.appendChild(el('div', { class: 'stats' }, [el('span', { class: 'stat', html: '<b>' + RL.fmtBytes(blob.size) + '</b> PDF' })]));
      var actions = el('div', { class: 'actions', style: 'justify-content:center' });
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Download PDF', onclick: function () { RL.download(blob, name); } }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
      box.appendChild(actions);
      status.appendChild(box); box.scrollIntoView({ block: 'nearest' });
    }).catch(function (e) {
      building = false; RL.$('#status').innerHTML = '';
      RL.error(err, 'We couldn’t create the PDF. One of the images may be damaged — try removing it and building again.');
    });
  }

  // Decode, optionally downscale/convert; return {bytes, fmt, w, h}
  function prepare(it) {
    var needScale = Math.max(it.w, it.h) > MAX_DIM;
    var isJpeg = it.file.type === 'image/jpeg' || /\.jpe?g$/i.test(it.name);
    var isPng = it.file.type === 'image/png' || /\.png$/i.test(it.name);
    if (!needScale && (isJpeg || isPng)) {
      return it.file.arrayBuffer().then(function (b) { return { bytes: new Uint8Array(b), fmt: isJpeg ? 'jpg' : 'png', w: it.w, h: it.h }; });
    }
    // WebP, or oversized: draw to canvas and re-encode (PNG keeps alpha, JPEG for opaque jpeg sources)
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var s = needScale ? MAX_DIM / Math.max(it.w, it.h) : 1;
        var w = Math.round(it.w * s), h = Math.round(it.h * s);
        var cv = el('canvas', {}); cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        var asJpeg = isJpeg;
        cv.toBlob(function (blob) {
          blob.arrayBuffer().then(function (b) { cv.width = cv.height = 0; res({ bytes: new Uint8Array(b), fmt: asJpeg ? 'jpg' : 'png', w: w, h: h }); });
        }, asJpeg ? 'image/jpeg' : 'image/png', 0.9);
      };
      img.onerror = function () { rej(new Error('decode')); };
      img.src = it.url;
    });
  }

  function embed(PDFLib, pdf, prep) {
    var p = prep.fmt === 'jpg' ? pdf.embedJpg(prep.bytes) : pdf.embedPng(prep.bytes);
    return p.then(function (img) {
      var iw = prep.w, ih = prep.h;
      var margin = { none: 0, small: 18, normal: 36 }[opts.margin];
      var pw, ph;
      if (opts.size === 'auto') {
        var s = 842 / Math.max(iw, ih);
        pw = iw * s + margin * 2; ph = ih * s + margin * 2;
      } else {
        var dims = opts.size === 'a4' ? [595.28, 841.89] : [612, 792];
        var landscape = opts.orient === 'landscape' || (opts.orient === 'auto' && iw > ih);
        pw = landscape ? dims[1] : dims[0]; ph = landscape ? dims[0] : dims[1];
      }
      var page = pdf.addPage([pw, ph]);
      var availW = pw - margin * 2, availH = ph - margin * 2;
      var sc = Math.min(availW / iw, availH / ih);
      var w = iw * sc, h = ih * sc;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    });
  }
})();
