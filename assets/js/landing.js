/* CLINE AI — landing page behaviour */
(function(){
  "use strict";
  CL.theme.mount(document.getElementById("themeSwitch"));

  /* signed-in visitors get straight-through CTAs */
  var user = CL.auth.current();
  if(user){
    var login = document.getElementById("navLogin");
    login.textContent = "Open app"; login.href = "app.html"; login.className = "btn secondary sm";
    document.getElementById("navCta").textContent = "Continue as " + user.name.split(" ")[0];
    document.getElementById("navCta").href = "app.html";
    document.getElementById("heroCta").textContent = "Open your workspace";
    document.getElementById("heroCta").href = "app.html";
  }

  /* model marquee */
  var names = CL.MODELS.map(function(m){ return m.label; })
    .concat(["Mistral Large","Qwen 2.5 72B","Command R+","Perplexity Sonar","Grok 2","Nova Pro"]);
  var track = document.getElementById("track");
  var html = names.map(function(n){ return "<span>" + CL.esc(n) + "</span>"; }).join("");
  track.innerHTML = html + html;

  /* feature cards */
  var ICON = {
    swap:'<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
    bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/>',
    lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 1 1 8 0v3.5"/>',
    stack:'<path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"/><path d="M3 12l9 4.5L21 12M3 16.5L12 21l9-4.5"/>',
    keys:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h4M7 13h10M7 17h7"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };
  var FEATURES = [
    ["swap","Switch models mid-thread","Answer a question with Claude Opus, then re-ask a cheaper model for a second opinion. The whole conversation follows you across."],
    ["bolt","Real token streaming","Replies appear word by word over server-sent events, with a stop button the moment an answer goes sideways."],
    ["lock","Your key, your machine","The key sits in this browser's storage and is sent to exactly one place: OpenRouter. No proxy, no telemetry, no account server."],
    ["stack","Organised conversations","Unlimited saved chats with search, auto-titles, rename, delete and one-click Markdown export."],
    ["keys","Command palette","Hit Ctrl/⌘ + K to jump between chats, change the theme or open settings without touching the mouse."],
    ["chart","Usage at a glance","A running estimate of messages and tokens per workspace, so a long thread never surprises your OpenRouter bill."]
  ];
  document.getElementById("featureGrid").innerHTML = FEATURES.map(function(f){
    return '<article class="card reveal"><div class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      ICON[f[0]] + '</svg></div><h3>' + CL.esc(f[1]) + "</h3><p>" + CL.esc(f[2]) + "</p></article>";
  }).join("");

  /* sticky nav hairline */
  var nav = document.getElementById("nav");
  var onScroll = function(){ nav.classList.toggle("stuck", window.scrollY > 8); };
  onScroll();
  addEventListener("scroll", onScroll, {passive:true});

  /* smooth anchors */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click", function(e){
      var el = document.querySelector(this.getAttribute("href"));
      if(!el) return;
      e.preventDefault();
      el.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start"});
    });
  });

  /* scroll reveal + counters */
  CL.reveal(".reveal");
  var stats = document.getElementById("stats");
  var ran = false;
  function count(){
    if(ran) return;
    var box = stats.getBoundingClientRect();
    if(box.top > innerHeight - 60) return;
    ran = true;
    stats.querySelectorAll("[data-count]").forEach(function(el){
      var target = parseInt(el.getAttribute("data-count"), 10);
      var suffix = target === 300 ? "+" : (target === 100 ? "%" : "");
      if(matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0){
        el.textContent = target + suffix; return;
      }
      var t0 = performance.now(), dur = 900;
      (function step(now){
        var p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
        if(p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  count();
  addEventListener("scroll", count, {passive:true});
})();
