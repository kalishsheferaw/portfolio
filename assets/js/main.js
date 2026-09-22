(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SITE = window.SITE || {};
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- optional links switched on from config.js ---- */
  function showCfg(k, v) {
    $$('[data-cfg="' + k + '"]').forEach(function (el) {
      el.href = k === "email" ? "mailto:" + v : v;
      el.hidden = false;
    });
  }
  $$("[data-cfg]").forEach(function (el) {
    var k = el.getAttribute("data-cfg"), v = SITE[k];
    if (!v || k === "cv" || k === "email") return;
    el.href = v; el.hidden = false;
  });
  if (SITE.email) {
    showCfg("email", SITE.email);
    $$('[data-cfg-text="email"]').forEach(function (el) { el.hidden = false; });
    $$("[data-cfg-out]").forEach(function (el) { el.textContent = SITE.email; });
    $$("[data-copy-email]").forEach(function (b) {
      b.hidden = false;
      b.addEventListener("click", function () {
        var out = $("[data-copy-out]");
        function done(ok) { if (out) out.textContent = ok ? "Email address copied." : "Copy failed. Select the address and copy it."; }
        if (navigator.clipboard) navigator.clipboard.writeText(SITE.email).then(function () { done(true); }, function () { done(false); });
        else done(false);
      });
    });
  }
  /* CV button only appears if the PDF is really on the server (avoids a dead download link) */
  if (SITE.cv) {
    var cvOn = function () { showCfg("cv", SITE.cv); };
    if (location.protocol === "file:") cvOn();
    else if (window.fetch) fetch(SITE.cv, { method: "HEAD" }).then(function (r) { if (r.ok) cvOn(); }).catch(function () {});
  }
  if (SITE.formEndpoint) { $$("[data-form-wrap]").forEach(function (el) { el.hidden = false; }); }

  /* ---- theme toggle ---- */
  var themeBtn = $(".theme-btn");
  function isDark() {
    return root.getAttribute("data-theme")
      ? root.getAttribute("data-theme") === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  if (themeBtn) {
    themeBtn.setAttribute("aria-pressed", isDark());
    themeBtn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      themeBtn.setAttribute("aria-pressed", next === "dark");
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ---- report-page tabs (Power BI style) ---- */
  $$("[data-tabs]").forEach(function (group) {
    var tabs = $$('[role="tab"]', group);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        t.setAttribute("aria-selected", j === i);
        t.tabIndex = j === i ? 0 : -1;
        panels[j].hidden = j !== i;
        if (j !== i) $$("video", panels[j]).forEach(function (v) { v.pause(); });
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        var n = tabs.length;
        if (e.key === "ArrowRight") { e.preventDefault(); select((i + 1) % n, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); select((i - 1 + n) % n, true); }
        if (e.key === "Home") { e.preventDefault(); select(0, true); }
        if (e.key === "End") { e.preventDefault(); select(n - 1, true); }
      });
    });
  });

  /* ---- ambient dashboard video: plays only while visible, always pausable ---- */
  $$("[data-ambient]").forEach(function (wrap) {
    var v = $("video", wrap), btn = $("[data-toggle]", wrap), bar = $(".report-bar", wrap);
    if (!v || !btn) return;
    var userPaused = reduced;
    function label() {
      var paused = v.paused;
      btn.textContent = paused ? "Play" : "Pause";
      btn.setAttribute("aria-label", paused ? "Play dashboard demo" : "Pause dashboard demo");
      if (bar) bar.setAttribute("data-paused", paused);
    }
    btn.addEventListener("click", function () {
      if (v.paused) { userPaused = false; v.play().catch(function () {}); } else { userPaused = true; v.pause(); }
      label();
    });
    v.addEventListener("play", label); v.addEventListener("pause", label);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !userPaused) v.play().catch(function () {});
          else if (!e.isIntersecting) v.pause();
        });
      }, { threshold: 0.25 }).observe(v);
    }
    label();
  });

  /* ---- lightbox for screenshots and certificates ---- */
  var box = $("#lightbox");
  if (box) {
    var boxImg = $("img", box), boxCap = $("figcaption", box);
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-zoom]");
      if (!t) return;
      var img = t.tagName === "IMG" ? t : $("img", t);
      boxImg.src = t.getAttribute("data-zoom") || img.currentSrc || img.src;
      boxImg.alt = img.alt || "";
      boxCap.textContent = t.getAttribute("data-caption") || img.alt || "";
      if (box.showModal) box.showModal(); else box.setAttribute("open", "");
    });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
    $("button", box).addEventListener("click", function () { box.close(); });
  }

  /* ---- count up the dashboard's headline numbers once ---- */
  $$("[data-count]").forEach(function (el) {
    var final = el.textContent.trim();
    var m = final.match(/^([\d.]+)(.*)$/);
    if (!m || reduced || !("IntersectionObserver" in window)) return;
    var target = parseFloat(m[1]), suffix = m[2], dec = (m[1].split(".")[1] || "").length;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = null, dur = 900;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dec) + suffix;
        if (p < 1) requestAnimationFrame(step); else el.textContent = final;
      }
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ---- scroll spy for the nav and the case-study contents list ---- */
  function spy(links) {
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1), s = id && document.getElementById(id);
      if (s) map[id] = a;
    });
    var ids = Object.keys(map);
    if (!ids.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.removeAttribute("aria-current"); });
          map[e.target.id].setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    ids.forEach(function (id) { io.observe(document.getElementById(id)); });
  }
  spy($$('.nav a[href^="#"]'));
  spy($$('.toc a[href^="#"]'));

  /* ---- copy link buttons ---- */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var out = $("[data-copy-out]");
      function done(ok) { if (out) out.textContent = ok ? "Link copied." : "Copy failed. Select the link and copy it."; }
      if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute("data-copy")).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });

  /* ---- contact form (needs formEndpoint in config.js) ---- */
  var form = $("form[data-form]");
  if (form && SITE.formEndpoint) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = $(".form-status", form);
      if ($(".hp input", form).value) return;
      status.textContent = "Sending...";
      fetch(SITE.formEndpoint, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.value, email: form.email.value, message: form.message.value })
      }).then(function (r) {
        if (r.ok) { status.textContent = "Message sent. Thank you."; form.reset(); }
        else status.textContent = "The message did not send. Please use LinkedIn instead.";
      }).catch(function () { status.textContent = "The message did not send. Please use LinkedIn instead."; });
    });
  }

  /* ---- SSIS pipeline explainer ---- */
  var info = $("#pipe-info");
  $$(".pipe .node").forEach(function (n) {
    function show() {
      $$(".pipe .node").forEach(function (x) { x.classList.remove("on"); });
      n.classList.add("on");
      info.innerHTML = "<b></b> <span></span>";
      $("b", info).textContent = n.getAttribute("data-title") + ".";
      $("span", info).textContent = n.getAttribute("data-info");
    }
    n.addEventListener("click", show);
    n.addEventListener("focus", show);
    n.addEventListener("mouseenter", show);
    n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(); } });
  });
})();
