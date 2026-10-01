      // Polyfill before loading pdf.js: v6 uses Promise.withResolvers, which
      // older Safari lacks. Dynamic import runs after this line.
      if (typeof Promise.withResolvers !== 'function') {
        Promise.withResolvers = function () {
          let resolve, reject;
          const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
          return { promise, resolve, reject };
        };
      }

      const zone = document.getElementById('zone');
      const fileInput = document.getElementById('file');
      const busy = document.getElementById('busy');
      const busyText = document.getElementById('busyText');
      const errBox = document.getElementById('err');
      const result = document.getElementById('result');

      const show = (el, on) => { el.style.display = on ? (el === busy ? 'flex' : 'block') : 'none'; };
      const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

      let pdfjs = null;
      async function getPdfjs() {
        if (pdfjs) return pdfjs;
        pdfjs = await import('/pdfjs/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        return pdfjs;
      }

      // Safari-safe text read: getTextContent() async-iterates a ReadableStream,
      // which Safari has never supported. Pull it with an explicit reader.
      async function readPageText(page) {
        const items = [];
        if (typeof page.streamTextContent === 'function') {
          const reader = page.streamTextContent({ disableNormalization: false }).getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && Array.isArray(value.items)) for (const it of value.items) items.push(it);
          }
        } else {
          const c = await page.getTextContent();
          if (Array.isArray(c?.items)) items.push(...c.items);
        }
        return items;
      }

      const SAMPLE_CAP = 24000;

      async function inspect(bytes) {
        const lib = await getPdfjs();
        const pdf = await lib.getDocument({
          data: bytes,
          cMapUrl: '/pdfjs/cmaps/', cMapPacked: true,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          isEvalSupported: false,
        }).promise;
        let characters = 0, words = 0, pagesWithText = 0, sample = '', truncated = false, unreadable = 0;
        try {
          for (let n = 1; n <= pdf.numPages; n++) {
            busyText.textContent = `Scanning page ${n} of ${pdf.numPages}…`;
            try {
              const page = await pdf.getPage(n);
              const items = await readPageText(page);
              let t = '';
              for (const it of items) if (typeof it.str === 'string' && it.str) t += it.str + ' ';
              const visible = t.replace(/\s+/g, ' ').trim();
              if (visible) {
                pagesWithText++; characters += visible.length; words += visible.split(' ').length;
                if (sample.length < SAMPLE_CAP) {
                  const room = SAMPLE_CAP - sample.length, add = visible + '\n\n';
                  if (add.length > room) { sample += add.slice(0, room); truncated = true; } else sample += add;
                } else truncated = true;
              }
              try { page.cleanup(); } catch (e) {}
            } catch (e) { unreadable++; }
          }
        } finally { try { pdf.destroy(); } catch (e) {} }
        return { pageCount: pdf.numPages, pagesWithText, characters, words, sample: sample.trim(), truncated, unreadable };
      }

      function render(r) {
        const exposed = r.characters > 0;
        const allUnreadable = r.unreadable >= r.pageCount;
        let html = '';
        if (allUnreadable) {
          html += `<div class="verdict warn"><span class="verdict-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span><div><h2>Couldn’t read this document’s text</h2><p>The pages could not be parsed, so this is not a clean result — check the file by eye.</p></div></div>`;
        } else if (exposed) {
          html += `<div class="verdict danger"><span class="verdict-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span><div><h2>This PDF exposes ${r.characters.toLocaleString()} characters of recoverable text</h2><p>Across ${r.pagesWithText} of ${r.pageCount} ${r.pageCount === 1 ? 'page' : 'pages'}. If any of it sits under a black box, that text is still fully present and can be copied, searched, or extracted with pdftotext.</p></div></div>`;
          html += `<div class="leak"><div class="leak-head"><span>Recoverable text ${r.truncated ? '(first part)' : ''}</span><span>${r.words.toLocaleString()} words</span></div><pre class="leak-text">${esc(r.sample)}</pre><div class="leak-foot">This was read from the file on your device. It is exactly what anyone else could extract from it.</div></div>`;
        } else {
          html += `<div class="verdict safe"><span class="verdict-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></span><div><h2>No recoverable text found</h2><p>This document has no extractable text layer — it appears to be flattened to images. There is nothing here to copy back out. (A scanned document with no OCR looks the same; confirm it’s the file you expect.)</p></div></div>`;
        }
        html += `<div class="actions">`;
        if (exposed) html += `<a class="btn-primary" href="/">Redact it properly — destroy the text &rarr;</a>`;
        html += `<button class="btn-ghost" id="again" type="button">Check another file</button></div>`;
        result.innerHTML = html;
        show(result, true);
        document.getElementById('again').addEventListener('click', reset);
      }

      function reset() {
        show(result, false); show(errBox, false); result.innerHTML = '';
        zone.style.display = '';
      }

      async function handle(file) {
        if (!file) return;
        if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
          errBox.textContent = `“${file.name}” is not a PDF.`; show(errBox, true); return;
        }
        show(errBox, false); show(result, false); show(busy, true); zone.style.display = 'none';
        busyText.textContent = 'Reading the document…';
        try {
          const buf = new Uint8Array(await file.arrayBuffer());
          const r = await inspect(buf);
          render(r);
        } catch (e) {
          console.error(e);
          errBox.textContent = 'This file could not be read as a PDF.'; show(errBox, true); zone.style.display = '';
        } finally { show(busy, false); }
      }

      zone.addEventListener('click', () => fileInput.click());
      zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
      fileInput.addEventListener('change', () => { handle(fileInput.files[0]); fileInput.value = ''; });
      let depth = 0;
      zone.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; zone.classList.add('drag'); });
      zone.addEventListener('dragover', (e) => e.preventDefault());
      zone.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) zone.classList.remove('drag'); });
      zone.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; zone.classList.remove('drag'); handle(e.dataTransfer?.files?.[0]); });
