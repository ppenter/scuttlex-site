/* SCUTTLE X home page: the stage and the trailer. No libraries.
   The stage redraws only while something moves (a spawn or a transform), so a still page costs nothing.
   The morph follows the game's (character.gd / fighter.gdshader): the hero turns to light, a blocky
   white-hot seam sweeps down through it, a flash halfway, the spider assembles from light cells and
   pops to size; a spawn drops a beam and builds the fighter up from the feet. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // --- the trailer and the story: a video only loads when someone asks for it; one plays at a time ----
  var players = Array.prototype.slice.call(document.querySelectorAll("[data-trailer]"));
  function playTrailer(player) {
    if (!player || player.classList.contains("playing")) return;
    var v = document.createElement("video");
    v.addEventListener("play", function () {
      players.forEach(function (o) { var ov = o.querySelector("video"); if (ov && ov !== v) ov.pause(); });
    });
    v.src = player.getAttribute("data-src");
    v.controls = true;
    v.playsInline = true;
    v.preload = "auto";
    v.poster = player.querySelector("img").currentSrc || player.querySelector("img").src;
    player.classList.add("playing");
    player.replaceChildren(v);
    player.removeAttribute("aria-label");
    player.setAttribute("tabindex", "-1");
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    v.focus();
  }
  players.forEach(function (player) {
    player.addEventListener("click", function (e) { if (e.target === player || !player.classList.contains("playing")) playTrailer(player); });
  });
  document.querySelectorAll("[data-play]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (!players.length) return;
      players[0].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      playTrailer(players[0]);
    });
  });

  // --- motion on the rest of the page -----------------------------------------------------------------
  // .live while on screen (the endless animations pause off it); .in once, when a part scrolls up
  var live = [];
  if (window.IntersectionObserver) {
    var liveIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var el = e.target;
        el.classList.toggle("live", e.isIntersecting);
        el.classList.toggle("away", !e.isIntersecting);
        if (e.isIntersecting && el._go) { var f = el._go; el._go = null; f(); }
      });
    });
    live = Array.prototype.slice.call(document.querySelectorAll(".stage, .ticker, .player, .map, .duel, [data-phases], [data-race]"));
    live.forEach(function (el) { liveIO.observe(el); });
  }
  function whenLive(el, f) { if (el.classList.contains("live")) f(); else el._go = f; }

  if (!reduce && window.IntersectionObserver) {
    var groups = [".band h2", ".band .lede", ".band .note", ".band .small", ".shot", ".player", ".map", ".duel", ".mode", ".race", ".facts li", ".guns li", ".outro .cta"];
    var reveal = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    groups.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el, i) {
        el.classList.add("rv");
        if (/li$/.test(sel) || sel === ".map" || sel === ".mode") el.style.setProperty("--rd", (i % 4) * 0.08 + "s");
        if (/shot|player|map/.test(sel)) { var sc = document.createElement("i"); sc.className = "scan"; sc.setAttribute("aria-hidden", "true"); el.appendChild(sc); }
        reveal.observe(el);
      });
    });

    // the round plays itself: each phase lights up and fills, the fuse beeps, then it starts over
    var phases = document.querySelector("[data-phases]");
    if (phases) {
      var PT = [0.9, 2.6, 1.3, 3.0, 1.8];  // seconds on screen for freeze, push, plant, fuse, defuse
      var rows = Array.prototype.slice.call(phases.children);
      var step = 0;
      var run = function () {
        if (!phases.classList.contains("live")) { phases._go = run; return; }
        if (step > 0) { rows[step - 1].classList.remove("on"); rows[step - 1].classList.add("done"); }
        if (step === rows.length) {
          setTimeout(function () { rows.forEach(function (r) { r.classList.remove("on", "done"); }); step = 0; run(); }, 1800);
          return;
        }
        rows[step].style.setProperty("--pt", PT[step] + "s");
        rows[step].classList.add("on");
        setTimeout(run, PT[step++] * 1000);
      };
      phases.classList.add("sim");
      whenLive(phases, run);
    }

    // the speed race runs again every few seconds while it's on screen
    var race = document.querySelector("[data-race]");
    if (race) {
      var again = function () {
        if (!race.classList.contains("live")) { race._go = again; return; }
        restart(race, "go");
        setTimeout(again, 4800);
      };
      whenLive(race, again);
    }

    // a neon ring wherever you tap or click
    document.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      var t = document.createElement("i");
      t.className = "tap";
      t.setAttribute("aria-hidden", "true");
      t.style.left = e.clientX + "px";
      t.style.top = e.clientY + "px";
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 520);
    }, { passive: true });
  }

  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // --- stage ----------------------------------------------------------------------------------------
  var stage = document.querySelector(".stage");
  var arena = document.querySelector("[data-arena]");
  if (!arena) return;
  var still = arena.querySelector("[data-still]");
  var canvas = arena.querySelector("[data-gl]");
  var ring = arena.querySelector(".ring");
  var beam = arena.querySelector(".beam");
  var morphBtn = arena.querySelector("[data-morph]");
  var morphLabel = arena.querySelector("[data-morph-label]");
  var bigname = arena.querySelector("[data-bigname]");
  var picks = Array.prototype.slice.call(document.querySelectorAll("[data-hero]"));
  var media = still.getAttribute("src").replace(/hero_[a-z]+\.webp$/, "");
  var MORPH_LEN = 1.15, SPAWN_LEN = 1.25, OUT_LEN = 0.32;  // seconds (the game's 0.2 s morph, slowed for the show like the app intro)

  var current = picks[0], spider = false, busy = false;
  var images = {};
  function img(url) {
    if (!images[url]) images[url] = new Promise(function (ok, fail) {
      var i = new Image();
      i.decoding = "async";
      i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).then(function () { ok(i); }, function () { ok(i); }); };
      i.onerror = fail;
      i.src = url;
    });
    return images[url];
  }
  function urls(btn) { var k = btn.getAttribute("data-hero"); return [media + "hero_" + k + ".webp", media + "spider_" + k + ".webp"]; }
  function prefetch(btn) { urls(btn).forEach(img); }

  function burst() { if (!reduce) restart(ring, "burst"); }

  function applyText(btn, first) {
    var k = btn.getAttribute("data-hero");
    if (!first && !reduce) { restart(bigname, "swap"); restart(document.querySelector(".skill"), "swap"); }
    doc.style.setProperty("--hero", btn.getAttribute("data-color"));
    bigname.textContent = btn.getAttribute("data-name");
    picks.forEach(function (b) { b.setAttribute("aria-checked", b === btn ? "true" : "false"); b.tabIndex = b === btn ? 0 : -1; });
    document.querySelector("[data-skill-name]").textContent = btn.getAttribute("data-skill");
    document.querySelector("[data-skill-desc]").textContent = btn.getAttribute("data-desc");
    document.querySelectorAll("[data-skill-icon] [data-k]").forEach(function (s) { s.hidden = s.getAttribute("data-k") !== k; });
    still.alt = btn.getAttribute(spider ? "data-spider-alt" : "data-alt");
  }

  // --- WebGL ------------------------------------------------------------------------------------------
  var gl = null, prog, U = {}, tex = [], cells = [70, 124], color = [0.78, 1, 0.15];
  var M = 0, B = 1, tweens = {}, raf = 0, lastFlash = 0;

  var VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "precision mediump float;varying vec2 v;",
    "uniform sampler2D uH,uS;uniform float uM,uB;uniform vec3 uC;uniform vec2 uN;",
    "const float HB=.03,HT=.985;const vec2 SA=vec2(.58,.02);const vec3 HOT=vec3(1.,.97,.9);",
    "float hs(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "vec4 tx(sampler2D s,vec2 u){if(u.x<0.||u.x>1.||u.y<0.||u.y>1.)return vec4(0.);return texture2D(s,vec2(u.x,1.-u.y));}",
    "float ez(float x){return x*x*(3.-2.*x);}",
    "void main(){",
    " vec2 cl=floor(v*uN),cu=(cl+.5)/uN,f=fract(v*uN);",
    " float n=hs(cl),n2=hs(cl+17.3);",
    " float bx=step(.14,f.x)*step(f.x,.86)*step(.14,f.y)*step(f.y,.86);",
    " vec3 c=vec3(0.);float a=0.;",
    // the hero: turns to light, the seam sweeps down, cells break off above it
    " float ph=clamp(uM/.55,0.,1.);",
    " if(ph<1.){",
    "  float sy=mix(HT+.04,HB-.04,ez(ph))+(n-.5)*.05;",
    "  vec4 h=tx(uH,v);float hc=step(.5,tx(uH,cu).a);",
    "  float keep=step(cu.y,sy),lit=smoothstep(0.,.35,uM);",
    "  vec3 hl=mix(h.rgb,(uC*.6+.4)*h.a,lit*.55)+uC*h.a*lit*.25;",
    "  c+=hl*keep;a+=h.a*keep;",
    "  float d=cu.y-sy,on=step(.001,ph);",
    "  float sm=(1.-smoothstep(0.,.03,abs(d)))*hc*on;",
    "  float sh=step(0.,d)*hc*(1.-smoothstep(0.,.2,d))*step(n2,1.-d/.2)*on;",
    "  c+=(mix(uC,HOT,.75)*sm+uC*sh*.85)*bx;a+=(sm+sh*.75)*bx;",
    " }",
    // the spider: light cells arrive, cool into the model, then it pops to size
    " float ps=clamp((uM-.42)/.45,0.,1.);",
    " float hsa=0.;",
    " if(ps>0.){",
    "  float q=clamp((uM-.8)/.2,0.,1.)-1.;float sc=.8+.2*(1.+2.7*q*q*q+1.7*q*q);",
    "  vec4 s=tx(uS,SA+(v-SA)/sc);hsa=step(.5,tx(uS,SA+(cu-SA)/sc).a);",
    "  float at=n*.75,on=step(at+.001,ps),ht=1.-clamp((ps-at)/.25,0.,1.);",
    "  c+=s.rgb*on*(1.-ht)+mix(uC,HOT,.55)*ht*on*hsa*bx;a+=s.a*on*(1.-ht)+ht*on*hsa*bx;",
    " }",
    // the flash halfway
    " float fl=exp(-pow((uM-.5)/.07,2.));vec2 r=(v-vec2(.52,.28))*vec2(1.,1.7);float g=fl*exp(-dot(r,r)*9.);",
    " c+=mix(uC,HOT,.4)*g;a+=g*.55;",
    // the spawn: built up from the feet, a seam rising, the glow fading as it settles
    " if(uB>0.){",
    "  float by=mix(HB-.06,HT+.06,ez(1.-uB))+(n-.5)*.04;",
    "  float bl=step(cu.y,by);c*=bl;a*=bl;",
    "  float sil=uM<.5?step(.5,tx(uH,cu).a):hsa;",
    "  float bs=(1.-smoothstep(0.,.03,abs(cu.y-by)))*sil*step(uB,.999);",
    "  c+=mix(uC,HOT,.7)*bs*bx;a+=bs*bx;c+=uC*a*uB*.45;",
    " }",
    " gl_FragColor=vec4(min(c,vec3(1.)),clamp(a,0.,1.));",
    "}"].join("\n");

  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

  function initGL() {
    if (reduce || !canvas.getContext || /[?&]nogl/.test(location.search)) return false;  // ?nogl: check the plain-image path
    try {
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
    } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    } catch (e) { gl = null; return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["uH", "uS", "uM", "uB", "uC", "uN"].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    gl.uniform1i(U.uH, 0);
    gl.uniform1i(U.uS, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    for (var i = 0; i < 2; i++) {
      tex[i] = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    }
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); fallback(); });
    resize();
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); draw(); }).observe(arena);
    return true;
  }

  function resize() {
    if (!gl) return;
    var r = arena.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    cells = [Math.max(24, Math.round(r.width / 6.5)), Math.max(40, Math.round(r.height / 6.5))];  // light cells ~6.5 px
  }

  function upload(i, image) {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  function draw() {
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uM, M);
    gl.uniform1f(U.uB, B);
    gl.uniform3fv(U.uC, color);
    gl.uniform2fv(U.uN, cells);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // tiny tween runner: draws only while one is running
  function tween(key, to, secs, done) {
    var from = key === "m" ? M : B;
    tweens[key] = { from: from, to: to, t0: performance.now(), len: Math.max(0.001, secs) * 1000, done: done };
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    var live = false;
    Object.keys(tweens).forEach(function (k) {
      var tw = tweens[k], u = Math.min(1, (now - tw.t0) / tw.len), val = tw.from + (tw.to - tw.from) * u;
      var before = M;
      if (k === "m") M = val; else B = val;
      if (k === "m" && (before - 0.5) * (M - 0.5) <= 0 && before !== M && now - lastFlash > 300) { lastFlash = now; burst(); }
      if (u >= 1) { delete tweens[k]; if (tw.done) tw.done(); } else live = true;
    });
    draw();
    if (live || Object.keys(tweens).length) raf = requestAnimationFrame(frame);
  }

  // checks: ?m=0.4 (0 hero .. 1 spider) and ?b=0.5 (spawn, 1 unbuilt .. 0 whole) hold the stage still there
  var hold = /[?&](m|b)=/.test(location.search) ? new URLSearchParams(location.search) : null;

  function spawn(after) {
    if (hold) { M = +(hold.get("m") || 0); B = +(hold.get("b") || 0); draw(); return; }
    if (document.hidden) {  // a background tab: build up when someone is looking
      document.addEventListener("visibilitychange", function again() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", again);
        spawn(after);
      });
      return;
    }
    restart(beam, "drop");
    setTimeout(burst, 170);
    B = 1;
    setTimeout(function () { tween("b", 0, SPAWN_LEN, after); }, 150);
  }

  function fallback() {
    gl = null;
    arena.classList.remove("gl-on");
    arena.classList.add("fallback");
    still.src = urls(current)[spider ? 1 : 0];
  }

  // --- actions ------------------------------------------------------------------------------------------
  function setForm(toSpider) {
    if (busy) return;
    spider = toSpider;
    arena.classList.toggle("spider", spider);
    morphBtn.setAttribute("aria-pressed", spider ? "true" : "false");
    morphLabel.textContent = morphBtn.getAttribute(spider ? "data-on" : "data-off");
    still.alt = current.getAttribute(spider ? "data-spider-alt" : "data-alt");
    if (!gl) { img(urls(current)[spider ? 1 : 0]).then(function () { still.src = urls(current)[spider ? 1 : 0]; }); burst(); return; }
    tween("m", spider ? 1 : 0, MORPH_LEN * Math.abs((spider ? 1 : 0) - M));
  }

  // auto: the attract loop's pick (not remembered); after: once the new hero is built
  function pick(btn, first, auto, after) {
    if ((btn === current && !first) || busy) return;
    var prev = current;
    current = btn;
    if (!auto && !first) store.set("sx-hero", btn.getAttribute("data-hero"));
    var load = Promise.all(urls(btn).map(img));
    if (!gl) {
      applyText(btn, first);
      load.then(function (ims) { if (current === btn) still.src = ims[spider ? 1 : 0].src; });
      if (!first) burst();
      if (after) after();
      return;
    }
    busy = true;
    var out = first ? Promise.resolve() : new Promise(function (ok) { tween("b", 1, OUT_LEN, ok); });
    Promise.all([load, out]).then(function (r) {
      var ims = r[0];
      upload(0, ims[0]);
      upload(1, ims[1]);
      color = hex(btn.getAttribute("data-color"));
      applyText(btn, first);
      arena.classList.add("gl-on");
      busy = false;
      spawn(after);
    }, function () { busy = false; current = prev; fallback(); });
  }

  // --- attract: until someone takes over, the stage shows itself off: spider, back, the next hero ---------
  var attract = !reduce, attractT = 0, act = 0;
  var ACTS = [3200, 3800, 3400];  // ms to wait before: turning into the spider, turning back, the next hero
  function takeOver() { attract = false; clearTimeout(attractT); morphBtn.classList.add("used"); }
  function attractLater(ms) { clearTimeout(attractT); if (attract) attractT = setTimeout(attractStep, ms); }
  function attractStep() {
    if (!attract) return;
    var idle = !busy && !Object.keys(tweens).length && !document.hidden && !stage.classList.contains("away");
    if (!idle) { attractLater(1200); return; }
    var next = picks[(picks.indexOf(current) + 1) % picks.length];
    if (act === 0) { setForm(true); prefetch(next); }
    else if (act === 1) setForm(false);
    else { pick(next, false, true, function () { attractLater(ACTS[0]); }); act = 0; return; }
    attractLater(ACTS[++act % 3] + MORPH_LEN * 1000);
  }

  if (!reduce) {  // a few light cells rising off the floor: CSS only, no frames from us
    var motes = document.createElement("div");
    motes.className = "motes";
    motes.setAttribute("aria-hidden", "true");
    for (var mi = 0; mi < 14; mi++) {
      var c = document.createElement("i");
      var r = function (a, b) { return a + Math.random() * (b - a); };
      c.style.cssText = "--x:" + r(8, 92).toFixed(1) + "%;--s:" + Math.round(r(3, 6)) + "px;--t:" + r(5, 9).toFixed(1) + "s;--d:-" + r(0, 9).toFixed(1) + "s;--h:" + Math.round(r(160, 420)) + "px";
      motes.appendChild(c);
    }
    arena.insertBefore(motes, still);
  }

  // the pointer tilts the stage's layers a little (a mouse or trackpad only)
  if (!reduce && matchMedia("(pointer: fine)").matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, praf = 0;
    var follow = function () {
      praf = 0;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      stage.style.setProperty("--px", cx.toFixed(3));
      stage.style.setProperty("--py", cy.toFixed(3));
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) praf = requestAnimationFrame(follow);
    };
    stage.addEventListener("pointermove", function (e) {
      var b = stage.getBoundingClientRect();
      tx = (e.clientX - b.left) / b.width * 2 - 1;
      ty = (e.clientY - b.top) / b.height * 2 - 1;
      if (!praf) praf = requestAnimationFrame(follow);
    });
    stage.addEventListener("pointerleave", function () { tx = ty = 0; if (!praf) praf = requestAnimationFrame(follow); });
  }

  var glOk = initGL();
  if (!glOk) arena.classList.add("fallback");
  var saved = store.get("sx-hero");
  var start = picks.filter(function (b) { return b.getAttribute("data-hero") === saved; })[0] || picks[0];
  if (glOk) pick(start, true, false, function () { attractLater(ACTS[0]); });
  else { applyText(start, true); if (start !== picks[0]) pick(start, true); attractLater(ACTS[0]); }

  morphBtn.addEventListener("click", function () { takeOver(); setForm(!spider); });
  picks.forEach(function (b, i) {
    b.addEventListener("click", function () { takeOver(); pick(b); });
    b.addEventListener("pointerenter", function () { prefetch(b); });
    b.addEventListener("focus", function () { prefetch(b); });
    b.addEventListener("keydown", function (e) {  // a radio group: arrows move the pick
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      takeOver();
      var n = picks[(i + d + picks.length) % picks.length];
      n.focus();
      pick(n);
    });
  });
})();
