/* PDF to JPG — render pages locally with pdf.js, export JPG (single) or ZIP (many). */
(function () {
  'use strict';
  var RL = window.RL, el = RL.el;
  var drop = RL.$('#drop'), input = RL.$('#file'), err = RL.$('#err'), work = RL.$('#work');

  var QUALITY = { standard: { scale: 1.5, q: 0.85 }, high: { scale: 2.0, q: 0.92 }, veryhigh: { scale: 3.0, q: 0.95 } };
  var MAX_MP = 24; // cap megapixels per rendered page to protect memory
  var state = { doc: null, name: 'document', pages: 0, selected: {}, quality: 'high', busy: false };

  function reset() {
    if (state.doc) { try { state.doc.destroy(); } catch (e) {} }
    RL.revokeAll();
    state = { doc: null, name: 'document', pages: 0, selected: {}, quality: 'high', busy: false };
    work.hidden = true; work.innerHTML = ''; drop.hidden = false; RL.clearMsg(err);
  }

  RL.setupDropzone(drop, input, function (files) { open(files[0]); },
    { accept: function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); } });

  function open(file) {
    if (!file) return;
    if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) { RL.error(err, 'Please choose a PDF file.'); return; }
    RL.clearMsg(err);
    drop.hidden = true;
    work.hidden = false;
    work.innerHTML = '';
    work.appendChild(el('div', { class: 'progress' }, [
      el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Opening ' + file.name + '…' })])
    ]));
    state.name = RL.baseName(file.name);
    file.arrayBuffer().then(function (buf) {
      return RL.openPdf(new Uint8Array(buf));
    }).then(function (doc) {
      state.doc = doc; state.pages = doc.numPages;
      for (var p = 1; p <= state.pages; p++) state.selected[p] = true;
      buildUI();
    }).catch(function (e) {
      drop.hidden = false; work.hidden = true;
      RL.error(err, friendly(e));
    });
  }

  function friendly(e) {
    var n = e && e.name;
    if (n === 'PasswordException') return 'This PDF is password-protected, so it can’t be opened here. Remove the password first, then try again.';
    if (n === 'InvalidPDFException') return 'We couldn’t open this PDF. The file may be damaged or not a valid PDF.';
    return 'We couldn’t open this PDF. The file may be damaged or password-protected.';
  }

  function buildUI() {
    work.innerHTML = '';
    // controls
    var qseg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Resolution' });
    [['standard', 'Standard'], ['high', 'High'], ['veryhigh', 'Very High']].forEach(function (o) {
      qseg.appendChild(el('button', { type: 'button', 'aria-pressed': state.quality === o[0] ? 'true' : 'false', text: o[1],
        onclick: function () { state.quality = o[0]; RL.$$('button', qseg).forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === o[1] ? 'true' : 'false'); }); } }));
    });
    var controls = el('div', { class: 'controls' }, [
      el('div', { class: 'control' }, [el('label', { text: 'Resolution' }), qseg, el('span', { class: 'hint', text: 'Higher = sharper, larger files' })])
    ]);

    var selInfo = el('div', { class: 'control' });
    var countLabel = el('label', {});
    selInfo.appendChild(countLabel);

    var thumbsWrap = el('div', {});
    var useThumbs = state.pages <= 60;

    if (useThumbs) {
      var selAll = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Select all', onclick: function () { setAll(true); } });
      var selNone = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Clear', onclick: function () { setAll(false); } });
      selInfo.appendChild(el('div', { class: 'actions', style: 'margin-top:.4rem' }, [selAll, selNone]));
      controls.appendChild(selInfo);
    } else {
      var rangeField = el('input', { class: 'field', type: 'text', value: '1-' + state.pages, 'aria-label': 'Pages to convert' });
      state.rangeField = rangeField;
      selInfo.appendChild(el('label', { text: 'Pages (e.g. 1,3,5-8)' }));
      selInfo.appendChild(rangeField);
      controls.appendChild(selInfo);
    }

    work.appendChild(controls);

    var actions = el('div', { class: 'actions' });
    var convertBtn = el('button', { type: 'button', class: 'btn btn-primary', onclick: run }, [
      el('span', { text: 'Convert to JPG' })
    ]);
    actions.appendChild(convertBtn);
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Start over', onclick: reset }));
    work.appendChild(actions);
    state.convertBtn = convertBtn;

    var status = el('div', { id: 'status' });
    work.appendChild(status);
    state.status = status;

    if (useThumbs) {
      var grid = el('div', { class: 'thumbs' });
      thumbsWrap.appendChild(grid);
      work.appendChild(thumbsWrap);
      state.grid = grid;
      renderThumbs(grid, countLabel);
    } else {
      countLabel.textContent = 'This PDF has ' + state.pages + ' pages';
    }
    updateCount(countLabel);
  }

  function setAll(v) {
    for (var p = 1; p <= state.pages; p++) state.selected[p] = v;
    RL.$$('.thumb', state.grid).forEach(function (t) {
      var n = +t.getAttribute('data-page'); t.classList.toggle('selected', !!state.selected[n]);
      t.setAttribute('aria-pressed', state.selected[n] ? 'true' : 'false');
    });
    updateCount(state.countLabel);
  }
  function updateCount(label) {
    state.countLabel = label || state.countLabel;
    if (!state.countLabel || state.rangeField) return;
    var n = 0; for (var p = 1; p <= state.pages; p++) if (state.selected[p]) n++;
    state.countLabel.textContent = n + ' of ' + state.pages + ' page' + (state.pages === 1 ? '' : 's') + ' selected';
  }

  function renderThumbs(grid, countLabel) {
    state.countLabel = countLabel;
    var p = 1;
    function next() {
      if (p > state.pages) { updateCount(countLabel); return; }
      var page = p;
      var cell = el('div', { class: 'thumb selected', role: 'button', tabindex: '0', 'aria-pressed': 'true', 'data-page': page, 'aria-label': 'Page ' + page });
      var check = el('span', { class: 'thumb-check', 'aria-hidden': 'true', html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' });
      var cv = el('canvas', {});
      var num = el('div', { class: 'thumb-num', text: 'Page ' + page });
      cell.appendChild(check); cell.appendChild(cv); cell.appendChild(num);
      function toggle() { state.selected[page] = !state.selected[page]; cell.classList.toggle('selected', state.selected[page]); cell.setAttribute('aria-pressed', state.selected[page] ? 'true' : 'false'); updateCount(countLabel); }
      cell.addEventListener('click', toggle);
      cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      grid.appendChild(cell);
      state.doc.getPage(page).then(function (pg) {
        var vp = pg.getViewport({ scale: 1 });
        var scale = 150 / vp.width;
        var v = pg.getViewport({ scale: scale });
        cv.width = Math.ceil(v.width); cv.height = Math.ceil(v.height);
        var task = pg.render({ canvasContext: cv.getContext('2d'), viewport: v });
        return task.promise.then(function () { try { pg.cleanup(); } catch (e) {} });
      }).then(function () { p++; next(); }, function () { p++; next(); });
    }
    next();
  }

  function selectedPages() {
    if (state.rangeField) {
      var r = RL.parseRanges(state.rangeField.value, state.pages);
      if (r.error) return { error: r.error };
      return { pages: r.pages };
    }
    var out = [];
    for (var p = 1; p <= state.pages; p++) if (state.selected[p]) out.push(p);
    if (!out.length) return { error: 'Select at least one page to convert.' };
    return { pages: out };
  }

  function run() {
    if (state.busy) return;
    RL.clearMsg(err);
    var sel = selectedPages();
    if (sel.error) { RL.error(err, sel.error); return; }
    var pages = sel.pages, qo = QUALITY[state.quality];
    state.busy = true; state.convertBtn.disabled = true;
    state.status.innerHTML = '';
    var track = el('div', { class: 'progress-track' }), bar = el('div', { class: 'progress-bar' });
    track.appendChild(bar);
    var label = el('div', { class: 'progress-label' }, [el('span', { class: 'spinner' }), el('span', { text: 'Preparing…' })]);
    var prog = el('div', { class: 'progress' }, [label, track]);
    state.status.appendChild(prog);

    var results = [], done = 0;
    function step(i) {
      if (i >= pages.length) return finish(results, pages);
      var pageNo = pages[i];
      label.lastChild.textContent = 'Converting page ' + pageNo + ' (' + (i + 1) + ' of ' + pages.length + ')…';
      renderJpg(pageNo, qo).then(function (blob) {
        results.push({ page: pageNo, blob: blob });
        done++; bar.style.width = Math.round(done / pages.length * 100) + '%';
        // yield to UI
        setTimeout(function () { step(i + 1); }, 0);
      }).catch(function (e) {
        state.busy = false; state.convertBtn.disabled = false;
        state.status.innerHTML = '';
        RL.error(err, 'Something went wrong while converting page ' + pageNo + '. The PDF may be damaged.');
      });
    }
    step(0);
  }

  function renderJpg(pageNo, qo) {
    return state.doc.getPage(pageNo).then(function (pg) {
      var base = pg.getViewport({ scale: 1 });
      var scale = qo.scale;
      var mp = (base.width * scale) * (base.height * scale) / 1e6;
      if (mp > MAX_MP) scale = scale * Math.sqrt(MAX_MP / mp);
      var vp = pg.getViewport({ scale: scale });
      var cv = el('canvas', {}); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); // JPEG has no alpha
      return pg.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        try { pg.cleanup(); } catch (e) {}
        return new Promise(function (res) {
          cv.toBlob(function (b) { cv.width = cv.height = 0; res(b); }, 'image/jpeg', qo.q);
        });
      });
    });
  }

  function finish(results, pages) {
    state.busy = false; state.convertBtn.disabled = false;
    state.status.innerHTML = '';
    if (results.length === 1) {
      var r0 = results[0];
      showResult([r0], r0.blob, state.name + (pages.length === state.pages && state.pages === 1 ? '' : '-page-' + r0.page) + '.jpg', false);
      return;
    }
    // multiple -> ZIP
    var totalBytes = results.reduce(function (s, r) { return s + r.blob.size; }, 0);
    RL.ensureJSZip().then(function (JSZip) {
      var zip = new JSZip();
      results.forEach(function (r) { zip.file(state.name + '-page-' + r.page + '.jpg', r.blob); });
      return zip.generateAsync({ type: 'blob', compression: 'STORE' });
    }).then(function (zipBlob) {
      showResult(results, zipBlob, state.name + '-jpg.zip', true, totalBytes);
    }).catch(function () {
      RL.error(err, 'We converted the pages but couldn’t build the ZIP. Try fewer pages at once.');
    });
  }

  function showResult(results, blob, filename, isZip, totalBytes) {
    var box = el('div', { class: 'result' });
    box.appendChild(el('h3', { text: results.length === 1 ? 'Your JPG is ready' : results.length + ' JPGs are ready' }));
    box.appendChild(el('p', { text: isZip ? 'All pages are packaged in one ZIP, one JPG per page.' : 'Converted at ' + state.quality.replace('veryhigh', 'very high') + ' resolution.' }));
    var stats = el('div', { class: 'stats' });
    stats.appendChild(el('span', { class: 'stat', html: '<b>' + results.length + '</b> image' + (results.length === 1 ? '' : 's') }));
    stats.appendChild(el('span', { class: 'stat', html: '<b>' + RL.fmtBytes(isZip ? totalBytes : blob.size) + '</b> total' }));
    box.appendChild(stats);
    var actions = el('div', { class: 'actions', style: 'justify-content:center' });
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: isZip ? 'Download ZIP' : 'Download JPG',
      onclick: function () { RL.download(blob, filename); } }));
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', text: 'Convert another PDF', onclick: reset }));
    box.appendChild(actions);
    state.status.appendChild(box);
    box.scrollIntoView({ block: 'nearest' });
  }
})();
