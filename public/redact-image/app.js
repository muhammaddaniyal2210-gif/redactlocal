      (function () {
        var zone = document.getElementById('zone'), fileInput = document.getElementById('file');
        var editor = document.getElementById('editor'), errBox = document.getElementById('err');
        var cv = document.getElementById('cv'), ctx = cv.getContext('2d');
        var mBlack = document.getElementById('mBlack'), mPixel = document.getElementById('mPixel');
        var undoBtn = document.getElementById('undo'), clearBtn = document.getElementById('clear'), dlBtn = document.getElementById('download');

        var img = null;              // the loaded HTMLImageElement
        var rects = [];              // {x,y,w,h,mode} in IMAGE coordinates
        var mode = 'black';
        var scale = 1;               // displayPx per imagePx
        var drag = null;             // in-progress rect (display coords)
        var exportType = 'image/png';
        var baseName = 'image';

        function setMode(m) {
          mode = m;
          mBlack.classList.toggle('on', m === 'black'); mBlack.setAttribute('aria-pressed', m === 'black');
          mPixel.classList.toggle('on', m === 'pixel'); mPixel.setAttribute('aria-pressed', m === 'pixel');
        }
        mBlack.addEventListener('click', function () { setMode('black'); });
        mPixel.addEventListener('click', function () { setMode('pixel'); });

        function fitCanvas() {
          var maxW = Math.min(editor.clientWidth - 24, img.naturalWidth);   // minus stage padding
          scale = Math.min(1, maxW / img.naturalWidth);
          cv.width = Math.round(img.naturalWidth * scale);
          cv.height = Math.round(img.naturalHeight * scale);
          redraw();
        }

        // Pixelate a region: average whatever is CURRENTLY on the canvas there
        // into low-resolution blocks, then upscale with smoothing OFF for solid
        // blocks. Sampling the canvas (not the original image) means a redaction
        // already burned underneath — e.g. a black box — is what gets averaged,
        // so an overlapping black box stays black instead of the original pixels
        // resurfacing. The downsample uses smoothing ON (a box average), so no
        // single original pixel survives and the detail cannot be reconstructed.
        function pixelate(targetCtx, dx, dy, dw, dh, blockPx) {
          dx = Math.max(0, Math.floor(dx)); dy = Math.max(0, Math.floor(dy));
          dw = Math.max(1, Math.round(dw)); dh = Math.max(1, Math.round(dh));
          var bw = Math.max(1, Math.round(dw / blockPx)), bh = Math.max(1, Math.round(dh / blockPx));
          var tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = bh;
          var t = tmp.getContext('2d'); t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high';
          t.drawImage(targetCtx.canvas, dx, dy, dw, dh, 0, 0, bw, bh);
          targetCtx.imageSmoothingEnabled = false;
          targetCtx.drawImage(tmp, 0, 0, bw, bh, dx, dy, dw, dh);
          targetCtx.imageSmoothingEnabled = true;
        }

        // Snap a rectangle (image coordinates) to whole pixels, expanding outward
        // and clamping to the image. Integer bounds guarantee a black box fills
        // every covered pixel with no anti-aliased seam at the edge, and that a
        // pixelated region samples exactly the intended source pixels.
        function snap(r) {
          var x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
          var x2 = Math.min(img.naturalWidth, Math.ceil(r.x + r.w));
          var y2 = Math.min(img.naturalHeight, Math.ceil(r.y + r.h));
          return { x: x, y: y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y), mode: r.mode };
        }

        function redraw() {
          ctx.clearRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            var dx = r.x * scale, dy = r.y * scale, dw = r.w * scale, dh = r.h * scale;
            if (r.mode === 'pixel') pixelate(ctx, dx, dy, dw, dh, Math.max(4, dw / 14));
            else { ctx.fillStyle = '#000'; ctx.fillRect(dx, dy, dw, dh); }
          }
          if (drag) {
            ctx.save();
            ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
            ctx.strokeRect(drag.x, drag.y, drag.w, drag.h);
            ctx.fillStyle = 'rgba(52,211,153,0.15)'; ctx.fillRect(drag.x, drag.y, drag.w, drag.h);
            ctx.restore();
          }
          var has = rects.length > 0;
          undoBtn.disabled = !has; clearBtn.disabled = !has; dlBtn.disabled = !has;
        }

        function pos(e) {
          var b = cv.getBoundingClientRect();
          return { x: (e.clientX - b.left) * (cv.width / b.width), y: (e.clientY - b.top) * (cv.height / b.height) };
        }
        cv.addEventListener('pointerdown', function (e) {
          e.preventDefault(); cv.setPointerCapture(e.pointerId);
          var p = pos(e); drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, w: 0, h: 0 };
        });
        cv.addEventListener('pointermove', function (e) {
          if (!drag) return; e.preventDefault();
          var p = pos(e);
          drag.x = Math.min(drag.x0, p.x); drag.y = Math.min(drag.y0, p.y);
          drag.w = Math.abs(p.x - drag.x0); drag.h = Math.abs(p.y - drag.y0);
          redraw();
        });
        function endDrag() {
          if (!drag) return;
          if (drag.w > 4 && drag.h > 4) {
            rects.push({ x: drag.x / scale, y: drag.y / scale, w: drag.w / scale, h: drag.h / scale, mode: mode });
          }
          drag = null; redraw();
        }
        cv.addEventListener('pointerup', function (e) { e.preventDefault(); endDrag(); });
        cv.addEventListener('pointercancel', function () { drag = null; redraw(); });

        undoBtn.addEventListener('click', function () { rects.pop(); redraw(); });
        clearBtn.addEventListener('click', function () { rects = []; redraw(); });

        dlBtn.addEventListener('click', function () {
          // Burn into full-resolution pixels.
          var out = document.createElement('canvas'); out.width = img.naturalWidth; out.height = img.naturalHeight;
          var o = out.getContext('2d'); o.drawImage(img, 0, 0);
          for (var i = 0; i < rects.length; i++) {
            var r = snap(rects[i]);
            if (r.mode === 'pixel') pixelate(o, r.x, r.y, r.w, r.h, Math.max(6, r.w / 14));
            else { o.fillStyle = '#000'; o.fillRect(r.x, r.y, r.w, r.h); }
          }
          out.toBlob(function (b) {
            var url = URL.createObjectURL(b);
            var a = document.createElement('a'); a.href = url; a.download = baseName + '-redacted.' + (exportType === 'image/png' ? 'png' : 'jpg');
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          }, exportType, 0.95);
        });

        function load(file) {
          if (!file || !/^image\//.test(file.type)) { errBox.textContent = 'Please choose an image file.'; errBox.style.display = ''; return; }
          errBox.style.display = 'none';
          exportType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
          var url = URL.createObjectURL(file);
          var im = new Image();
          im.onload = function () { URL.revokeObjectURL(url); img = im; rects = []; zone.style.display = 'none'; editor.style.display = 'block'; fitCanvas(); };
          im.onerror = function () { URL.revokeObjectURL(url); errBox.textContent = 'This image could not be opened.'; errBox.style.display = ''; };
          im.src = url;
        }

        zone.addEventListener('click', function () { fileInput.click(); });
        zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
        fileInput.addEventListener('change', function () { load(fileInput.files[0]); fileInput.value = ''; });
        var depth = 0;
        zone.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; zone.classList.add('drag'); });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); });
        zone.addEventListener('dragleave', function (e) { e.preventDefault(); if (--depth <= 0) zone.classList.remove('drag'); });
        zone.addEventListener('drop', function (e) { e.preventDefault(); depth = 0; zone.classList.remove('drag'); load(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
        window.addEventListener('resize', function () { if (img) fitCanvas(); });
      })();
