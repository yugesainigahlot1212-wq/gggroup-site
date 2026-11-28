/* gggroup.info — hover / long-press preview cards for tool & service tiles.
   Markup: any element with data-pv-t (title). Optional: data-pv-d (one line), data-pv-n (count line),
   data-pv-x (examples, "|" separated), data-pv-i (icon). Desktop: hover or keyboard focus.
   Touch: long-press (~0.45s) or the small ⓘ badge; a normal tap still opens the link. */
(function () {
  "use strict";
  var card, cur = null, showT = null, hideT = null, lpT = null, lpFired = false, sx = 0, sy = 0;
  var coarse = window.matchMedia && window.matchMedia("(hover: none)").matches;
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function build() {
    card = document.createElement("div");
    card.id = "gg-pv"; card.className = "gg-pv"; card.setAttribute("role", "tooltip"); card.hidden = true;
    document.body.appendChild(card);
    card.addEventListener("click", function (e) { if (e.target.closest(".gg-pv__x")) { e.preventDefault(); hide(true); } });
  }
  function fill(el) {
    var t = el.getAttribute("data-pv-t"), d = el.getAttribute("data-pv-d"), n = el.getAttribute("data-pv-n"),
        x = el.getAttribute("data-pv-x"), ic = el.getAttribute("data-pv-i"), h = "";
    h += '<p class="gg-pv__h">' + (ic ? '<span aria-hidden="true">' + esc(ic) + "</span> " : "") + "<b>" + esc(t) + "</b></p>";
    if (n) h += '<p class="gg-pv__n">' + esc(n) + "</p>";
    if (d) h += '<p class="gg-pv__d">' + esc(d) + "</p>";
    if (x) { var a = x.split("|").filter(Boolean); if (a.length) h += '<ul class="gg-pv__x1">' + a.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>"; }
    var href = el.getAttribute("href");
    if (coarse) h += '<p class="gg-pv__a">' + (href ? '<a href="' + esc(href) + '">खोलें →</a>' : "") + '<button type="button" class="gg-pv__x">बंद करें ✕</button></p>';
    card.innerHTML = h;
  }
  function place(el) {
    var r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    card.style.left = "0px"; card.style.top = "0px"; card.style.maxWidth = Math.min(320, vw - 16) + "px";
    var cw = card.offsetWidth, ch = card.offsetHeight, gap = 8;
    var left = Math.max(8, Math.min(r.left + r.width / 2 - cw / 2, vw - cw - 8));
    var top = r.bottom + gap;
    if (top + ch > vh - 8) top = r.top - ch - gap;
    if (top < 8) top = Math.max(8, Math.min(vh - ch - 8, r.bottom + gap));
    card.style.left = Math.round(left) + "px"; card.style.top = Math.round(top) + "px";
  }
  function show(el) {
    clearTimeout(hideT); if (!card) build();
    if (cur && cur !== el) cur.removeAttribute("aria-describedby");
    cur = el; fill(el); card.hidden = false; card.classList.toggle("gg-pv--touch", coarse); place(el);
    el.setAttribute("aria-describedby", "gg-pv");
    requestAnimationFrame(function () { card.classList.add("is-on"); });
  }
  function hide(now) {
    clearTimeout(showT);
    var go = function () { if (!card) return; card.classList.remove("is-on"); card.hidden = true; if (cur) cur.removeAttribute("aria-describedby"); cur = null; };
    if (now) go(); else hideT = setTimeout(go, 80);
  }
  function tile(e) { return e.target && e.target.closest ? e.target.closest("[data-pv-t]") : null; }
  // desktop hover
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return; var el = tile(e); if (!el) return;
    if (el === cur) { clearTimeout(hideT); return; }
    clearTimeout(showT); showT = setTimeout(function () { show(el); }, 140);
  });
  document.addEventListener("pointerout", function (e) {
    if (e.pointerType !== "mouse") return; var el = tile(e); if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    clearTimeout(showT); if (el === cur) hide();
  });
  // keyboard focus
  document.addEventListener("focusin", function (e) {
    var el = tile(e); if (!el) return;
    var fv = true; try { fv = el.matches(":focus-visible"); } catch (x) {}
    if (fv) show(el);
  });
  document.addEventListener("focusout", function (e) { var el = tile(e); if (el && el === cur && !coarse) hide(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur) hide(true); });
  // touch: long-press
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    if (e.target.closest && e.target.closest(".gg-pv")) return;
    var el = tile(e); lpFired = false; clearTimeout(lpT);
    if (!el) { if (cur) hide(true); return; }
    if (e.target.closest(".gg-pv-i")) return;
    sx = e.clientX; sy = e.clientY;
    lpT = setTimeout(function () { lpFired = true; show(el); if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {} }, 450);
  }, { passive: true });
  document.addEventListener("pointermove", function (e) { if (lpT && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) clearTimeout(lpT); }, { passive: true });
  document.addEventListener("pointerup", function () { clearTimeout(lpT); }, { passive: true });
  document.addEventListener("pointercancel", function () { clearTimeout(lpT); }, { passive: true });
  document.addEventListener("contextmenu", function (e) { if (tile(e) && (lpFired || cur)) e.preventDefault(); });
  // click: ⓘ badge opens preview; the click that ends a long-press is swallowed
  document.addEventListener("click", function (e) {
    var i = e.target.closest && e.target.closest(".gg-pv-i");
    if (i) { e.preventDefault(); e.stopPropagation(); var el = i.closest("[data-pv-t]"); if (el) { if (cur === el) hide(true); else show(el); } return; }
    if (lpFired && tile(e)) { e.preventDefault(); e.stopPropagation(); lpFired = false; return; }
  }, true);
  window.addEventListener("scroll", function () { if (cur && !coarse) hide(true); else if (cur) place(cur); }, { passive: true });
  window.addEventListener("resize", function () { if (cur) hide(true); });
  // ⓘ badges for touch screens (CSS shows them only on hover:none devices)
  function badges() {
    document.querySelectorAll("[data-pv-t]:not([data-pv-nob])").forEach(function (el) {
      if (el.querySelector(".gg-pv-i")) return;
      var s = document.createElement("span"); s.className = "gg-pv-i"; s.setAttribute("aria-hidden", "true"); s.textContent = "i";
      el.classList.add("gg-pv-host"); el.appendChild(s);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", badges); else badges();
})();
