/* SCUTTLE X home page. No libraries.
   - The hero: a silent loop cut from the launch trailer under the wordmark, loaded once the page is up (not with
     reduced motion or Save-Data), paused while it's off screen or the trailer plays.
   - The trailer: one film; its video loads only when someone asks for it ("Watch the trailer" or its PLAY).
   - The board: a match plays itself out on the five zones (taken, held, contested, drained, halftime, 300) while
     it's on screen, the steps beside it lit in turn.
   - The four heroes: blocks in their colours; the one picked opens out and colours the page (--hero, kept in
     localStorage "sx-hero", read by every page's head script); SPIDER DASH folds it into its spider and back. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function onScreen(el, enter, leave, margin) {
    if (!("IntersectionObserver" in window)) { enter(); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) enter(); else if (leave) leave(); });
    }, { rootMargin: margin || "0px" }).observe(el);
  }

  // --- the hero's loop ---------------------------------------------------------------------------------
  var loop = document.querySelector("[data-loop]");
  var loopSeen = true, trailerOn = false;
  function loopPlay() {
    if (!loop || !loop.src) return;
    if (loopSeen && !trailerOn) { var p = loop.play(); if (p && p.catch) p.catch(function () {}); } else loop.pause();
  }
  if (loop && !reduce && !saveData) {
    var startLoop = function () { loop.src = loop.getAttribute("data-src"); loopPlay(); };
    if (document.readyState === "complete") setTimeout(startLoop, 300); else addEventListener("load", function () { setTimeout(startLoop, 300); });
    onScreen(loop, function () { loopSeen = true; loopPlay(); }, function () { loopSeen = false; loopPlay(); });
  }

  // --- the trailer --------------------------------------------------------------------------------------
  var player = document.querySelector("[data-trailer]");
  function playTrailer() {
    if (!player) return;
    var v = player.querySelector("video");
    if (!v) {
      v = document.createElement("video");
      v.src = player.getAttribute("data-src");
      v.controls = true;
      v.playsInline = true;
      v.preload = "auto";
      var img = player.querySelector("img");
      v.poster = img.currentSrc || img.src;
      v.addEventListener("play", function () { trailerOn = true; loopPlay(); });
      v.addEventListener("pause", function () { trailerOn = false; loopPlay(); });
      v.addEventListener("ended", function () { trailerOn = false; loopPlay(); });
      player.classList.add("playing");
      player.replaceChildren(v);
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    v.focus({ preventScroll: true });
  }
  if (player) {
    player.querySelector(".play").addEventListener("click", playTrailer);
    Array.prototype.forEach.call(document.querySelectorAll("[data-play]"), function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        player.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        playTrailer();
      });
    });
  }

  // --- the dash clip and the speeds: only while they're on screen ------------------------------------------
  var clip = document.querySelector("[data-clip]");
  if (clip) {
    onScreen(clip, function () {
      if (reduce || saveData) return;
      if (!clip.src) clip.src = clip.getAttribute("data-src");
      var p = clip.play(); if (p && p.catch) p.catch(function () {});
    }, function () { clip.pause(); }, "100px");
  }
  var race = document.querySelector("[data-race]");
  if (race) onScreen(race, function () { race.classList.add("live"); });

  // --- the board: a scripted match on the five zones, at the game's rules but sped up -----------------------
  var board = document.querySelector("[data-board]");
  if (board) {
    var LOOP = 16.5, HALF = 8.6, END = 13.6;
    // each zone: its bar's moves [from t, to t, from, to, toward], who holds it from when, contested stretches
    var Z = {
      A: { bar: [[0.5, 1.5, 0, 1, "us"], [10.0, 10.8, 0, 1, "us"]], own: [[1.5, "us"], [HALF, null], [10.8, "us"]] },
      B: { bar: [[2.0, 3.0, 0, 1, "us"], [10.6, 11.4, 0, 1, "us"]], own: [[3.0, "us"], [HALF, null], [11.4, "us"]] },
      C: { bar: [[3.6, 4.6, 0, 0.45, "us"], [6.4, 7.0, 0.45, 1, "us"], [9.8, 10.4, 0, 1, "us"]], own: [[7.0, "us"], [HALF, null], [10.4, "us"]], contest: [[4.6, 6.4]] },
      D: { bar: [[2.2, 3.4, 0, 1, "them"], [7.4, 8.4, 1, 0, "them"], [11.0, 11.8, 0, 1, "us"]], own: [[3.4, "them"], [8.4, null], [11.8, "us"]] },
      E: { bar: [[0.7, 1.9, 0, 1, "them"], [10.2, 11.0, 0, 1, "them"]], own: [[1.9, "them"], [HALF, null], [11.0, "them"]] }
    };
    var SCORE = [[[0, 0], [1.5, 0], [HALF, 150], [9.8, 150], [END, 300]], [[0, 0], [1.9, 0], [HALF, 128], [9.8, 128], [END, 251]]];
    var NOTES = [[0, "neutral"], [1.5, "taken:A"], [1.9, "enemy:E"], [3.0, "taken:B"], [3.4, "enemy:D"], [4.6, "contest:C"], [7.0, "taken:C"],
                 [8.4, "drained:D"], [HALF, "half"], [9.8, "second"], [10.4, "taken:C"], [11.0, "enemy:E"], [11.8, "taken:D"], [END, "win"]];
    var STEPS = [[0, 0], [3.0, 1], [4.6, 2], [HALF, 3], [11.0, 4]];
    var words = JSON.parse(board.getAttribute("data-words") || "{}");
    var cells = {}, scores = board.querySelectorAll("[data-score]"), note = board.querySelector("[data-note]");
    var steps = document.querySelectorAll("[data-steps] li");
    Object.keys(Z).forEach(function (k) { cells[k] = board.querySelector('[data-zone="' + k + '"]'); });
    var shown = {};
    function set(key, val, f) { if (shown[key] !== val) { shown[key] = val; f(val); } }
    function lastAt(list, t) { var v = null; for (var i = 0; i < list.length; i++) if (list[i][0] <= t) v = list[i]; return v; }
    function curve(pts, t) {
      for (var i = 1; i < pts.length; i++) if (t < pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); }
      return pts[pts.length - 1][1];
    }
    function text(code) {
      var parts = code.split(":"), w = words[parts[0]] || parts[0];
      return w.replace("{z}", parts[1] || "");
    }
    function draw(t) {
      Object.keys(Z).forEach(function (k) {
        var z = Z[k], p = 0, side = "us";
        var seg = lastAt(z.bar, t);
        if (seg && !(t >= HALF && seg[1] <= HALF)) {
          var u = Math.min(1, Math.max(0, (t - seg[0]) / (seg[1] - seg[0])));
          p = seg[2] + (seg[3] - seg[2]) * u;
          side = seg[4];
        }
        var own = lastAt(z.own, t), owner = own ? own[1] : null;
        var contest = (z.contest || []).some(function (c) { return t >= c[0] && t < c[1]; });
        var cell = cells[k];
        set(k + "o", owner || "", function (v) { cell.classList.toggle("us", v === "us"); cell.classList.toggle("them", v === "them"); });
        set(k + "c", contest, function (v) { cell.classList.toggle("contest", v); });
        set(k + "p", Math.round(p * 100) / 100, function (v) { cell.style.setProperty("--zp", owner ? 0 : v); });
        set(k + "s", side, function (v) { cell.style.setProperty("--zc", v === "us" ? "var(--mint)" : "var(--magenta)"); });
      });
      for (var s = 0; s < 2; s++) {
        var v = Math.floor(curve(SCORE[s], Math.floor(t / 0.25) * 0.25));
        set("s" + s, v, function (val) { scores[this].textContent = val; }.bind(s));
      }
      var n = lastAt(NOTES, t)[1];
      set("note", n, function (v) { note.textContent = text(v); note.classList.toggle("hot", v === "half" || v.indexOf("contest") === 0); note.classList.toggle("win", v === "win"); });
      var st = lastAt(STEPS, t)[1];
      set("step", st, function (v) { Array.prototype.forEach.call(steps, function (li, i) { li.classList.toggle("on", i === v); }); });
    }
    var running = false, t0 = 0, raf = 0;
    function frame(now) {
      if (!running) return;
      var t = ((now - t0) / 1000) % LOOP;
      draw(t);
      raf = requestAnimationFrame(frame);
    }
    if (reduce) {
      draw(END + 0.1);  // (the match's end, still)
    } else {
      draw(0);
      onScreen(board, function () { if (!running) { running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); } },
               function () { running = false; cancelAnimationFrame(raf); });
    }
  }

  // --- the four skill devices (they were the four heroes, with a spider dash button, until 2026-10-20) --------
  var slabs = Array.prototype.slice.call(document.querySelectorAll(".slab"));
  function open(slab, keep) {
    slabs.forEach(function (s) { s.setAttribute("aria-expanded", s === slab ? "true" : "false"); });
    doc.style.setProperty("--hero", slab.style.getPropertyValue("--c"));
    if (keep) store.set("sx-hero", slab.getAttribute("data-hero"));
  }
  slabs.forEach(function (slab) {
    slab.querySelector(".slab-pick").addEventListener("click", function () { open(slab, true); });
  });
  var kept = store.get("sx-hero");
  slabs.forEach(function (s) { if (s.getAttribute("data-hero") === kept) open(s, false); });
})();
