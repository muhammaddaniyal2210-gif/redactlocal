/* Organize PDF — reorder, rotate, delete pages; export with pdf-lib (no rasterizing). */
(function () {
  'use strict';
  var RL = window.RL, el = RL.el;
  var drop = RL.$('#drop'), input = RL.$('#file'), err = RL.$('#err'), work = RL.$('#work');
  var state = { doc: null, bytes: null, name: 'document', order: [], busy: false, dragUid: null };
  // each page: { uid, src (0-based original index), rot (0/90/180/270), selected, canvas }

  RL.setupDropzone(drop, input, function (f) { open(f[0]); }, { accept: function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); } });

  function reset() { if (state.doc) { try { state.doc.destroy(); } catch (e) {} } RL.revokeAll(); state = { doc: null, bytes: null, name: 'document', order: [], busy: false, dragUid: null }; work.hidden = true; work.innerHTML = ''; drop.hidden = false; RL.clearMsg(err); }

  function open(file) {
    if (!file) return;
    if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) { RL.error(err, 'Please choose a PDF file.'); return; }
    RL.clearMsg(err); drop.hidden = true; work.hidden = false; work.innerHTML = '';
    work.appendChild(el('div', { class: 'progress' }, [el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Opening ' + file.name + '…' })])]));
    state.name = RL.baseName(file.name);
    file.arrayBuffer().then(function (buf) {
      state.bytes = new Uint8Array(buf);
      return RL.openPdf(state.bytes.slice());
    }).then(function (doc) {
      state.doc = doc;
      state.order = [];
      for (var i = 0; i < doc.numPages; i++) state.order.push({ uid: i + 1, src: i, rot: 0, selected: false });
      build();
    }).catch(function (e) {
      drop.hidden = false; work.hidden = true;
      RL.error(err, (e && e.name === 'PasswordException') ? 'This PDF is password-protected. Remove the password first, then try again.' : 'We couldn’t open this PDF. The file may be damaged or password-protected.');
    });
  }

  function build() {
    work.innerHTML = '';
    // toolbar
    var bar = el('div', { class: 'actions', style: 'margin-top:0' });
    bar.appendChild(btn('Rotate left', iconRotL, function () { rotateSelected(-90); }));
    bar.appendChild(btn('Rotate right', iconRotR, function () { rotateSelected(90); }));
    bar.appendChild(btn('Delete', iconTrash, function () { deleteSelected(); }));
    bar.appendChild(el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Select all', onclick: function () { state.order.forEach(function (p) { p.selected = true; }); refreshSel(); } }));
    bar.appendChild(el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Clear', onclick: function () { state.order.forEach(function (p) { p.selected = false; }); refreshSel(); } }));
    work.appendChild(bar);
    work.appendChild(el('p', { class: 'hint', id: 'selhint', text: 'Click pages to select, then rotate or delete. Drag to reorder (or use the move buttons on each page).' }));

    var grid = el('div', { class: 'thumbs', style: 'margin-top:.75rem' });
    state.grid = grid; work.appendChild(grid);
    renderGrid();

    var actions = el('div', { class: 'actions' });
    state.exportBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Apply changes & download', onclick: run });
    actions.appendChild(state.exportBtn);
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    work.appendChild(actions);
    work.appendChild(el('div', { id: 'status' }));
  }

  function btn(label, icon, fn) { return el('button', { type: 'button', class: 'btn btn-secondary btn-sm', title: label, 'aria-label': label, onclick: fn, html: icon }, [el('span', { text: ' ' + label })]); }
  var iconRotL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
  var iconRotR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>';
  var iconTrash = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  function renderGrid() {
    var grid = state.grid; grid.innerHTML = '';
    if (!state.order.length) { grid.appendChild(el('p', { class: 'hint', text: 'No pages left. Start over to load a PDF.' })); return; }
    state.order.forEach(function (p, idx) {
      var cell = el('div', { class: 'thumb' + (p.selected ? ' selected' : ''), draggable: 'true', 'data-uid': p.uid, role: 'button', tabindex: '0', 'aria-pressed': p.selected ? 'true' : 'false', 'aria-label': 'Page ' + (idx + 1) });
      cell.appendChild(el('span', { class: 'thumb-check', 'aria-hidden': 'true', html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' }));
      var holder = el('div', { style: 'overflow:hidden;border-radius:6px;background:#fff;aspect-ratio:1/1.3;display:grid;place-items:center' });
      var cv = p.canvas || el('canvas', {});
      cv.className = 'rot-' + ((p.rot % 360 + 360) % 360);
      cv.style.width = '100%'; cv.style.height = 'auto'; cv.style.aspectRatio = '';
      if ((p.rot % 180) !== 0) { cv.style.width = ''; cv.style.height = '76%'; }
      holder.appendChild(cv);
      cell.appendChild(holder);
      var tools = el('div', { class: 'thumb-tools' });
      tools.appendChild(miniBtn('Move left', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>', function (e) { e.stopPropagation(); moveUid(p.uid, -1); }, idx === 0));
      tools.appendChild(miniBtn('Rotate left', iconRotL, function (e) { e.stopPropagation(); p.rot -= 90; renderGrid(); }));
      tools.appendChild(miniBtn('Rotate right', iconRotR, function (e) { e.stopPropagation(); p.rot += 90; renderGrid(); }));
      tools.appendChild(miniBtn('Delete', iconTrash, function (e) { e.stopPropagation(); removeUid(p.uid); }));
      tools.appendChild(miniBtn('Move right', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>', function (e) { e.stopPropagation(); moveUid(p.uid, 1); }, idx === state.order.length - 1));
      cell.appendChild(el('div', { class: 'thumb-num', text: 'Page ' + (idx + 1) }));
      cell.appendChild(tools);
      function toggle() { p.selected = !p.selected; refreshSel(); }
      cell.addEventListener('click', toggle);
      cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      wireDrag(cell);
      grid.appendChild(cell);
      if (!p.canvas) renderThumb(p, cv);
    });
    refreshSel();
  }

  function miniBtn(label, icon, fn, disabled) { var b = el('button', { type: 'button', title: label, 'aria-label': label, html: icon, onclick: fn }); if (disabled) b.disabled = true; return b; }

  function renderThumb(p, cv) {
    state.doc.getPage(p.src + 1).then(function (pg) {
      var vp = pg.getViewport({ scale: 1 }); var s = 150 / vp.width; var v = pg.getViewport({ scale: s });
      cv.width = Math.ceil(v.width); cv.height = Math.ceil(v.height);
      return pg.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise.then(function () { try { pg.cleanup(); } catch (e) {} p.canvas = cv; });
    }).catch(function () {});
  }

  function refreshSel() {
    RL.$$('.thumb', state.grid).forEach(function (c) {
      var uid = +c.getAttribute('data-uid'); var p = find(uid);
      if (!p) return; c.classList.toggle('selected', p.selected); c.setAttribute('aria-pressed', p.selected ? 'true' : 'false');
    });
    var n = state.order.filter(function (p) { return p.selected; }).length;
    var hint = RL.$('#selhint');
    if (hint) hint.textContent = n ? (n + ' page' + (n === 1 ? '' : 's') + ' selected — rotate or delete them, or act on each page directly.') : 'Click pages to select, then rotate or delete. Drag to reorder (or use the move buttons on each page).';
  }
  function find(uid) { for (var i = 0; i < state.order.length; i++) if (state.order[i].uid === uid) return state.order[i]; return null; }

  function rotateSelected(delta) { var sel = state.order.filter(function (p) { return p.selected; }); (sel.length ? sel : []).forEach(function (p) { p.rot += delta; }); if (!sel.length) { RL.warn(err, 'Select one or more pages first, or use the rotate buttons on a page.'); setTimeout(function () { RL.clearMsg(err); }, 2500); return; } renderGrid(); }
  function deleteSelected() { var sel = state.order.filter(function (p) { return p.selected; }); if (!sel.length) { RL.warn(err, 'Select one or more pages to delete, or use the delete button on a page.'); setTimeout(function () { RL.clearMsg(err); }, 2500); return; } state.order = state.order.filter(function (p) { return !p.selected; }); if (!state.order.length) { RL.error(err, 'That would remove every page. Load a different PDF or start over.'); } renderGrid(); }
  function removeUid(uid) { state.order = state.order.filter(function (p) { return p.uid !== uid; }); renderGrid(); }
  function moveUid(uid, dir) { var i = state.order.findIndex(function (p) { return p.uid === uid; }); var j = i + dir; if (j < 0 || j >= state.order.length) return; var t = state.order[i]; state.order[i] = state.order[j]; state.order[j] = t; renderGrid(); }

  function wireDrag(cell) {
    cell.addEventListener('dragstart', function (e) { state.dragUid = +cell.getAttribute('data-uid'); cell.classList.add('dragging'); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(state.dragUid)); } catch (x) {} } });
    cell.addEventListener('dragend', function () { cell.classList.remove('dragging'); RL.$$('.thumb', state.grid).forEach(function (n) { n.classList.remove('dragover'); }); });
    cell.addEventListener('dragover', function (e) { e.preventDefault(); cell.classList.add('dragover'); });
    cell.addEventListener('dragleave', function () { cell.classList.remove('dragover'); });
    cell.addEventListener('drop', function (e) {
      e.preventDefault(); cell.classList.remove('dragover');
      var from = state.order.findIndex(function (p) { return p.uid === state.dragUid; });
      var to = state.order.findIndex(function (p) { return p.uid === +cell.getAttribute('data-uid'); });
      if (from < 0 || to < 0 || from === to) return;
      var moved = state.order.splice(from, 1)[0]; state.order.splice(to, 0, moved); renderGrid();
    });
  }

  function run() {
    if (state.busy) return;
    if (!state.order.length) { RL.error(err, 'There are no pages to export.'); return; }
    state.busy = true; state.exportBtn.disabled = true; RL.clearMsg(err);
    var status = RL.$('#status'); status.innerHTML = '';
    status.appendChild(el('div', { class: 'progress' }, [el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Building your PDF…' })])]));

    RL.ensurePdfLib().then(function (PDFLib) {
      var degrees = PDFLib.degrees;
      return PDFLib.PDFDocument.load(state.bytes, { ignoreEncryption: false, updateMetadata: false }).then(function (src) {
        return PDFLib.PDFDocument.create().then(function (out) {
          var srcIdx = state.order.map(function (p) { return p.src; });
          return out.copyPages(src, srcIdx).then(function (copied) {
            copied.forEach(function (pg, k) {
              var applied = state.order[k].rot;
              if (applied) {
                var cur = 0; try { cur = pg.getRotation().angle; } catch (e) {}
                pg.setRotation(degrees(((cur + applied) % 360 + 360) % 360));
              }
              out.addPage(pg);
            });
            return out.save({ useObjectStreams: true });
          });
        });
      });
    }).then(function (bytes) {
      state.busy = false; state.exportBtn.disabled = false;
      var status2 = RL.$('#status'); status2.innerHTML = '';
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var box = el('div', { class: 'result' });
      box.appendChild(el('h3', { text: 'Your organized PDF is ready' }));
      box.appendChild(el('p', { text: state.order.length + ' page' + (state.order.length === 1 ? '' : 's') + ', with your changes applied. Text is preserved.' }));
      box.appendChild(el('div', { class: 'stats' }, [el('span', { class: 'stat', html: '<b>' + state.order.length + '</b> pages' }), el('span', { class: 'stat', html: '<b>' + RL.fmtBytes(blob.size) + '</b> PDF' })]));
      var actions = el('div', { class: 'actions', style: 'justify-content:center' });
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Download organized-document.pdf', onclick: function () { RL.download(blob, 'organized-document.pdf'); } }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
      box.appendChild(actions); status2.appendChild(box); box.scrollIntoView({ block: 'nearest' });
    }).catch(function (e) {
      state.busy = false; state.exportBtn.disabled = false; RL.$('#status').innerHTML = '';
      RL.error(err, 'We couldn’t build the organized PDF. The file may be damaged or protected.');
    });
  }
})();
