/* Compress PDF — honest, browser-only.
   Light: lossless structure optimize + metadata strip (keeps selectable text).
   Balanced/Strong: re-render pages as optimized JPEG images (smaller, text not selectable).
   Always compares real sizes; never presents a larger file as a success. */
(function () {
  'use strict';
  var RL = window.RL, el = RL.el;
  var drop = RL.$('#drop'), input = RL.$('#file'), err = RL.$('#err'), work = RL.$('#work');
  var LEVELS = {
    light: { raster: false },
    balanced: { raster: true, dpi: 150, q: 0.78 },
    strong: { raster: true, dpi: 110, q: 0.6 }
  };
  var MAX_MP = 12;
  var state = { bytes: null, name: 'document', origSize: 0, level: 'light', busy: false };

  RL.setupDropzone(drop, input, function (f) { open(f[0]); }, { accept: function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); } });

  function reset() { RL.revokeAll(); state = { bytes: null, name: 'document', origSize: 0, level: 'light', busy: false }; work.hidden = true; work.innerHTML = ''; drop.hidden = false; RL.clearMsg(err); }

  function open(file) {
    if (!file) return;
    if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) { RL.error(err, 'Please choose a PDF file.'); return; }
    RL.clearMsg(err);
    state.name = RL.baseName(file.name); state.origSize = file.size;
    file.arrayBuffer().then(function (buf) { state.bytes = new Uint8Array(buf); build(file.name); })
      .catch(function () { RL.error(err, 'We couldn’t read this file.'); });
  }

  function build(fileName) {
    drop.hidden = true; work.hidden = false; work.innerHTML = '';
    work.appendChild(el('div', { class: 'fileitem' }, [
      el('span', { class: 'fi-handle', 'aria-hidden': 'true', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' }),
      el('div', { class: 'fi-main' }, [el('div', { class: 'fi-name', text: fileName, title: fileName }), el('div', { class: 'fi-meta', text: 'Current size · ' + RL.fmtBytes(state.origSize) })])
    ]));

    var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Compression level' });
    [['light', 'Light'], ['balanced', 'Balanced'], ['strong', 'Strong']].forEach(function (o) {
      seg.appendChild(el('button', { type: 'button', text: o[1], 'aria-pressed': state.level === o[0] ? 'true' : 'false', onclick: function () { state.level = o[0]; RL.$$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === o[1] ? 'true' : 'false'); }); updateNote(); } }));
    });
    work.appendChild(el('div', { class: 'controls' }, [el('div', { class: 'control' }, [el('label', { text: 'Compression level' }), seg])]));
    var note = el('p', { class: 'hint', id: 'lvlnote' });
    work.appendChild(note);

    var actions = el('div', { class: 'actions' });
    state.goBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Compress PDF', onclick: run });
    actions.appendChild(state.goBtn);
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    work.appendChild(actions);
    work.appendChild(el('div', { id: 'status' }));
    updateNote();
  }

  function updateNote() {
    var n = RL.$('#lvlnote');
    n.textContent = state.level === 'light'
      ? 'Light: optimizes the file structure and strips metadata. Text stays selectable; savings are usually modest.'
      : state.level === 'balanced'
        ? 'Balanced: re-renders pages as images (~150 DPI). Good size-vs-quality — note that text becomes non-selectable.'
        : 'Strong: re-renders pages as images (~110 DPI). Smallest file; text becomes non-selectable and fine detail may soften.';
  }

  function run() {
    if (state.busy) return;
    RL.clearMsg(err);
    state.busy = true; state.goBtn.disabled = true;
    var status = RL.$('#status'); status.innerHTML = '';
    var label = el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Compressing…' })]);
    var bar = el('div', { class: 'progress-bar' });
    status.appendChild(el('div', { class: 'progress' }, [label, el('div', { class: 'progress-track' }, [bar])]));
    var cfg = LEVELS[state.level];
    var task = cfg.raster ? rasterCompress(cfg, label, bar) : losslessCompress();
    task.then(function (blob) { done(blob); }).catch(function (e) {
      state.busy = false; state.goBtn.disabled = false; status.innerHTML = '';
      RL.error(err, (e && e.name === 'PasswordException') ? 'This PDF is password-protected. Remove the password first, then try again.' : 'We couldn’t process this PDF. The file may be damaged or password-protected.');
    });
  }

  function losslessCompress() {
    return RL.ensurePdfLib().then(function (PDFLib) {
      return PDFLib.PDFDocument.load(state.bytes, { ignoreEncryption: false, updateMetadata: false });
    }).then(function (doc) {
      try { doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator(''); } catch (e) {}
      return doc.save({ useObjectStreams: true });
    }).then(function (bytes) { return new Blob([bytes], { type: 'application/pdf' }); });
  }

  function rasterCompress(cfg, label, bar) {
    var pdfjsDoc, out, total;
    return RL.openPdf(state.bytes.slice()).then(function (d) {
      pdfjsDoc = d; total = d.numPages;
      return RL.ensurePdfLib();
    }).then(function (PDFLib) {
      return PDFLib.PDFDocument.create();
    }).then(function (doc) {
      out = doc; var i = 1;
      function next() {
        if (i > total) return out;
        label.lastChild.textContent = 'Compressing page ' + i + ' of ' + total + '…';
        var pageNo = i;
        return pdfjsDoc.getPage(pageNo).then(function (pg) {
          var base = pg.getViewport({ scale: 1 });
          var scale = cfg.dpi / 72;
          var mp = (base.width * scale) * (base.height * scale) / 1e6;
          if (mp > MAX_MP) scale = scale * Math.sqrt(MAX_MP / mp);
          var vp = pg.getViewport({ scale: scale });
          var cv = el('canvas', {}); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
          var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
          return pg.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
            try { pg.cleanup(); } catch (e) {}
            return new Promise(function (res) { cv.toBlob(function (b) { cv.width = cv.height = 0; res(b); }, 'image/jpeg', cfg.q); });
          }).then(function (jpgBlob) {
            return jpgBlob.arrayBuffer();
          }).then(function (ab) {
            return out.embedJpg(new Uint8Array(ab)).then(function (img) {
              // page size in points = original page size (base viewport is at 72 dpi)
              var page = out.addPage([base.width, base.height]);
              page.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
            });
          });
        }).then(function () {
          bar.style.width = Math.round(pageNo / total * 100) + '%'; i++;
          return new Promise(function (r) { setTimeout(function () { r(next()); }, 0); });
        });
      }
      return next();
    }).then(function () {
      try { pdfjsDoc.destroy(); } catch (e) {}
      return out.save({ useObjectStreams: true });
    }).then(function (bytes) { return new Blob([bytes], { type: 'application/pdf' }); });
  }

  function done(blob) {
    state.busy = false; state.goBtn.disabled = false;
    var status = RL.$('#status'); status.innerHTML = '';
    var saved = state.origSize - blob.size;
    var pct = Math.round(saved / state.origSize * 100);

    if (saved <= state.origSize * 0.02) {
      // not meaningfully smaller — be honest
      var msg = el('div', { class: 'msg msg-warn' });
      msg.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      msg.appendChild(el('span', { text: state.level === 'light'
        ? 'This PDF is already well optimized. We couldn’t make it meaningfully smaller without reducing quality further. Try Balanced or Strong for larger savings.'
        : 'We couldn’t make this PDF meaningfully smaller at this level without hurting quality further. It may already be optimized, or its pages may be mostly text.' }));
      status.appendChild(msg);
      var again = el('div', { class: 'actions' }, [el('button', { type: 'button', class: 'btn btn-ghost', text: 'Try another level', onclick: function () { status.innerHTML = ''; } }), el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset })]);
      status.appendChild(again);
      return;
    }

    var box = el('div', { class: 'result' });
    box.appendChild(el('h3', { text: 'Compressed — saved ' + pct + '%' }));
    box.appendChild(el('p', { text: LEVELS[state.level].raster ? 'Pages were rebuilt as images, so text in the compressed file is no longer selectable. Keep your original if you need selectable text.' : 'Optimized losslessly — text stays selectable.' }));
    box.appendChild(el('div', { class: 'stats' }, [
      el('span', { class: 'stat', html: 'Original: <b>' + RL.fmtBytes(state.origSize) + '</b>' }),
      el('span', { class: 'stat', html: 'Compressed: <b>' + RL.fmtBytes(blob.size) + '</b>' }),
      el('span', { class: 'stat good', html: 'Saved: <b>' + pct + '%</b>' })
    ]));
    var actions = el('div', { class: 'actions', style: 'justify-content:center' });
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Download compressed PDF', onclick: function () { RL.download(blob, state.name + '-compressed.pdf'); } }));
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    box.appendChild(actions);
    status.appendChild(box); box.scrollIntoView({ block: 'nearest' });
  }
})();
