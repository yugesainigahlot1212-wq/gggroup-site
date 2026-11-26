/* GG Group calculators — pure formulas (tested in Node). Works in browser (window.GGC) and Node (module.exports). */
(function (root) {
  "use strict";
  var C = {};
  /* dates are handled as UTC calendar days to avoid timezone shifts */
  C.parseDate = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 ? d : null;
  };
  C.iso = function (d) { return d.toISOString().slice(0, 10); };
  C.dim = function (y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }; /* m: 0-11 */
  /* completed years / months / days from a to b (a <= b) */
  C.ymd = function (a, b) {
    var tm = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    var anchor = C.addToDate(a, tm, "m");
    if (anchor > b) { tm -= 1; anchor = C.addToDate(a, tm, "m"); }
    return { y: Math.floor(tm / 12), m: tm % 12, d: C.days(anchor, b) };
  };
  C.days = function (a, b) { return Math.round((b - a) / 86400000); };
  C.age = function (dob, on) {
    if (on < dob) return null;
    var r = C.ymd(dob, on);
    r.totalDays = C.days(dob, on);
    r.totalMonths = r.y * 12 + r.m;
    /* next birthday (29 Feb → 1 Mar in non-leap years) */
    var ny = on.getUTCFullYear(), nb;
    for (var i = 0; i < 3; i++) {
      var mm = dob.getUTCMonth(), dd = dob.getUTCDate();
      if (mm === 1 && dd === 29 && C.dim(ny + i, 1) === 28) { mm = 2; dd = 1; }
      nb = new Date(Date.UTC(ny + i, mm, dd));
      if (nb > on) break;
    }
    r.nextBdayDays = C.days(on, nb);
    return r;
  };
  C.addToDate = function (d, n, unit) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    if (unit === "d") return new Date(Date.UTC(y, m, day + n));
    var tm = unit === "m" ? m + n : m, ty = unit === "y" ? y + n : y;
    var ny = ty + Math.floor(tm / 12), nm = ((tm % 12) + 12) % 12;
    return new Date(Date.UTC(ny, nm, Math.min(day, C.dim(ny, nm))));
  };
  C.emi = function (P, annualRate, months) {
    var r = annualRate / 12 / 100;
    if (r === 0) return P / months;
    var f = Math.pow(1 + r, months);
    return P * r * f / (f - 1);
  };
  /* yearly amortisation rows: [year, principalPaid, interestPaid, balance] */
  C.amort = function (P, annualRate, months) {
    var e = C.emi(P, annualRate, months), r = annualRate / 12 / 100, bal = P, rows = [], yp = 0, yi = 0;
    for (var k = 1; k <= months; k++) {
      var it = bal * r, pr = e - it; bal -= pr; yp += pr; yi += it;
      if (k % 12 === 0 || k === months) { rows.push([Math.ceil(k / 12), yp, yi, Math.max(0, bal)]); yp = 0; yi = 0; }
    }
    return rows;
  };
  C.simple = function (P, R, T) { var i = P * R * T / 100; return { interest: i, amount: P + i }; };
  C.compound = function (P, R, T, n) { var a = P * Math.pow(1 + R / 100 / n, n * T); return { interest: a - P, amount: a }; };
  /* RD: monthly instalment R, rate %, months; quarterly compounding (common Indian bank method) */
  C.rd = function (inst, rate, months) {
    var s = 0;
    for (var k = 1; k <= months; k++) s += inst * Math.pow(1 + rate / 400, k / 3);
    return { maturity: s, deposited: inst * months, interest: s - inst * months };
  };
  /* SIP: monthly amount, expected annual return %, years. Investment at start of each month. */
  C.sip = function (amt, rate, years) {
    var n = Math.round(years * 12), i = rate / 12 / 100, fv = i === 0 ? amt * n : amt * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    return { value: fv, invested: amt * n, gain: fv - amt * n };
  };
  C.lumpsum = function (P, rate, years) { var v = P * Math.pow(1 + rate / 100, years); return { value: v, invested: P, gain: v - P }; };
  C.gst = function (amt, rate, inclusive) {
    var base, tax;
    if (inclusive) { base = amt * 100 / (100 + rate); tax = amt - base; } else { base = amt; tax = amt * rate / 100; }
    return { base: base, tax: tax, total: base + tax, half: tax / 2 };
  };
  C.bmi = function (kg, cm) { var m = cm / 100; return kg / (m * m); };
  C.units = {
    length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, yard: 0.9144, mile: 1609.344 },
    area: { sqcm: 0.0001, sqin: 0.00064516, sqft: 0.09290304, sqyd: 0.83612736, sqm: 1, acre: 4046.8564224, hectare: 10000, sqkm: 1000000 },
    weight: { mg: 0.000001, g: 0.001, kg: 1, quintal: 100, tonne: 1000, oz: 0.028349523125, lb: 0.45359237 },
    volume: { ml: 0.001, l: 1, m3: 1000, gal: 3.785411784, cup: 0.24 }
  };
  C.convert = function (cat, v, from, to) {
    if (cat === "temp") {
      var c = from === "c" ? v : from === "f" ? (v - 32) * 5 / 9 : v - 273.15;
      return to === "c" ? c : to === "f" ? c * 9 / 5 + 32 : c + 273.15;
    }
    var u = C.units[cat]; return v * u[from] / u[to];
  };
  if (typeof module !== "undefined" && module.exports) module.exports = C; else root.GGC = C;
})(this);
