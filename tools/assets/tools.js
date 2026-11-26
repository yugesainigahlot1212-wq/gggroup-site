/* GG Group free tools — shared helpers. Everything runs in the browser; no file is uploaded. */
(function (w) {
  "use strict";
  var GG = {};
  GG.$ = function (id) { return document.getElementById(id); };
  GG.num = function (id) {
    var el = GG.$(id); if (!el) return NaN;
    var v = String(el.value).replace(/,/g, "").trim();
    return v === "" ? NaN : Number(v);
  };
  GG.inr = function (n, d) {
    if (!isFinite(n)) return "—";
    d = d == null ? 2 : d;
    return "₹ " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  GG.fmt = function (n, d) {
    if (!isFinite(n)) return "—";
    d = d == null ? 2 : d;
    return Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
  };
  GG.kb = function (bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };
  GG.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  GG.err = function (id, msg) { var el = GG.$(id); if (el) el.textContent = msg || ""; };
  GG.html = function (id, h) { var el = GG.$(id); if (el) el.innerHTML = h; };
  GG.kv = function (rows) {
    return '<div class="t-kv">' + rows.map(function (r) { return "<span>" + r[0] + "</span><b>" + r[1] + "</b>"; }).join("") + "</div>";
  };
  GG.baseName = function (name) { return String(name || "file").replace(/\.[^.]+$/, "").replace(/[^\w\u0900-\u097F-]+/g, "_").slice(0, 60) || "file"; };

  /* download a Blob; keeps the object URL alive for a while so mobile browsers can finish */
  GG.download = function (blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  };
  GG.dlButton = function (blob, name, label) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "t-btn t-btn--green";
    b.textContent = (label || "⬇ डाउनलोड") + " (" + GG.kb(blob.size) + ")";
    b.addEventListener("click", function () { GG.download(blob, name); });
    return b;
  };

  /* drag & drop + click file picker. opts: {accept, multiple, onFiles} */
  GG.drop = function (zoneId, inputId, onFiles) {
    var zone = GG.$(zoneId), input = GG.$(inputId);
    input.addEventListener("change", function () { if (input.files.length) onFiles(Array.prototype.slice.call(input.files)); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.remove("is-over"); }); });
    zone.addEventListener("drop", function (ev) { var f = ev.dataTransfer && ev.dataTransfer.files; if (f && f.length) onFiles(Array.prototype.slice.call(f)); });
  };

  GG.readBuf = function (file) { return file.arrayBuffer ? file.arrayBuffer() : new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsArrayBuffer(file); }); };
  GG.loadImage = function (file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("यह फाइल फोटो के रूप में नहीं खुल रही। JPG, PNG या WEBP चुनें।")); };
      img.src = url;
    });
  };
  GG.isImage = function (f) { return /^image\/(jpe?g|png|webp|gif|bmp)$/i.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name); };
  GG.isPdf = function (f) { return f.type === "application/pdf" || /\.pdf$/i.test(f.name); };

  GG.toBlob = function (canvas, type, q) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) { b ? res(b) : rej(new Error("फोटो बनाने में दिक्कत आई।")); }, type, q);
    });
  };
  /* draw image (or canvas) onto a new canvas of w×h; white background for JPG */
  GG.draw = function (src, wdt, hgt, bg) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(wdt)); c.height = Math.max(1, Math.round(hgt));
    var x = c.getContext("2d");
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  };
  /* JPEG between minKB and maxKB: binary-search quality, then shrink dimensions if needed. */
  GG.jpegToTarget = async function (src, maxKB, minKB, fixed, maxScale) {
    maxScale = maxScale || 3;
    var W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
    var maxB = maxKB * 1024, minB = (minKB || 0) * 1024, scale = 1, best = null;
    for (var round = 0; round < 14; round++) {
      var c = GG.draw(src, W * scale, H * scale, "#fff");
      var lo = 0.05, hi = 0.95, fit = null;
      for (var i = 0; i < 8; i++) {
        var q = (lo + hi) / 2, b = await GG.toBlob(c, "image/jpeg", q);
        if (b.size <= maxB) { fit = { blob: b, q: q, w: c.width, h: c.height }; lo = q; } else hi = q;
      }
      if (!fit) { var b2 = await GG.toBlob(c, "image/jpeg", 0.05); if (b2.size <= maxB) fit = { blob: b2, q: 0.05, w: c.width, h: c.height }; }
      if (fit) {
        best = fit;
        if (fit.blob.size >= minB || scale >= maxScale || fixed) break;
        /* below the minimum even at best quality: enlarge a little and try again */
        scale *= 1.25; continue;
      }
      if (fixed) break;
      scale *= 0.85;
      if (W * scale < 40 || H * scale < 40) break;
    }
    return best;
  };

  /* pdf.js setup (loaded from cdnjs on pages that need it) */
  GG.pdfjs = function () {
    var lib = w.pdfjsLib;
    if (!lib) throw new Error("PDF लाइब्रेरी लोड नहीं हुई। इंटरनेट चेक करके पेज दोबारा खोलें।");
    if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return lib;
  };
  GG.openPdfJs = async function (buf) {
    try {
      return await GG.pdfjs().getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    } catch (e) {
      if (e && e.name === "PasswordException") throw new Error("यह PDF पासवर्ड से लॉक है। पहले पासवर्ड हटाकर (अनलॉक) फाइल चुनें।");
      throw new Error("PDF नहीं खुल पाई — फाइल खराब या अधूरी हो सकती है।");
    }
  };
  GG.openPdfLib = async function (buf) {
    if (!w.PDFLib) throw new Error("PDF लाइब्रेरी लोड नहीं हुई। इंटरनेट चेक करके पेज दोबारा खोलें।");
    try {
      return await w.PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
    } catch (e) {
      if (/encrypt/i.test(String(e && e.message))) throw new Error("यह PDF पासवर्ड/सुरक्षा से लॉक है। लॉक PDF को ब्राउज़र में बदला नहीं जा सकता।");
      throw new Error("PDF नहीं खुल पाई — फाइल खराब या अधूरी हो सकती है।");
    }
  };
  GG.renderPage = async function (pdf, n, scale) {
    var page = await pdf.getPage(n);
    var vp = page.getViewport({ scale: scale });
    var c = document.createElement("canvas");
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: x, viewport: vp }).promise;
    return c;
  };
  GG.thumb = async function (pdf, n, width) {
    var page = await pdf.getPage(n);
    var vp1 = page.getViewport({ scale: 1 });
    return GG.renderPage(pdf, n, (width || 160) / vp1.width);
  };
  /* "1-3, 5, 8-10" → [1,2,3,5,8,9,10] (validated against total) */
  GG.parseRanges = function (str, total) {
    var out = [], parts = String(str || "").replace(/\s+/g, "").split(",").filter(Boolean);
    if (!parts.length) throw new Error("पेज नंबर लिखें, जैसे 1-3, 5");
    parts.forEach(function (p) {
      var m = p.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) throw new Error("“" + p + "” सही नहीं है। ऐसे लिखें: 1-3, 5, 8-10");
      var a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b < 1 || a > total || b > total) throw new Error("पेज " + p + " मौजूद नहीं है — इस PDF में कुल " + total + " पेज हैं।");
      if (a > b) { var t = a; a = b; b = t; }
      for (var i = a; i <= b; i++) out.push(i);
    });
    return out;
  };
  GG.progress = function (id, frac) { var el = GG.$(id); if (el) { el.hidden = frac == null; var i = el.querySelector("i"); if (i) i.style.width = Math.round((frac || 0) * 100) + "%"; } };
  GG.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || "काम चल रहा है…"; btn.disabled = true; }
    else { if (btn.dataset.l) btn.textContent = btn.dataset.l; btn.disabled = false; }
  };
  GG.zip = async function (files, name) {
    if (!w.JSZip) throw new Error("ZIP लाइब्रेरी लोड नहीं हुई — फाइलें एक-एक करके डाउनलोड करें।");
    var z = new w.JSZip(); files.forEach(function (f) { z.file(f.name, f.blob); });
    var b = await z.generateAsync({ type: "blob" }); GG.download(b, name);
  };
  /* reorderable file list. arr is mutated in place; returns render() */
  GG.fileList = function (listId, arr, onChange) {
    function render() {
      var L = GG.$(listId); L.innerHTML = "";
      arr.forEach(function (f, i) {
        var li = document.createElement("li"); li.className = "t-item";
        var ic;
        if (GG.isImage(f)) { ic = document.createElement("img"); if (!f._url) f._url = URL.createObjectURL(f); ic.src = f._url; ic.alt = ""; }
        else { ic = document.createElement("span"); ic.textContent = "📄"; ic.style.fontSize = "26px"; }
        li.appendChild(ic);
        var nm = document.createElement("span"); nm.className = "t-item__name";
        nm.innerHTML = (i + 1) + ". " + GG.esc(f.name) + ' <span class="en">(' + GG.kb(f.size) + ")</span>";
        li.appendChild(nm);
        [["up", "↑", "ऊपर करें"], ["down", "↓", "नीचे करें"], ["del", "✕", "हटाएँ"]].forEach(function (b) {
          var btn = document.createElement("button"); btn.type = "button"; btn.className = "t-ib"; btn.textContent = b[1]; btn.title = b[2]; btn.setAttribute("aria-label", b[2]);
          btn.addEventListener("click", function () {
            if (b[0] === "del") arr.splice(i, 1);
            else if (b[0] === "up" && i > 0) arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
            else if (b[0] === "down" && i < arr.length - 1) arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
            render();
          });
          li.appendChild(btn);
        });
        L.appendChild(li);
      });
      if (onChange) onChange();
    }
    return render;
  };
  /* set print DPI in a JPEG (JFIF APP0; inserted when missing) — pixels untouched */
  GG.jpegDpi = async function (blob, dpi) {
    var u = new Uint8Array(await blob.arrayBuffer());
    if (u[0] !== 0xFF || u[1] !== 0xD8) throw new Error("यह JPG फाइल सही नहीं लग रही।");
    if (u[2] === 0xFF && u[3] === 0xE0 && u[6] === 0x4A && u[7] === 0x46 && u[8] === 0x49 && u[9] === 0x46) {
      u[13] = 1; u[14] = dpi >> 8; u[15] = dpi & 255; u[16] = dpi >> 8; u[17] = dpi & 255;
      return new Blob([u], { type: "image/jpeg" });
    }
    var app0 = new Uint8Array([0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0]);
    return new Blob([u.subarray(0, 2), app0, u.subarray(2)], { type: "image/jpeg" });
  };
  var CRC = null;
  function crc32(bytes) {
    if (!CRC) { CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var x = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) x = CRC[(x ^ bytes[i]) & 255] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  /* set print DPI in a PNG (pHYs chunk replaced/inserted after IHDR) */
  GG.pngDpi = async function (blob, dpi) {
    var u = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u.buffer);
    if (u[1] !== 0x50 || u[2] !== 0x4E || u[3] !== 0x47) throw new Error("यह PNG फाइल सही नहीं लग रही।");
    var parts = [u.subarray(0, 8)], pos = 8, inserted = false, ppm = Math.round(dpi / 0.0254);
    var ch = new Uint8Array(21), cd = new DataView(ch.buffer);
    cd.setUint32(0, 9); ch.set([0x70, 0x48, 0x59, 0x73], 4); cd.setUint32(8, ppm); cd.setUint32(12, ppm); ch[16] = 1; cd.setUint32(17, crc32(ch.subarray(4, 17)));
    while (pos < u.length) {
      var len = dv.getUint32(pos), type = String.fromCharCode(u[pos + 4], u[pos + 5], u[pos + 6], u[pos + 7]), end = pos + 12 + len;
      if (type !== "pHYs") parts.push(u.subarray(pos, end));
      if (type === "IHDR" && !inserted) { parts.push(ch); inserted = true; }
      pos = end;
    }
    return new Blob(parts, { type: "image/png" });
  };
  /* make a JPEG bigger without changing the picture: add empty comment (COM) segments after SOI */
  GG.padJpeg = async function (blob, targetBytes) {
    var u = new Uint8Array(await blob.arrayBuffer()), need = targetBytes - u.length, segs = [];
    while (need > 4) {
      var pay = Math.min(65533, need - 4), s = new Uint8Array(pay + 4);
      s[0] = 0xFF; s[1] = 0xFE; s[2] = (pay + 2) >> 8; s[3] = (pay + 2) & 255; s.fill(32, 4);
      segs.push(s); need -= s.length;
    }
    /* keep a JFIF APP0 (DPI) segment first, comments after it */
    var at = (u[2] === 0xFF && u[3] === 0xE0) ? 4 + ((u[4] << 8) | u[5]) : 2;
    return new Blob([u.subarray(0, at)].concat(segs, [u.subarray(at)]), { type: "image/jpeg" });
  };
  /* JPEG/PNG DPI from file header (null when not set) */
  GG.readDpi = async function (file) {
    var u = new Uint8Array(await file.slice(0, 65536).arrayBuffer()), dv = new DataView(u.buffer);
    if (u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF && u[3] === 0xE0 && u[6] === 0x4A && u[13]) {
      var d = dv.getUint16(14); return u[13] === 2 ? Math.round(d * 2.54) : d;
    }
    if (u[1] === 0x50 && u[2] === 0x4E) {
      for (var p = 8; p + 12 < u.length;) { var len = dv.getUint32(p); if (String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]) === "pHYs" && u[p + 16] === 1) return Math.round(dv.getUint32(p + 8) * 0.0254); p += 12 + len; }
    }
    return null;
  };
  /* simple preview <img> from a blob */
  GG.previewHtml = function (blob, alt) { return '<div class="t-preview"><img src="' + URL.createObjectURL(blob) + '" alt="' + (alt || "नतीजा") + '"></div>'; };
  /* Otsu threshold on a grayscale histogram (for scanned signatures) */
  GG.otsu = function (hist, total) {
    var sum = 0, i; for (i = 0; i < 256; i++) sum += i * hist[i];
    var sB = 0, wB = 0, best = 0, th = 160;
    for (i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; var wF = total - wB; if (!wF) break; sB += i * hist[i];
      var mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = i; } }
    return th;
  };
  w.GG = GG;

  /* hub search */
  document.addEventListener("DOMContentLoaded", function () {
    var s = document.getElementById("toolSearch");
    if (!s) return;
    var cards = document.querySelectorAll(".t-tool"), cats = document.querySelectorAll(".t-cat"), empty = document.getElementById("toolEmpty");
    s.addEventListener("input", function () {
      var q = s.value.trim().toLowerCase(), any = false;
      cards.forEach(function (c) { var hit = !q || (c.getAttribute("data-k") || "").toLowerCase().indexOf(q) > -1 || c.textContent.toLowerCase().indexOf(q) > -1; c.hidden = !hit; if (hit) any = true; });
      cats.forEach(function (c) { c.hidden = !c.querySelector(".t-tool:not([hidden])"); });
      if (empty) empty.style.display = any ? "none" : "block";
    });
  });
})(window);
