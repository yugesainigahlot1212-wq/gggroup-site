/* GG Group print tools — shared helpers (corner editor, perspective warp, enhance, A4/PDF/print, canvas text).
   Everything runs in the browser; no file is uploaded. Uses window.GG (tools.js) at call time. */
(function (w) {
  "use strict";
  var P = {};
  P.FONT = '"Noto Sans Devanagari","Mukta","Nirmala UI","Mangal",system-ui,Arial,sans-serif';
  P.font = function (px, wt) { return (wt || 400) + " " + Math.round(px) + "px " + P.FONT; };
  P.pxmm = function (dpi) { return dpi / 25.4; };
  /* white canvas of w×h mm at dpi */
  P.sheet = function (wmm, hmm, dpi, bg) {
    var c = document.createElement("canvas");
    c.width = Math.round(wmm * dpi / 25.4); c.height = Math.round(hmm * dpi / 25.4);
    var x = c.getContext("2d"); x.fillStyle = bg || "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    return c;
  };
  P.dims = function (s) { return [s.naturalWidth || s.width, s.naturalHeight || s.height]; };
  /* draw src into box: mode fit (whole picture, letterbox) or fill (cover, centre crop). fy = vertical focus 0..1 for fill */
  P.place = function (x, src, dx, dy, dw, dh, mode, fy) {
    var d = P.dims(src), sw = d[0], sh = d[1];
    if (mode === "fill") {
      var s = Math.max(dw / sw, dh / sh), cw = dw / s, ch = dh / s, f = fy == null ? 0.5 : fy;
      x.drawImage(src, (sw - cw) / 2, (sh - ch) * f, cw, ch, dx, dy, dw, dh);
    } else {
      var s2 = Math.min(dw / sw, dh / sh), w2 = sw * s2, h2 = sh * s2;
      x.drawImage(src, dx + (dw - w2) / 2, dy + (dh - h2) / 2, w2, h2);
    }
  };
  P.rot90 = function (src) {
    var d = P.dims(src), c = document.createElement("canvas"); c.width = d[1]; c.height = d[0];
    var x = c.getContext("2d"); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(src, 0, 0); return c;
  };
  /* copy of an image limited to maxSide px (canvas) */
  P.limit = function (src, maxSide) {
    var d = P.dims(src), k = Math.min(1, maxSide / Math.max(d[0], d[1]));
    var c = document.createElement("canvas"); c.width = Math.round(d[0] * k); c.height = Math.round(d[1] * k);
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height); return c;
  };

  /* ---------- homography / perspective warp ---------- */
  function solve(A, b) {
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) A[i] = A[i].concat([b[i]]);
    for (i = 0; i < n; i++) {
      var mx = i; for (k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[mx][i])) mx = k;
      var t = A[i]; A[i] = A[mx]; A[mx] = t;
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (k = i + 1; k < n; k++) { var f = A[k][i] / A[i][i]; for (j = i; j <= n; j++) A[k][j] -= f * A[i][j]; }
    }
    var xs = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = A[i][n]; for (j = i + 1; j < n; j++) s -= A[i][j] * xs[j]; xs[i] = s / A[i][i]; }
    return xs;
  }
  /* 3×3 matrix mapping points from[] → to[] (4 points each) */
  P.homography = function (from, to) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var X = from[i].x, Y = from[i].y, u = to[i].x, v = to[i].y;
      A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
      A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
    }
    var h = solve(A, b); return h ? h.concat([1]) : null;
  };
  /* warp quad (TL,TR,BR,BL in src px) of src onto W×H canvas — bilinear sampling */
  P.warp = function (src, quad, W, H) {
    W = Math.round(W); H = Math.round(H);
    var d = P.dims(src), sc = document.createElement("canvas"); sc.width = d[0]; sc.height = d[1];
    var sx = sc.getContext("2d"); sx.fillStyle = "#fff"; sx.fillRect(0, 0, d[0], d[1]); sx.drawImage(src, 0, 0);
    var sd = sx.getImageData(0, 0, d[0], d[1]).data, SW = d[0], SH = d[1];
    var Hm = P.homography([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], quad);
    if (!Hm) throw new Error("कोने सही नहीं हैं — चारों कोने दस्तावेज़ के किनारों पर रखें।");
    var oc = document.createElement("canvas"); oc.width = W; oc.height = H;
    var ox = oc.getContext("2d"), od = ox.createImageData(W, H), o = od.data;
    var a = Hm[0], b = Hm[1], c = Hm[2], e = Hm[3], f = Hm[4], g = Hm[5], h7 = Hm[6], h8 = Hm[7];
    for (var y = 0; y < H; y++) {
      var yy = y + 0.5;
      for (var x = 0; x < W; x++) {
        var xx = x + 0.5, den = h7 * xx + h8 * yy + 1;
        var u = (a * xx + b * yy + c) / den - 0.5, v = (e * xx + f * yy + g) / den - 0.5;
        var oi = (y * W + x) * 4;
        if (u < 0) u = 0; if (v < 0) v = 0; if (u > SW - 1.001) u = SW - 1.001; if (v > SH - 1.001) v = SH - 1.001;
        var x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
        for (var ch = 0; ch < 3; ch++) {
          var top = sd[i00 + ch] + (sd[i10 + ch] - sd[i00 + ch]) * fx, bot = sd[i01 + ch] + (sd[i11 + ch] - sd[i01 + ch]) * fx;
          o[oi + ch] = top + (bot - top) * fy;
        }
        o[oi + 3] = 255;
      }
    }
    ox.putImageData(od, 0, 0); return oc;
  };
  /* natural size of the document inside the quad (average opposite edges) */
  P.quadSize = function (q) {
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    return [(dist(q[0], q[1]) + dist(q[3], q[2])) / 2, (dist(q[0], q[3]) + dist(q[1], q[2])) / 2];
  };

  /* ---------- simple automatic document edge detection ---------- */
  P.detect = function (src) {
    var d = P.dims(src), k = Math.min(1, 300 / Math.max(d[0], d[1])), W = Math.max(8, Math.round(d[0] * k)), H = Math.max(8, Math.round(d[1] * k));
    var c = document.createElement("canvas"); c.width = W; c.height = H; var x = c.getContext("2d"); x.drawImage(src, 0, 0, W, H);
    var p = x.getImageData(0, 0, W, H).data, N = W * H, g = new Float32Array(N), i, j;
    for (i = 0; i < N; i++) g[i] = 0.299 * p[i * 4] + 0.587 * p[i * 4 + 1] + 0.114 * p[i * 4 + 2];
    /* box blur ×2 */
    for (var pass = 0; pass < 2; pass++) {
      var t = new Float32Array(N);
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
        var s = 0, n = 0;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var X = xx + dx, Y = yy + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) { s += g[Y * W + X]; n++; } }
        t[yy * W + xx] = s / n;
      }
      g = t;
    }
    var hist = new Array(256).fill(0); for (i = 0; i < N; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
    var th = w.GG && w.GG.otsu ? w.GG.otsu(hist, N) : 128;
    /* is the border darker than the middle? then the document is the bright part */
    var bs = 0, bn = 0, cs = 0, cn = 0;
    for (i = 0; i < W; i++) { bs += g[i] + g[(H - 1) * W + i]; bn += 2; }
    for (j = 0; j < H; j++) { bs += g[j * W] + g[j * W + W - 1]; bn += 2; }
    for (j = (H / 4) | 0; j < (3 * H / 4) | 0; j++) for (i = (W / 4) | 0; i < (3 * W / 4) | 0; i++) { cs += g[j * W + i]; cn++; }
    var docBright = cs / cn >= bs / bn, m = new Uint8Array(N);
    for (i = 0; i < N; i++) m[i] = docBright ? (g[i] > th ? 1 : 0) : (g[i] < th ? 1 : 0);
    /* largest connected component */
    var lab = new Int32Array(N), best = 0, bestId = 0, id = 0, stack = new Int32Array(N);
    for (i = 0; i < N; i++) {
      if (!m[i] || lab[i]) continue;
      id++; var sp = 0, cnt = 0; stack[sp++] = i; lab[i] = id;
      while (sp) {
        var q = stack[--sp]; cnt++; var qx = q % W, qy = (q / W) | 0;
        if (qx > 0 && m[q - 1] && !lab[q - 1]) { lab[q - 1] = id; stack[sp++] = q - 1; }
        if (qx < W - 1 && m[q + 1] && !lab[q + 1]) { lab[q + 1] = id; stack[sp++] = q + 1; }
        if (qy > 0 && m[q - W] && !lab[q - W]) { lab[q - W] = id; stack[sp++] = q - W; }
        if (qy < H - 1 && m[q + W] && !lab[q + W]) { lab[q + W] = id; stack[sp++] = q + W; }
      }
      if (cnt > best) { best = cnt; bestId = id; }
    }
    if (best < N * 0.12 || best > N * 0.97) return null;
    var tl = null, tr = null, br = null, bl = null, a1 = 1e9, a2 = -1e9, a3 = -1e9, a4 = 1e9;
    for (i = 0; i < N; i++) {
      if (lab[i] !== bestId) continue;
      var px = i % W, py = (i / W) | 0, s1 = px + py, s2 = px - py;
      if (s1 < a1) { a1 = s1; tl = [px, py]; } if (s1 > a2) { a2 = s1; br = [px, py]; }
      if (s2 > a3) { a3 = s2; tr = [px, py]; } if (s2 < a4) { a4 = s2; bl = [px, py]; }
    }
    var pts = [tl, tr, br, bl].map(function (v) { return { x: (v[0] + 0.5) / k, y: (v[1] + 0.5) / k }; });
    /* quad must cover most of the blob, otherwise the guess is unreliable */
    var area = 0; for (i = 0; i < 4; i++) { var A = pts[i], B = pts[(i + 1) % 4]; area += A.x * B.y - B.x * A.y; }
    area = Math.abs(area) / 2 * k * k;
    if (area < best * 0.75 || area > best * 1.35) return null;
    return pts;
  };
  P.inset = function (src, f) {
    var d = P.dims(src), fx = d[0] * (f || 0.08), fy = d[1] * (f || 0.08);
    return [{ x: fx, y: fy }, { x: d[0] - fx, y: fy }, { x: d[0] - fx, y: d[1] - fy }, { x: fx, y: d[1] - fy }];
  };

  /* ---------- 4-corner editor ---------- */
  P.cornerEditor = function (host, onChange) {
    var cv = document.createElement("canvas"); cv.className = "t-quad"; host.appendChild(cv);
    var ed = { src: null, pts: null, auto: false }, k = 1, drag = -1, ptr = null;
    function toCv(e) { var r = cv.getBoundingClientRect(), s = cv.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s, s: s }; }
    function draw() {
      if (!ed.src) return;
      var x = cv.getContext("2d"), d = P.dims(ed.src);
      x.clearRect(0, 0, cv.width, cv.height); x.drawImage(ed.src, 0, 0, cv.width, cv.height);
      var r = cv.getBoundingClientRect(), s = r.width ? cv.width / r.width : 1, P2 = ed.pts.map(function (p) { return { x: p.x * k, y: p.y * k }; });
      x.save(); x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.rect(0, 0, cv.width, cv.height);
      x.moveTo(P2[0].x, P2[0].y); for (var i = 3; i >= 0; i--) x.lineTo(P2[i].x, P2[i].y); x.closePath(); x.fill("evenodd"); x.restore();
      x.lineWidth = 2.5 * s; x.strokeStyle = "#22c55e"; x.beginPath(); x.moveTo(P2[0].x, P2[0].y); for (i = 1; i < 4; i++) x.lineTo(P2[i].x, P2[i].y); x.closePath(); x.stroke();
      for (i = 0; i < 4; i++) { x.beginPath(); x.arc(P2[i].x, P2[i].y, 13 * s, 0, 7); x.fillStyle = i === drag ? "rgba(200,16,46,.85)" : "rgba(34,197,94,.55)"; x.fill(); x.lineWidth = 2 * s; x.strokeStyle = "#fff"; x.stroke(); }
      if (drag > -1) { /* magnifier so the finger does not hide the corner */
        var p = ed.pts[drag], R = 58 * s, cx = P2[drag].x < cv.width / 2 ? cv.width - R - 8 * s : R + 8 * s, cy = R + 8 * s, z = 3;
        x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip(); x.fillStyle = "#fff"; x.fillRect(cx - R, cy - R, 2 * R, 2 * R);
        var span = R / (z * k); x.drawImage(ed.src, p.x - span, p.y - span, 2 * span, 2 * span, cx - R, cy - R, 2 * R, 2 * R); x.restore();
        x.beginPath(); x.arc(cx, cy, R, 0, 7); x.lineWidth = 3 * s; x.strokeStyle = "#0a2a66"; x.stroke();
        x.beginPath(); x.moveTo(cx - 10 * s, cy); x.lineTo(cx + 10 * s, cy); x.moveTo(cx, cy - 10 * s); x.lineTo(cx, cy + 10 * s); x.strokeStyle = "#c8102e"; x.lineWidth = 2 * s; x.stroke();
      }
    }
    ed.set = function (src, pts) {
      ed.src = src; var d = P.dims(src); k = Math.min(1, 1100 / Math.max(d[0], d[1])); cv.width = Math.round(d[0] * k); cv.height = Math.round(d[1] * k);
      if (pts) { ed.pts = pts; ed.auto = false; } else { var a = P.detect(src); ed.auto = !!a; ed.pts = a || P.inset(src); }
      host.hidden = false; requestAnimationFrame(draw); if (onChange) onChange(ed);
    };
    ed.reset = function () { if (ed.src) { ed.pts = P.inset(ed.src); ed.auto = false; draw(); } };
    ed.full = function () { if (ed.src) { ed.pts = P.inset(ed.src, 0); ed.auto = false; draw(); } };
    ed.detect = function () { if (!ed.src) return false; var a = P.detect(ed.src); if (a) { ed.pts = a; ed.auto = true; draw(); } return !!a; };
    ed.rotate = function () {
      if (!ed.src) return; var d = P.dims(ed.src), r = P.rot90(ed.src);
      var pts = ed.pts.map(function (p) { return { x: d[1] - p.y, y: p.x }; });
      ed.set(r, [pts[3], pts[0], pts[1], pts[2]]);
    };
    ed.quad = function () { return ed.pts.map(function (p) { return { x: p.x, y: p.y }; }); };
    ed.draw = draw;
    cv.addEventListener("pointerdown", function (e) {
      if (!ed.src) return; var p = toCv(e), best = -1, bd = 1e9;
      for (var i = 0; i < 4; i++) { var q = ed.pts[i], dd = Math.hypot(q.x * k - p.x, q.y * k - p.y); if (dd < bd) { bd = dd; best = i; } }
      if (bd > 60 * p.s) return; e.preventDefault(); drag = best; ptr = e.pointerId; cv.setPointerCapture(e.pointerId); draw();
    });
    cv.addEventListener("pointermove", function (e) {
      if (drag < 0 || e.pointerId !== ptr) return; e.preventDefault(); var p = toCv(e), d = P.dims(ed.src);
      ed.pts[drag] = { x: Math.max(0, Math.min(d[0], p.x / k)), y: Math.max(0, Math.min(d[1], p.y / k)) }; ed.auto = false; draw();
    });
    ["pointerup", "pointercancel"].forEach(function (n) { cv.addEventListener(n, function () { if (drag > -1) { drag = -1; draw(); if (onChange) onChange(ed); } }); });
    w.addEventListener("resize", draw);
    return ed;
  };

  /* ---------- fixed-ratio crop box over a photo (returns source rect) ---------- */
  P.cropBox = function (host, ratioFn) {
    var wrap = document.createElement("div"); wrap.className = "t-cropwrap"; wrap.hidden = true;
    var cv = document.createElement("canvas"), box = document.createElement("div"), hd = document.createElement("i");
    box.className = "t-cropbox"; box.appendChild(hd); wrap.appendChild(cv); wrap.appendChild(box); host.appendChild(wrap);
    var cb = { img: null }, r = { x: 0, y: 0, w: 0, h: 0 }, drag = null;
    function clamp() { var W = cv.clientWidth, H = cv.clientHeight; r.w = Math.max(20, Math.min(r.w, W)); r.h = Math.max(20, Math.min(r.h, H)); r.x = Math.max(0, Math.min(r.x, W - r.w)); r.y = Math.max(0, Math.min(r.y, H - r.h)); }
    function draw() { clamp(); box.style.left = r.x + "px"; box.style.top = r.y + "px"; box.style.width = r.w + "px"; box.style.height = r.h + "px"; }
    cb.init = function () {
      if (!cb.img) return; var W = cv.clientWidth, H = cv.clientHeight, a = ratioFn();
      var wd = Math.min(W * 0.9, H * 0.9 * a); r = { w: wd, h: wd / a }; r.x = (W - r.w) / 2; r.y = Math.max(0, (H - r.h) * 0.35); draw();
    };
    cb.set = function (img) {
      cb.img = img; var d = P.dims(img), mw = Math.min(d[0], 1400); cv.width = mw; cv.height = Math.round(d[1] * mw / d[0]);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); wrap.hidden = false; requestAnimationFrame(cb.init);
    };
    cb.rect = function () {
      var d = P.dims(cb.img); if (!cv.clientWidth) { /* not laid out: centre crop */
        var a = ratioFn(), sw = d[0], sh = d[1]; if (sw / sh > a) sw = sh * a; else sh = sw / a; return { x: (d[0] - sw) / 2, y: (d[1] - sh) / 2, w: sw, h: sh };
      }
      var s = d[0] / cv.clientWidth; return { x: r.x * s, y: r.y * s, w: Math.min(r.w * s, d[0] - r.x * s), h: Math.min(r.h * s, d[1] - r.y * s) };
    };
    function pt(e) { var b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
    wrap.addEventListener("pointerdown", function (e) {
      if (!cb.img) return; e.preventDefault(); var p = pt(e); wrap.setPointerCapture(e.pointerId);
      drag = { m: e.target === hd ? "rs" : "mv", p: p, r: Object.assign({}, r) };
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!drag) return; var p = pt(e), dx = p.x - drag.p.x, dy = p.y - drag.p.y, a = ratioFn();
      if (drag.m === "mv") { r.x = drag.r.x + dx; r.y = drag.r.y + dy; }
      else { var wd = Math.max(30, drag.r.w + dx); wd = Math.min(wd, cv.clientWidth - drag.r.x, (cv.clientHeight - drag.r.y) * a); r.w = wd; r.h = wd / a; }
      draw();
    });
    ["pointerup", "pointercancel"].forEach(function (n) { wrap.addEventListener(n, function () { drag = null; }); });
    w.addEventListener("resize", function () { if (cb.img) cb.init(); });
    return cb;
  };
  /* crop rect of img into a new canvas of W×H */
  P.cropTo = function (img, rc, W, H) {
    var c = document.createElement("canvas"); c.width = Math.round(W); c.height = Math.round(H); var x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = "high"; x.drawImage(img, rc.x, rc.y, rc.w, rc.h, 0, 0, c.width, c.height); return c;
  };

  /* ---------- enhance (scan look) ---------- */
  P.enhance = function (c, mode, bright, contrast) {
    bright = +bright || 0; contrast = +contrast || 0;
    if (mode === "none" && !bright && !contrast) return c;
    var W = c.width, H = c.height, x = c.getContext("2d"), id = x.getImageData(0, 0, W, H), p = id.data, n = W * H, i;
    var bg = null;
    if (mode === "color" || mode === "scan" || mode === "bw") { /* paper background estimate: heavy blur via down/up-scaling */
      var sw = Math.max(4, Math.round(W / 16)), sh = Math.max(4, Math.round(H / 16)), s = document.createElement("canvas"); s.width = sw; s.height = sh;
      var sx = s.getContext("2d"); sx.imageSmoothingQuality = "high"; sx.drawImage(c, 0, 0, sw, sh);
      /* dilate (max) so dark text does not darken the background estimate */
      var sd = sx.getImageData(0, 0, sw, sh), sp = sd.data, cp = new Uint8ClampedArray(sp);
      for (var yy = 0; yy < sh; yy++) for (var xx = 0; xx < sw; xx++) for (var ch = 0; ch < 3; ch++) {
        var m = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var X = Math.min(sw - 1, Math.max(0, xx + dx)), Y = Math.min(sh - 1, Math.max(0, yy + dy)); m = Math.max(m, cp[(Y * sw + X) * 4 + ch]); }
        sp[(yy * sw + xx) * 4 + ch] = m;
      }
      sx.putImageData(sd, 0, 0);
      var b = document.createElement("canvas"); b.width = W; b.height = H; var bx = b.getContext("2d"); bx.imageSmoothingQuality = "high"; bx.drawImage(s, 0, 0, W, H);
      bg = bx.getImageData(0, 0, W, H).data;
    }
    var cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (i = 0; i < n; i++) {
      var o = i * 4, r = p[o], g = p[o + 1], bl = p[o + 2];
      if (bg) { /* whiten paper only where the background estimate looks like paper (bright); leaves photos/large dark areas alone */
        var bgl = 0.299 * bg[o] + 0.587 * bg[o + 1] + 0.114 * bg[o + 2], kf = Math.max(0, Math.min(1, (bgl - 110) / 70));
        if (kf > 0) { r += (Math.min(255, r / Math.max(30, bg[o]) * 255) - r) * kf; g += (Math.min(255, g / Math.max(30, bg[o + 1]) * 255) - g) * kf; bl += (Math.min(255, bl / Math.max(30, bg[o + 2]) * 255) - bl) * kf; } }
      if (mode === "gray" || mode === "scan" || mode === "bw") { var gy = 0.299 * r + 0.587 * g + 0.114 * bl; r = g = bl = gy; }
      if (mode === "scan") { r = g = bl = r < 235 ? Math.pow(r / 235, 1.6) * 235 : 255; }
      if (mode === "color") { /* deepen ink a little */ r = r < 250 ? Math.pow(r / 250, 1.25) * 250 : 255; g = g < 250 ? Math.pow(g / 250, 1.25) * 250 : 255; bl = bl < 250 ? Math.pow(bl / 250, 1.25) * 250 : 255; }
      r = cf * (r - 128) + 128 + bright; g = cf * (g - 128) + 128 + bright; bl = cf * (bl - 128) + 128 + bright;
      if (mode === "bw") { var v = r < 170 ? 0 : 255; r = g = bl = v; }
      p[o] = r; p[o + 1] = g; p[o + 2] = bl;
    }
    x.putImageData(id, 0, 0); return c;
  };

  /* ---------- PDF / print / download ---------- */
  P.pdf = async function (pages, title) {
    if (!w.PDFLib) throw new Error("PDF लाइब्रेरी लोड नहीं हुई। इंटरनेट चेक करके पेज दोबारा खोलें।");
    var d = await w.PDFLib.PDFDocument.create();
    d.setTitle(title || "GG Group print"); d.setCreator("gggroup.info free tools"); d.setProducer("gggroup.info");
    for (var i = 0; i < pages.length; i++) {
      var pg = pages[i], b = await w.GG.toBlob(pg.canvas, "image/jpeg", pg.q || 0.92), em = await d.embedJpg(await b.arrayBuffer());
      var W = pg.wmm * 72 / 25.4, H = pg.hmm * 72 / 25.4, p = d.addPage([W, H]); p.drawImage(em, { x: 0, y: 0, width: W, height: H });
    }
    return new Blob([await d.save()], { type: "application/pdf" });
  };
  P.jpg = async function (canvas, dpi, q) { var b = await w.GG.toBlob(canvas, "image/jpeg", q || 0.92); return dpi ? w.GG.jpegDpi(b, dpi) : b; };
  P.png = async function (canvas, dpi) { var b = await w.GG.toBlob(canvas, "image/png"); return dpi ? w.GG.pngDpi(b, dpi) : b; };
  /* print a list of page images at exact paper size.
     Printed from the page itself (not a hidden iframe): mobile Chrome / Safari ignore iframe.print()
     and print the whole web page instead, which showed only the small preview. */
  P.print = function (blobs, wmm, hmm) {
    var old = document.getElementById("gp-print"), oldCss = document.getElementById("gp-print-css");
    if (old) { Array.prototype.forEach.call(old.querySelectorAll("img"), function (im) { URL.revokeObjectURL(im.src); }); old.remove(); }
    if (oldCss) oldCss.remove();
    var st = document.createElement("style"); st.id = "gp-print-css";
    st.textContent = "#gp-print{display:none}@media print{@page{size:" + wmm + "mm " + hmm + "mm;margin:0}" +
      "html,body{margin:0!important;padding:0!important;background:#fff!important;width:auto!important;height:auto!important;overflow:visible!important}" +
      "body>*:not(#gp-print),ins.adsbygoogle,iframe{display:none!important}" +
      "#gp-print{display:block!important;position:static!important}" +
      "#gp-print img{display:block;width:" + wmm + "mm;height:" + hmm + "mm;margin:0;page-break-after:always;break-after:page;page-break-inside:avoid}" +
      "#gp-print img:last-child{page-break-after:auto;break-after:auto}}";
    var box = document.createElement("div"); box.id = "gp-print"; box.setAttribute("aria-hidden", "true");
    var left = blobs.length;
    function go() { setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 80); }
    blobs.forEach(function (bl) {
      var im = new Image(); im.alt = "";
      im.onload = im.onerror = function () { if (--left === 0) go(); };
      im.src = URL.createObjectURL(bl); box.appendChild(im);
    });
    document.head.appendChild(st); document.body.appendChild(box);
    if (!blobs.length) go();
  };
  /* full-size result image (long-press on mobile saves the whole sheet, not a thumbnail) */
  P.previewImg = function (blob, maxW, alt) {
    var d = document.createElement("div"); d.className = "t-preview t-pv";
    var im = new Image(); im.src = URL.createObjectURL(blob); im.alt = alt || "पूरी शीट";
    im.style.cssText = "display:inline-block;width:auto;height:auto;max-width:min(100%," + (maxW || 460) + "px);max-height:560px;background:#fff;box-shadow:0 2px 10px rgba(10,42,102,.12)";
    d.appendChild(im); return d;
  };
  /* secondary download (e.g. one single photo for online forms), kept apart from the sheet buttons */
  P.extra = function (resId, note, blob, name, label) {
    var p = document.createElement("p"); p.className = "t-note"; p.style.marginTop = "14px"; p.textContent = note;
    var a = document.createElement("div"); a.className = "t-actions";
    var b = w.GG.dlButton(blob, name, label); b.className = "t-btn t-btn--ghost t-btn--sm"; a.appendChild(b);
    var r = w.GG.$(resId); r.appendChild(p); r.appendChild(a); return a;
  };
  P.actions = function (resId, items) {
    var a = document.createElement("div"); a.className = "t-actions";
    items.forEach(function (it) {
      if (!it) return;
      if (it.blob) a.appendChild(w.GG.dlButton(it.blob, it.name, it.label));
      else { var b = document.createElement("button"); b.type = "button"; b.className = "t-btn"; b.textContent = it.label; b.onclick = it.onclick; a.appendChild(b); }
    });
    w.GG.$(resId).appendChild(a); return a;
  };
  P.preview = function (canvas, maxW) {
    var k = Math.min(1, (maxW || 900) / canvas.width), c = document.createElement("canvas"); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
    var x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, c.width, c.height);
    var d = document.createElement("div"); d.className = "t-preview t-pv"; d.appendChild(c); return d;
  };
  P.today = function () { var d = new Date(); return String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear(); };

  /* grid of identical tiles (w×h mm) on paper; returns {canvas, n, fit} */
  P.tileSheet = function (tile, tw, th, pw, ph, count, gap, margin, dpi, cut, noTurn) {
    var M = dpi / 25.4;
    function fitOn(a, b) { return Math.max(0, Math.floor((a - 2 * margin + gap) / (tw + gap))) * Math.max(0, Math.floor((b - 2 * margin + gap) / (th + gap))); }
    if (!noTurn && pw !== ph && fitOn(ph, pw) > fitOn(pw, ph) && (count === "max" || +count > fitOn(pw, ph))) {
      /* more tiles fit with the paper turned sideways: lay out landscape, then turn the sheet back */
      var r = P.tileSheet(tile, tw, th, ph, pw, count, gap, margin, dpi, cut, true);
      return { canvas: P.rot90(r.canvas), n: r.n, fit: r.fit };
    }
    var cols = Math.max(0, Math.floor((pw - 2 * margin + gap) / (tw + gap))), rows = Math.max(0, Math.floor((ph - 2 * margin + gap) / (th + gap))), fit = cols * rows;
    var n = Math.min(count === "max" ? fit : +count, fit), c = P.sheet(pw, ph, dpi), x = c.getContext("2d");
    var usedCols = Math.min(cols, n), gw = usedCols * tw + (usedCols - 1) * gap, ox = (pw - gw) / 2, oy = margin;
    for (var i = 0; i < n; i++) {
      var cx = ox + (i % cols) * (tw + gap), cy = oy + Math.floor(i / cols) * (th + gap);
      x.drawImage(tile, cx * M, cy * M, tw * M, th * M);
      if (cut) { x.save(); x.strokeStyle = "#9aa3b5"; x.lineWidth = Math.max(1, dpi / 300); x.setLineDash([8 * dpi / 300, 6 * dpi / 300]); x.strokeRect(cx * M, cy * M, tw * M, th * M); x.restore(); }
    }
    return { canvas: c, n: n, fit: fit };
  };

  /* ---------- canvas text ---------- */
  P.wrap = function (x, text, maxW) {
    var out = [];
    String(text || "").split(/\n/).forEach(function (para) {
      var words = para.split(/ +/), line = "";
      if (!para.trim()) { out.push(""); return; }
      words.forEach(function (wd) {
        var test = line ? line + " " + wd : wd;
        if (x.measureText(test).width <= maxW || !line) {
          if (!line && x.measureText(wd).width > maxW) { /* very long word: break by characters */
            var part = ""; Array.from(wd).forEach(function (ch) { if (x.measureText(part + ch).width > maxW && part) { out.push(part); part = ch; } else part += ch; }); line = part;
          } else line = test;
        } else { out.push(line); line = wd; }
      });
      out.push(line);
    });
    return out;
  };
  /* draw wrapped text; returns y after the block. o: {size, lh, wt, color, align} */
  P.text = function (x, str, X, Y, maxW, o) {
    o = o || {}; var size = o.size || 16, lh = o.lh || size * 1.45;
    x.font = P.font(size, o.wt); x.fillStyle = o.color || "#111"; x.textBaseline = "alphabetic"; x.textAlign = o.align || "left";
    var lines = P.wrap(x, str, maxW), ax = o.align === "center" ? X + maxW / 2 : o.align === "right" ? X + maxW : X;
    lines.forEach(function (ln, i) { x.fillText(ln, ax, Y + size + i * lh); });
    return Y + (lines.length ? (lines.length - 1) * lh + size * 1.35 : 0);
  };
  P.fitText = function (x, str, maxW, start, wt, min) {
    var s = start; do { x.font = P.font(s, wt); if (x.measureText(str).width <= maxW) break; s -= 1; } while (s > (min || 8)); return s;
  };
  P.round = function (x, X, Y, W, H, r) {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
  };
  P.readImg = async function (f) {
    if (!w.GG.isImage(f)) throw new Error("“" + f.name + "” फोटो नहीं है। JPG, PNG या WEBP चुनें।");
    return w.GG.loadImage(f);
  };
  w.GP = P;
})(window);
