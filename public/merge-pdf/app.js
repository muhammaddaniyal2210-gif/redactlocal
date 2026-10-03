/* Merge PDF — copy pages with pdf-lib, preserving text/vectors. */
(function () {
  'use strict';
  var RL = window.RL, el = RL.el;
  var drop = RL.$('#drop'), input = RL.$('#file'), err = RL.$('#err'), work = RL.$('#work');
  var items = []; // {id, file, name, size, pages, bytes, status, error}
  var seq = 0, merging = false, dragId = null;

  RL.setupDropzone(drop, input, addFiles, { accept: function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); } });

  function addFiles(files) {
    RL.clearMsg(err);
    var pdfs = files.filter(function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); });
    var rejected = files.length - pdfs.length;
    if (!pdfs.length) { if (rejected) RL.error(err, 'Please choose PDF files.'); return; }
    drop.hidden = true; work.hidden = false;
    var pending = pdfs.length;
    pdfs.forEach(function (f) {
      var item = { id: ++seq, file: f, name: f.name, size: f.size, pages: 0, bytes: null, status: 'loading', error: null };
      items.push(item);
      f.arrayBuffer().then(function (buf) {
        item.bytes = new Uint8Array(buf);
        return RL.ensurePdfLib().then(function (PDFLib) {
          return PDFLib.PDFDocument.load(item.bytes, { ignoreEncryption: false, updateMetadata: false });
        });
      }).then(function (doc) {
        item.pages = doc.getPageCount(); item.status = 'ready';
      }).catch(function (e) {
        item.status = 'error';
        item.error = (e && e.name === 'EncryptedPDFError') ? 'Password-protected — remove the password first' : 'Couldn’t read this PDF (it may be damaged)';
      }).then(function () { if (--pending === 0) { if (rejected) RL.warn(err, rejected + ' non-PDF file' + (rejected === 1 ? '' : 's') + ' skipped.'); render(); } else render(); });
    });
    render();
  }

  function removeItem(id) { items = items.filter(function (it) { return it.id !== id; }); if (!items.length) reset(); else render(); }
  function move(id, dir) { var i = items.findIndex(function (it) { return it.id === id; }); var j = i + dir; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; render(); }
  function reset() { RL.revokeAll(); items = []; work.hidden = true; work.innerHTML = ''; drop.hidden = false; RL.clearMsg(err); }

  function render() {
    if (!items.length) { reset(); return; }
    work.innerHTML = '';
    var list = el('ul', { class: 'filelist' });
    items.forEach(function (it, idx) {
      var li = el('li', { class: 'fileitem', draggable: it.status === 'ready' ? 'true' : 'false', 'data-id': it.id });
      li.appendChild(el('span', { class: 'fi-handle', 'aria-hidden': 'true', title: 'Drag to reorder', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>' }));
      var meta = it.status === 'loading' ? 'Reading…' : it.status === 'error' ? it.error : (it.pages + ' page' + (it.pages === 1 ? '' : 's') + ' · ' + RL.fmtBytes(it.size));
      var main = el('div', { class: 'fi-main' }, [
        el('div', { class: 'fi-name', text: it.name, title: it.name }),
        el('div', { class: 'fi-meta', text: meta, style: it.status === 'error' ? 'color:var(--red)' : '' })
      ]);
      li.appendChild(main);
      var up = el('button', { class: 'fi-remove', type: 'button', 'aria-label': 'Move up', title: 'Move up', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>', onclick: function () { move(it.id, -1); } });
      var dn = el('button', { class: 'fi-remove', type: 'button', 'aria-label': 'Move down', title: 'Move down', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>', onclick: function () { move(it.id, 1); } });
      if (idx === 0) up.disabled = true; if (idx === items.length - 1) dn.disabled = true;
      li.appendChild(up); li.appendChild(dn);
      li.appendChild(el('button', { class: 'fi-remove', type: 'button', 'aria-label': 'Remove ' + it.name, title: 'Remove', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', onclick: function () { removeItem(it.id); } }));
      if (it.status === 'ready') wireDrag(li, list);
      list.appendChild(li);
    });
    work.appendChild(list);

    var ready = items.filter(function (it) { return it.status === 'ready'; });
    var totalPages = ready.reduce(function (s, it) { return s + it.pages; }, 0);
    var summary = el('p', { class: 'hint', style: 'margin-top:.25rem', text: ready.length + ' file' + (ready.length === 1 ? '' : 's') + ' ready · ' + totalPages + ' page' + (totalPages === 1 ? '' : 's') + ' total' });
    work.appendChild(summary);

    var actions = el('div', { class: 'actions' });
    var mergeBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Merge PDFs', onclick: run });
    if (ready.length < 2) mergeBtn.disabled = true;
    actions.appendChild(mergeBtn);
    actions.appendChild(el('label', { class: 'btn btn-secondary', text: 'Add more PDFs' }, [mkAddInput()]));
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    work.appendChild(actions);
    if (ready.length < 2) work.appendChild(el('p', { class: 'hint', text: 'Add at least two readable PDFs to merge.' }));
    work.appendChild(el('div', { id: 'status' }));
  }

  function mkAddInput() {
    var inp = el('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: 'true', class: 'sr-only' });
    inp.addEventListener('change', function () { addFiles(Array.prototype.slice.call(inp.files)); inp.value = ''; });
    return inp;
  }

  function wireDrag(li, list) {
    li.addEventListener('dragstart', function (e) { dragId = +li.getAttribute('data-id'); li.classList.add('dragging'); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (x) {} } });
    li.addEventListener('dragend', function () { li.classList.remove('dragging'); RL.$$('.fileitem', list).forEach(function (n) { n.classList.remove('dragover'); }); });
    li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('dragover'); });
    li.addEventListener('dragleave', function () { li.classList.remove('dragover'); });
    li.addEventListener('drop', function (e) {
      e.preventDefault(); li.classList.remove('dragover');
      var from = items.findIndex(function (it) { return it.id === dragId; });
      var to = items.findIndex(function (it) { return it.id === +li.getAttribute('data-id'); });
      if (from < 0 || to < 0 || from === to) return;
      var moved = items.splice(from, 1)[0]; items.splice(to, 0, moved); render();
    });
  }

  function run() {
    if (merging) return;
    var ready = items.filter(function (it) { return it.status === 'ready'; });
    if (ready.length < 2) return;
    merging = true; RL.clearMsg(err);
    var status = RL.$('#status'); status.innerHTML = '';
    var label = el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Merging…' })]);
    var bar = el('div', { class: 'progress-bar' });
    status.appendChild(el('div', { class: 'progress' }, [label, el('div', { class: 'progress-track' }, [bar])]));

    RL.ensurePdfLib().then(function (PDFLib) {
      var out;
      return PDFLib.PDFDocument.create().then(function (doc) {
        out = doc;
        var i = 0;
        function next() {
          if (i >= ready.length) return out;
          var it = ready[i];
          label.lastChild.textContent = 'Adding ' + it.name + ' (' + (i + 1) + ' of ' + ready.length + ')…';
          return PDFLib.PDFDocument.load(it.bytes, { ignoreEncryption: false, updateMetadata: false }).then(function (src) {
            return out.copyPages(src, src.getPageIndices());
          }).then(function (pages) {
            pages.forEach(function (p) { out.addPage(p); });
            bar.style.width = Math.round((i + 1) / ready.length * 100) + '%';
            i++;
            return new Promise(function (r) { setTimeout(function () { r(next()); }, 0); });
          });
        }
        return next();
      }).then(function () { return out.save({ useObjectStreams: true }); });
    }).then(function (bytes) {
      merging = false; status.innerHTML = '';
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var pages = ready.reduce(function (s, it) { return s + it.pages; }, 0);
      var box = el('div', { class: 'result' });
      box.appendChild(el('h3', { text: 'Your merged PDF is ready' }));
      box.appendChild(el('p', { text: ready.length + ' files combined into one.' }));
      box.appendChild(el('div', { class: 'stats' }, [
        el('span', { class: 'stat', html: '<b>' + pages + '</b> pages' }),
        el('span', { class: 'stat', html: '<b>' + RL.fmtBytes(blob.size) + '</b> PDF' })
      ]));
      var actions = el('div', { class: 'actions', style: 'justify-content:center' });
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Download merged.pdf', onclick: function () { RL.download(blob, 'merged.pdf'); } }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
      box.appendChild(actions);
      status.appendChild(box); box.scrollIntoView({ block: 'nearest' });
    }).catch(function (e) {
      merging = false; RL.$('#status').innerHTML = '';
      RL.error(err, 'We couldn’t merge these PDFs. One of them may be damaged or protected — remove it and try again.');
    });
  }
})();
