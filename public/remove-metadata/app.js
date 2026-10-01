      (function () {
        var zone = document.getElementById('zone');
        var fileInput = document.getElementById('file');
        var errBox = document.getElementById('err');
        var results = document.getElementById('results');
        var actions = document.getElementById('actions');

        function show(el, on) { el.style.display = on ? '' : 'none'; }
        function fmtBytes(n){ if(n<1024)return n+' B'; if(n<1048576)return (n/1024).toFixed(0)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
        function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

        // ---- EXIF reader (JPEG). Extracts the tags that actually matter. ----
        function readExif(buf) {
          try {
            var v = new DataView(buf);
            if (v.getUint16(0) !== 0xFFD8) return null;
            var off = 2, len = v.byteLength;
            while (off + 4 <= len) {
              var marker = v.getUint16(off);
              if (marker === 0xFFDA || marker === 0xFFD9) break;        // SOS / EOI
              if ((marker & 0xFF00) !== 0xFF00) break;
              var size = v.getUint16(off + 2);
              if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
                return parseTiff(v, off + 10, off + 2 + size);
              }
              off += 2 + size;
            }
          } catch (e) {}
          return null;
        }
        function parseTiff(v, base, end) {
          var little = v.getUint16(base) === 0x4949;
          var g16 = function (o) { return v.getUint16(o, little); };
          var g32 = function (o) { return v.getUint32(o, little); };
          var out = {};
          var ifd0 = base + g32(base + 4);
          var wants0 = { 0x010F: 'Make', 0x0110: 'Model', 0x0132: 'DateTime', 0x0131: 'Software' };
          var exifPtr = 0, gpsPtr = 0;
          readIfd(ifd0, function (tag, o, count, type) {
            if (wants0[tag]) out[wants0[tag]] = ascii(o, count);
            else if (tag === 0x0112) out.Orientation = g16(o);   // display rotation/flip
            else if (tag === 0x8769) exifPtr = base + g32(o);
            else if (tag === 0x8825) gpsPtr = base + g32(o);
          });
          if (exifPtr) readIfd(exifPtr, function (tag, o, count) {
            if (tag === 0x9003) out.DateTimeOriginal = ascii(o, count);
          });
          if (gpsPtr) {
            var gps = {};
            readIfd(gpsPtr, function (tag, o, count, type) {
              if (tag === 0x0001) gps.latRef = ascii(o, count);
              else if (tag === 0x0002) gps.lat = rationals(o, 3);
              else if (tag === 0x0003) gps.lonRef = ascii(o, count);
              else if (tag === 0x0004) gps.lon = rationals(o, 3);
            });
            if (gps.lat && gps.lon) {
              var la = dms(gps.lat, gps.latRef), lo = dms(gps.lon, gps.lonRef);
              if (la != null && lo != null) out.GPS = la.toFixed(6) + ', ' + lo.toFixed(6);
            }
          }
          return Object.keys(out).length ? out : null;

          function readIfd(ptr, cb) {
            if (ptr + 2 > end) return;
            var n = g16(ptr);
            for (var i = 0; i < n; i++) {
              var e = ptr + 2 + i * 12;
              if (e + 12 > end) break;
              var tag = g16(e), type = g16(e + 2), count = g32(e + 4);
              var size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1) * count;
              var valOff = size <= 4 ? e + 8 : base + g32(e + 8);
              cb(tag, valOff, count, type);
            }
          }
          function ascii(o, count) { var s = ''; for (var i = 0; i < count; i++) { var c = v.getUint8(o + i); if (c === 0) break; s += String.fromCharCode(c); } return s.trim(); }
          function rationals(o, n) { var r = []; for (var i = 0; i < n; i++) { var num = g32(o + i * 8), den = g32(o + i * 8 + 4); r.push(den ? num / den : 0); } return r; }
          function dms(r, ref) { if (!r) return null; var d = r[0] + r[1] / 60 + r[2] / 3600; if (ref === 'S' || ref === 'W') d = -d; return d; }
        }

        // ---- Lossless metadata strip ----
        // Rebuilds the JPEG from its own bytes with every metadata segment gone:
        // all APPn except JFIF (APP0), comments, and anything appended after the
        // EOI marker. The entropy-coded scan is copied verbatim, so it is the same
        // picture. If the source carried an EXIF Orientation, a minimal EXIF block
        // holding only that tag is re-added so the picture still displays the right
        // way up — orientation is display geometry, not private data.
        function stripJpeg(buf, orientation) {
          var v = new DataView(buf), len = v.byteLength;
          if (v.getUint16(0) !== 0xFFD8) return null;
          var keep = [];                        // [start, end) ranges after SOI
          var off = 2;
          while (off + 2 <= len) {
            var marker = v.getUint16(off);
            if ((marker & 0xFF00) !== 0xFF00) break;
            if (marker === 0xFFDA) {            // SOS: scan data runs until EOI
              keep.push([off, findEoi(v, len, off)]);
              break;
            }
            var size = v.getUint16(off + 2);
            var isApp = marker >= 0xFFE0 && marker <= 0xFFEF;        // APPn (EXIF/XMP/IPTC/etc.)
            var isCom = marker === 0xFFFE;                           // comment
            // Keep JFIF (APP0) so the file stays a well-formed baseline JPEG.
            if ((isApp && marker !== 0xFFE0) || isCom) { off += 2 + size; continue; }
            keep.push([off, off + 2 + size]);
            off += 2 + size;
          }
          var ori = orientMarker(orientation), src = new Uint8Array(buf);
          var total = 2 + (ori ? ori.length : 0);
          for (var i = 0; i < keep.length; i++) total += keep[i][1] - keep[i][0];
          var out = new Uint8Array(total), p = 2;
          out[0] = 0xFF; out[1] = 0xD8;
          if (ori) { out.set(ori, p); p += ori.length; }
          for (var j = 0; j < keep.length; j++) { out.set(src.subarray(keep[j][0], keep[j][1]), p); p += keep[j][1] - keep[j][0]; }
          return new Blob([out], { type: 'image/jpeg' });
        }
        // Scan entropy-coded data from the SOS marker for the EOI (FFD9), honouring
        // byte stuffing (FF00), fill bytes (FFFF) and restart markers (FFD0-7) and
        // skipping any further marker segments (progressive JPEGs have several).
        // Returns the offset just past EOI, so trailing appended bytes are excluded.
        function findEoi(v, len, sosOff) {
          var p = sosOff + 2 + v.getUint16(sosOff + 2);   // past the SOS header
          while (p + 1 < len) {
            if (v.getUint8(p) !== 0xFF) { p += 1; continue; }
            var m = v.getUint8(p + 1);
            if (m === 0xD9) return p + 2;                               // EOI
            if (m === 0x00 || (m >= 0xD0 && m <= 0xD7)) { p += 2; continue; } // stuffing / RST
            if (m === 0xFF) { p += 1; continue; }                       // fill byte
            if (p + 4 <= len) { p += 2 + v.getUint16(p + 2); continue; } // another segment
            p += 2;
          }
          return len;   // no EOI found: keep to end rather than lose image data
        }
        // A minimal big-endian EXIF APP1 carrying only the Orientation tag, or null
        // when the orientation is absent or already normal.
        function orientMarker(orientation) {
          if (!orientation || orientation === 1) return null;
          var b = new Uint8Array(36), dv = new DataView(b.buffer);
          dv.setUint16(0, 0xFFE1); dv.setUint16(2, 34);                 // APP1, length
          b[4] = 0x45; b[5] = 0x78; b[6] = 0x69; b[7] = 0x66; b[8] = 0; b[9] = 0; // "Exif\0\0"
          var t = 10;
          dv.setUint16(t, 0x4D4D); dv.setUint16(t + 2, 0x002A); dv.setUint32(t + 4, 8); // TIFF header
          dv.setUint16(t + 8, 1);                                       // one IFD0 entry
          dv.setUint16(t + 10, 0x0112); dv.setUint16(t + 12, 3); dv.setUint32(t + 14, 1); // Orientation, SHORT, count 1
          dv.setUint16(t + 18, orientation); dv.setUint16(t + 20, 0);   // value (left-justified) + pad
          dv.setUint32(t + 22, 0);                                      // next IFD = 0
          return b;
        }
        function stripPng(buf) {
          var src = new Uint8Array(buf);
          var sig = [137, 80, 78, 71, 13, 10, 26, 10];
          for (var s = 0; s < 8; s++) if (src[s] !== sig[s]) return null;
          var v = new DataView(buf), out = [src.subarray(0, 8)], off = 8, len = src.byteLength;
          var drop = { tEXt: 1, zTXt: 1, iTXt: 1, eXIf: 1, tIME: 1 };
          while (off + 8 <= len) {
            var clen = v.getUint32(off);
            var type = String.fromCharCode(src[off+4], src[off+5], src[off+6], src[off+7]);
            var next = off + 12 + clen;
            if (!drop[type]) out.push(src.subarray(off, next));
            if (type === 'IEND') break;
            off = next;
          }
          return new Blob(out, { type: 'image/png' });
        }
        function stripViaCanvas(file) {
          return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
              var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
              c.getContext('2d').drawImage(img, 0, 0);
              // Keep the original format where the browser can encode it (PNG stays
              // lossless). If it cannot (toBlob yields null), fall back to JPEG so
              // the output is always a valid image that matches its extension.
              var preferred = (file.type === 'image/png' || file.type === 'image/webp') ? file.type : 'image/jpeg';
              c.toBlob(function (b) {
                if (b) { URL.revokeObjectURL(url); resolve(b); return; }
                c.toBlob(function (b2) { URL.revokeObjectURL(url); b2 ? resolve(b2) : reject(new Error('encode failed')); }, 'image/jpeg', 0.95);
              }, preferred, preferred === 'image/png' ? undefined : 0.95);
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
            img.src = url;
          });
        }

        // Name the clean file from the OUTPUT format, not the input extension, so a
        // re-encoded file (e.g. a WebP that fell back to JPEG) is never mislabelled.
        function extForType(mime) { return mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg'; }
        function cleanName(name, mime) { var base = name.replace(/\.[^.\/\\]+$/, '') || 'image'; return base + '-clean' + extForType(mime); }

        function row(file, exif, cleanBlob, savedBytes) {
          var thumbUrl = URL.createObjectURL(cleanBlob);
          var card = document.createElement('div'); card.className = 'card';
          var findings = '';
          if (exif) {
            if (exif.GPS) findings += '<div class="finding gps"><span class="k">📍 GPS location</span><span class="v"><a href="https://www.google.com/maps?q=' + encodeURIComponent(exif.GPS) + '" target="_blank" rel="noopener">' + esc(exif.GPS) + '</a> — this is where the photo was taken</span></div>';
            if (exif.Make || exif.Model) findings += '<div class="finding"><span class="k">Camera</span><span class="v">' + esc([exif.Make, exif.Model].filter(Boolean).join(' ')) + '</span></div>';
            var when = exif.DateTimeOriginal || exif.DateTime;
            if (when) findings += '<div class="finding"><span class="k">Date taken</span><span class="v">' + esc(when) + '</span></div>';
            if (exif.Software) findings += '<div class="finding"><span class="k">Software</span><span class="v">' + esc(exif.Software) + '</span></div>';
          }
          var body = findings
            ? '<div class="findings">' + findings + '</div>'
            : '<div class="clean-note"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> No readable EXIF metadata found — the clean copy below is stripped regardless.</div>';
          card.innerHTML =
            '<div class="card-top"><img class="thumb" src="' + thumbUrl + '" alt=""><div><div class="card-name">' + esc(file.name) + '</div><div class="card-meta">' + fmtBytes(file.size) + (savedBytes > 0 ? ' → ' + fmtBytes(cleanBlob.size) : '') + '</div></div></div>' +
            body +
            '<div class="card-foot"><span class="foot-stat">' + (savedBytes > 0 ? ('Removed ' + fmtBytes(savedBytes) + ' of metadata') : 'Metadata stripped') + '</span><a class="btn-dl" download="' + esc(cleanName(file.name, cleanBlob.type)) + '" href="' + thumbUrl + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download clean</a></div>';
          results.appendChild(card);
        }

        async function handleFiles(list) {
          var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type); });
          if (!files.length) { errBox.textContent = 'Please choose image files (JPEG, PNG or WebP).'; show(errBox, true); return; }
          show(errBox, false);
          for (var i = 0; i < files.length; i++) {
            var file = files[i];
            try {
              var buf = await file.arrayBuffer();
              var exif = file.type === 'image/jpeg' ? readExif(buf) : null;
              var blob = null;
              if (file.type === 'image/jpeg') blob = stripJpeg(buf, exif && exif.Orientation);
              else if (file.type === 'image/png') blob = stripPng(buf);
              if (!blob) blob = await stripViaCanvas(file);          // webp / fallback
              row(file, exif, blob, file.size - blob.size);
            } catch (e) {
              console.error(e);
              errBox.textContent = 'One file could not be processed: ' + file.name; show(errBox, true);
            }
          }
          show(actions, true); zone.style.display = 'none';
        }

        function reset() { results.innerHTML = ''; show(actions, false); show(errBox, false); zone.style.display = ''; }

        zone.addEventListener('click', function () { fileInput.click(); });
        zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
        fileInput.addEventListener('change', function () { handleFiles(fileInput.files); fileInput.value = ''; });
        document.getElementById('again').addEventListener('click', reset);
        var depth = 0;
        zone.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; zone.classList.add('drag'); });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); });
        zone.addEventListener('dragleave', function (e) { e.preventDefault(); if (--depth <= 0) zone.classList.remove('drag'); });
        zone.addEventListener('drop', function (e) { e.preventDefault(); depth = 0; zone.classList.remove('drag'); handleFiles(e.dataTransfer && e.dataTransfer.files); });
      })();
