/* Split PDF — extract selected pages, split by ranges, or burst every page. */
(function () {
  'use strict';
  var RL = window.RL, el = RL.el;
  var drop = RL.$('#drop'), input = RL.$('#file'), err = RL.$('#err'), work = RL.$('#work');
  var MAX_THUMBS = 200;
  var state = { doc: null, bytes: null, name: 'document', pages: 0, mode: 'extract', selected: {}, field: null, rangesBox: null, busy: false };

  RL.setupDropzone(drop, input, function (f) { open(f[0]); }, { accept: function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); } });

  function reset() { if (state.doc) { try { state.doc.destroy(); } catch (e) {} } RL.revokeAll(); state = { doc: null, bytes: null, name: 'document', pages: 0, mode: 'extract', selected: {}, field: null, rangesBox: null, busy: false }; work.hidden = true; work.innerHTML = ''; drop.hidden = false; RL.clearMsg(err); }

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
      state.doc = doc; state.pages = doc.numPages; build();
    }).catch(function (e) {
      drop.hidden = false; work.hidden = true;
      RL.error(err, (e && e.name === 'PasswordException') ? 'This PDF is password-protected. Remove the password first, then try again.' : 'We couldn’t open this PDF. The file may be damaged or password-protected.');
    });
  }

  function build() {
    work.innerHTML = '';
    // mode selector
    var seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Split mode' });
    [['extract', 'Extract pages'], ['every', 'Every page'], ['ranges', 'By ranges']].forEach(function (o) {
      seg.appendChild(el('button', { type: 'button', text: o[1], 'aria-pressed': state.mode === o[0] ? 'true' : 'false', onclick: function () { state.mode = o[0]; refreshMode(seg); } }));
    });
    work.appendChild(el('div', { class: 'controls' }, [el('div', { class: 'control' }, [el('label', { text: 'How to split' }), seg])]));

    var modeArea = el('div', { id: 'modeArea' });
    work.appendChild(modeArea);
    state.modeArea = modeArea;

    var actions = el('div', { class: 'actions' });
    state.goBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Split PDF', onclick: run });
    actions.appendChild(state.goBtn);
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    work.appendChild(actions);
    work.appendChild(el('div', { id: 'status' }));

    // thumbnails (used for extract selection)
    if (state.pages <= MAX_THUMBS) {
      var grid = el('div', { class: 'thumbs', style: 'margin-top:1.25rem' });
      state.grid = grid; work.appendChild(grid);
      renderThumbs(grid);
    } else {
      state.grid = null;
    }
    refreshMode(seg);
  }

  function refreshMode(seg) {
    RL.$$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', ((b.textContent === 'Extract pages' && state.mode === 'extract') || (b.textContent === 'Every page' && state.mode === 'every') || (b.textContent === 'By ranges' && state.mode === 'ranges')) ? 'true' : 'false'); });
    var area = state.modeArea; area.innerHTML = '';
    if (state.grid) state.grid.style.display = (state.mode === 'extract') ? '' : 'none';
    if (state.mode === 'extract') {
      var field = el('input', { class: 'field', type: 'text', placeholder: 'e.g. 1,3,5-8', value: selToRanges(), 'aria-label': 'Pages to extract' });
      state.field = field;
      field.addEventListener('change', function () { applyField(field.value); });
      area.appendChild(el('div', { class: 'controls' }, [el('div', { class: 'control', style: 'flex:1;min-width:220px' }, [el('label', { text: 'Pages to extract (click thumbnails or type)' }), field, el('span', { class: 'hint', text: 'Extracts into one PDF, in order.' })])]));
    } else if (state.mode === 'every') {
      state.field = null;
      area.appendChild(el('p', { class: 'hint', style: 'margin-top:.5rem', text: 'Each of the ' + state.pages + ' pages becomes its own PDF, delivered as a ZIP.' }));
    } else {
      state.field = null;
      var ta = el('textarea', { class: 'field', rows: '4', placeholder: '1-3\n4-8\n9-12', style: 'font-family:var(--mono);resize:vertical', 'aria-label': 'Ranges, one per line' });
      state.rangesBox = ta;
      area.appendChild(el('div', { class: 'controls' }, [el('div', { class: 'control', style: 'flex:1;min-width:220px' }, [el('label', { text: 'Ranges — one per line' }), ta, el('span', { class: 'hint', text: 'Each line becomes a separate PDF, delivered as a ZIP.' })])]));
    }
  }

  function renderThumbs(grid) {
    var p = 1;
    (function next() {
      if (p > state.pages) return;
      var page = p;
      var cell = el('div', { class: 'thumb', role: 'button', tabindex: '0', 'aria-pressed': 'false', 'data-page': page, 'aria-label': 'Page ' + page });
      cell.appendChild(el('span', { class: 'thumb-check', 'aria-hidden': 'true', html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' }));
      var cv = el('canvas', {});
      cell.appendChild(cv);
      cell.appendChild(el('div', { class: 'thumb-num', text: 'Page ' + page }));
      function toggle() { state.selected[page] = !state.selected[page]; syncCell(cell, page); if (state.field) state.field.value = selToRanges(); }
      cell.addEventListener('click', toggle);
      cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      grid.appendChild(cell);
      state.doc.getPage(page).then(function (pg) {
        var vp = pg.getViewport({ scale: 1 }); var s = 150 / vp.width; var v = pg.getViewport({ scale: s });
        cv.width = Math.ceil(v.width); cv.height = Math.ceil(v.height);
        return pg.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise.then(function () { try { pg.cleanup(); } catch (e) {} });
      }).then(function () { p++; next(); }, function () { p++; next(); });
    })();
  }
  function syncCell(cell, page) { cell.classList.toggle('selected', !!state.selected[page]); cell.setAttribute('aria-pressed', state.selected[page] ? 'true' : 'false'); }

  function applyField(val) {
    var r = RL.parseRanges(val, state.pages);
    if (r.error) { RL.error(err, r.error); return; }
    RL.clearMsg(err);
    state.selected = {}; r.pages.forEach(function (n) { state.selected[n] = true; });
    if (state.grid) RL.$$('.thumb', state.grid).forEach(function (c) { syncCell(c, +c.getAttribute('data-page')); });
    state.field.value = selToRanges();
  }

  function selToRanges() {
    var nums = []; for (var p = 1; p <= state.pages; p++) if (state.selected[p]) nums.push(p);
    if (!nums.length) return '';
    var out = [], start = nums[0], prev = nums[0];
    for (var i = 1; i <= nums.length; i++) {
      if (i < nums.length && nums[i] === prev + 1) { prev = nums[i]; continue; }
      out.push(start === prev ? '' + start : start + '-' + prev);
      if (i < nums.length) { start = prev = nums[i]; }
    }
    return out.join(',');
  }

  function run() {
    if (state.busy) return;
    RL.clearMsg(err);
    var jobs; // array of {name, pages:[...1-based]}
    if (state.mode === 'extract') {
      var r = RL.parseRanges(state.field ? state.field.value : '', state.pages);
      if (r.error) { RL.error(err, r.error); return; }
      if (!r.pages.length) { RL.error(err, 'Select at least one page.'); return; }
      jobs = [{ name: state.name + '-' + labelFor(r.pages) + '.pdf', pages: r.pages }];
    } else if (state.mode === 'every') {
      jobs = []; for (var p = 1; p <= state.pages; p++) jobs.push({ name: state.name + '-page-' + p + '.pdf', pages: [p] });
    } else {
      var lines = (state.rangesBox.value || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!lines.length) { RL.error(err, 'Enter at least one range, e.g. 1-3 on its own line.'); return; }
      jobs = [];
      for (var i = 0; i < lines.length; i++) {
        var rr = RL.parseRanges(lines[i], state.pages);
        if (rr.error) { RL.error(err, 'Line "' + lines[i] + '": ' + rr.error); return; }
        jobs.push({ name: state.name + '-' + labelFor(rr.pages) + '.pdf', pages: rr.pages });
      }
    }

    state.busy = true; state.goBtn.disabled = true;
    var status = RL.$('#status'); status.innerHTML = '';
    var label = el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Splitting…' })]);
    var bar = el('div', { class: 'progress-bar' });
    status.appendChild(el('div', { class: 'progress' }, [label, el('div', { class: 'progress-track' }, [bar])]));

    RL.ensurePdfLib().then(function (PDFLib) {
      return PDFLib.PDFDocument.load(state.bytes, { ignoreEncryption: false, updateMetadata: false }).then(function (src) {
        var results = []; var i = 0;
        function next() {
          if (i >= jobs.length) return results;
          var job = jobs[i];
          label.lastChild.textContent = 'Building ' + (i + 1) + ' of ' + jobs.length + '…';
          return PDFLib.PDFDocument.create().then(function (out) {
            return out.copyPages(src, job.pages.map(function (n) { return n - 1; })).then(function (ps) {
              ps.forEach(function (pg) { out.addPage(pg); });
              return out.save({ useObjectStreams: true });
            });
          }).then(function (bytes) {
            results.push({ name: job.name, blob: new Blob([bytes], { type: 'application/pdf' }) });
            bar.style.width = Math.round((i + 1) / jobs.length * 100) + '%'; i++;
            return new Promise(function (r) { setTimeout(function () { r(next()); }, 0); });
          });
        }
        return next();
      });
    }).then(function (results) { finish(results); }).catch(function (e) {
      state.busy = false; state.goBtn.disabled = false; RL.$('#status').innerHTML = '';
      RL.error(err, 'We couldn’t split this PDF. The file may be damaged or protected.');
    });
  }

  function labelFor(pages) {
    if (pages.length === 1) return 'page-' + pages[0];
    var contiguous = pages.every(function (n, i) { return i === 0 || n === pages[i - 1] + 1; });
    if (contiguous) return 'pages-' + pages[0] + '-' + pages[pages.length - 1];
    return 'pages-' + pages.length + '-selected';
  }

  function finish(results) {
    state.busy = false; state.goBtn.disabled = false;
    var status = RL.$('#status'); status.innerHTML = '';
    if (results.length === 1) { showResult(results, results[0].blob, results[0].name, false); return; }
    RL.ensureJSZip().then(function (JSZip) {
      var zip = new JSZip(); var total = 0;
      results.forEach(function (r) { zip.file(r.name, r.blob); total += r.blob.size; });
      return zip.generateAsync({ type: 'blob', compression: 'STORE' }).then(function (zb) { showResult(results, zb, state.name + '-split.zip', true, total); });
    }).catch(function () { RL.error(err, 'We built the files but couldn’t create the ZIP. Try fewer outputs at once.'); });
  }

  function showResult(results, blob, filename, isZip, total) {
    var box = el('div', { class: 'result' });
    box.appendChild(el('h3', { text: results.length === 1 ? 'Your PDF is ready' : results.length + ' PDFs are ready' }));
    box.appendChild(el('p', { text: isZip ? 'Each split is a separate PDF, packaged in one ZIP.' : 'Pages extracted with text preserved.' }));
    box.appendChild(el('div', { class: 'stats' }, [
      el('span', { class: 'stat', html: '<b>' + results.length + '</b> file' + (results.length === 1 ? '' : 's') }),
      el('span', { class: 'stat', html: '<b>' + RL.fmtBytes(isZip ? total : blob.size) + '</b> total' })
    ]));
    var actions = el('div', { class: 'actions', style: 'justify-content:center' });
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: isZip ? 'Download ZIP' : 'Download PDF', onclick: function () { RL.download(blob, filename); } }));
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    box.appendChild(actions);
    RL.$('#status').appendChild(box); box.scrollIntoView({ block: 'nearest' });
  }
})();
