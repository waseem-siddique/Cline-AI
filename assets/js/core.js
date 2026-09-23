/* CLINE AI — shared core: theme, storage, auth, toasts, markdown */
window.CL = (function(){
  "use strict";
  var K = {
    theme:"cline.theme",
    users:"cline.users.v1",
    session:"cline.session.v1",
    data:function(id){ return "cline.data." + id; }
  };

  /* ---------- storage helpers ---------- */
  function read(key, fallback){
    try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch(e){ return fallback; }
  }
  function write(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  }

  /* ---------- theme ---------- */
  var theme = {
    pref:function(){ try{ return localStorage.getItem(K.theme) || "system"; }catch(e){ return "system"; } },
    resolve:function(p){
      if(p === "light" || p === "dark") return p;
      return (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    },
    apply:function(p){
      var pref = p || theme.pref();
      document.documentElement.setAttribute("data-theme", theme.resolve(pref));
      document.documentElement.setAttribute("data-theme-pref", pref);
    },
    set:function(p){
      try{ localStorage.setItem(K.theme, p); }catch(e){}
      theme.apply(p);
      document.dispatchEvent(new CustomEvent("cl:theme", {detail:{pref:p}}));
    },
    /* wire a .theme-switch element */
    mount:function(el){
      if(!el) return;
      var btns = el.querySelectorAll("button[data-theme-set]");
      function sync(){
        var pref = theme.pref();
        for(var i=0;i<btns.length;i++){
          btns[i].setAttribute("aria-pressed", String(btns[i].getAttribute("data-theme-set") === pref));
        }
      }
      for(var i=0;i<btns.length;i++){
        btns[i].addEventListener("click", function(){
          theme.set(this.getAttribute("data-theme-set")); sync();
        });
      }
      document.addEventListener("cl:theme", sync);
      sync();
    }
  };
  if(window.matchMedia){
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(){
      if(theme.pref() === "system") theme.apply("system");
    });
  }

  /* ---------- toasts ---------- */
  function toast(msg, kind, ms){
    var host = document.getElementById("toasts");
    if(!host){
      host = document.createElement("div");
      host.id = "toasts"; document.body.appendChild(host);
    }
    var t = document.createElement("div");
    t.className = "toast" + (kind ? " " + kind : "");
    t.setAttribute("role","status");
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function(){
      t.style.transition = "opacity .2s, transform .2s";
      t.style.opacity = "0"; t.style.transform = "translateY(6px)";
      setTimeout(function(){ if(t.parentNode) t.remove(); }, 220);
    }, ms || 2600);
  }

  /* ---------- password hashing ---------- */
  function bytesToHex(buf){
    var b = new Uint8Array(buf), s = "";
    for(var i=0;i<b.length;i++) s += ("0" + b[i].toString(16)).slice(-2);
    return s;
  }
  function randomSalt(){
    var a = new Uint8Array(16);
    if(window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for(var i=0;i<16;i++) a[i] = Math.floor(Math.random()*256);
    return bytesToHex(a);
  }
  /* Fallback only used when WebCrypto is unavailable (e.g. some file:// contexts). */
  function weakHash(str){
    var h1 = 0x12345678, h2 = 0x9abcdef0, i, c;
    for(i=0;i<str.length;i++){
      c = str.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 + c * (i + 7)) * 2654435761 >>> 0;
    }
    return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
  }
  async function hashPassword(password, salt){
    if(window.crypto && crypto.subtle && crypto.subtle.importKey){
      try{
        var enc = new TextEncoder();
        var key = await crypto.subtle.importKey("raw", enc.encode(password), {name:"PBKDF2"}, false, ["deriveBits"]);
        var bits = await crypto.subtle.deriveBits(
          {name:"PBKDF2", salt:enc.encode(salt), iterations:120000, hash:"SHA-256"}, key, 256);
        return "pbkdf2$" + bytesToHex(bits);
      }catch(e){}
    }
    return "weak$" + weakHash(salt + "|" + password);
  }

  /* ---------- auth (browser-local accounts) ---------- */
  var auth = {
    users:function(){ return read(K.users, []); },
    current:function(){
      var s = read(K.session, null);
      if(!s || !s.id) return null;
      var list = auth.users(), i;
      for(i=0;i<list.length;i++) if(list[i].id === s.id) return {id:list[i].id, name:list[i].name, email:list[i].email};
      return null;
    },
    signUp:async function(name, email, password){
      name = (name || "").trim(); email = (email || "").trim().toLowerCase();
      if(name.length < 2) throw new Error("Enter your name.");
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Enter a valid email address.");
      if(password.length < 8) throw new Error("Use at least 8 characters for the password.");
      var list = auth.users(), i;
      for(i=0;i<list.length;i++) if(list[i].email === email) throw new Error("An account already exists for that email. Try logging in.");
      var salt = randomSalt();
      var rec = {
        id:"u_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
        name:name, email:email, salt:salt, hash:await hashPassword(password, salt), createdAt:Date.now()
      };
      list.push(rec);
      if(!write(K.users, list)) throw new Error("This browser blocked local storage, so the account cannot be saved.");
      write(K.session, {id:rec.id, at:Date.now()});
      return {id:rec.id, name:rec.name, email:rec.email};
    },
    logIn:async function(email, password, remember){
      email = (email || "").trim().toLowerCase();
      var list = auth.users(), rec = null, i;
      for(i=0;i<list.length;i++) if(list[i].email === email) rec = list[i];
      if(!rec) throw new Error("No account found for that email.");
      var hash = await hashPassword(password, rec.salt);
      if(hash !== rec.hash) throw new Error("That password does not match our record.");
      write(K.session, {id:rec.id, at:Date.now(), remember:!!remember});
      return {id:rec.id, name:rec.name, email:rec.email};
    },
    logOut:function(){ try{ localStorage.removeItem(K.session); }catch(e){} },
    /* per-user workspace data */
    data:function(id){
      return read(K.data(id), {
        settings:{provider:"openrouter", model:"anthropic/claude-opus-4.1", keys:{}, bases:{}, system:"You are a helpful assistant. Be accurate and concise.", temperature:0.7},
        chats:[]
      });
    },
    saveData:function(id, data){ return write(K.data(id), data); },
    require:function(){
      var u = auth.current();
      if(!u){ location.replace("auth.html?next=app"); return null; }
      return u;
    },
    initials:function(name){
      var p = (name || "?").trim().split(/\s+/);
      return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length-1].charAt(0) : "")).toUpperCase();
    }
  };

  /* ---------- markdown ---------- */
  function esc(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function inline(s){
    s = esc(s);
    s = s.replace(/`([^`\n]+)`/g, function(_,c){ return "<code>" + c + "</code>"; });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  function md(text){
    var out = "", parts = String(text == null ? "" : text).split(/```/), i;
    for(i=0;i<parts.length;i++){
      if(i % 2 === 1){
        var raw = parts[i], lang = "", nl = raw.indexOf("\n");
        var first = nl === -1 ? raw : raw.slice(0, nl);
        if(nl !== -1 && /^[\w+#.-]{0,16}$/.test(first.trim())){ lang = first.trim(); raw = raw.slice(nl + 1); }
        out += '<pre><div class="pre-top"><span class="lang">' + esc(lang || "code") +
               '</span><button type="button" class="copy-code">Copy</button></div><code>' +
               esc(raw.replace(/\n$/,"")) + "</code></pre>";
        continue;
      }
      var lines = parts[i].split("\n"), buf = [], list = null, j;
      function flushP(){ if(buf.length){ out += "<p>" + inline(buf.join("\n")).replace(/\n/g,"<br />") + "</p>"; buf = []; } }
      function closeList(){ if(list){ out += "</" + list + ">"; list = null; } }
      for(j=0;j<lines.length;j++){
        var line = lines[j];
        var h = line.match(/^#{1,6}\s+(.*)$/);
        var ul = line.match(/^\s*[-*]\s+(.*)$/);
        var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if(h){ flushP(); closeList(); out += "<h3>" + inline(h[1]) + "</h3>"; }
        else if(ul || ol){
          flushP();
          var want = ul ? "ul" : "ol";
          if(list !== want){ closeList(); out += "<" + want + ">"; list = want; }
          out += "<li>" + inline((ul || ol)[1]) + "</li>";
        }
        else if(!line.trim()){ flushP(); closeList(); }
        else { closeList(); buf.push(line); }
      }
      flushP(); closeList();
    }
    return out;
  }

  /* ---------- misc ---------- */
  function copy(text){
    if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function(res, rej){
      try{
        var t = document.createElement("textarea");
        t.value = text; t.setAttribute("readonly",""); t.style.position = "fixed"; t.style.top = "-1000px";
        document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); res();
      }catch(e){ rej(e); }
    });
  }
  function download(name, text, type){
    var blob = new Blob([text], {type:type || "text/plain;charset=utf-8"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function reveal(sel){
    var nodes = document.querySelectorAll(sel || ".reveal");
    if(!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches){
      for(var i=0;i<nodes.length;i++) nodes[i].classList.add("in");
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, {rootMargin:"0px 0px -8% 0px", threshold:.12});
    for(var j=0;j<nodes.length;j++) io.observe(nodes[j]);
  }

  /* ---------- providers ----------
     type: "openai" = OpenAI-compatible /chat/completions, "anthropic" = /messages,
     "gemini" = :streamGenerateContent. Keys are per provider and stay on this device. */
  /* ---------- splash ---------- */
  function splash(minMs){
    var el = document.getElementById("splash");
    if(!el) return;
    var start = Date.now(), wait = typeof minMs === "number" ? minMs : 500;
    function hide(){
      var left = Math.max(0, wait - (Date.now() - start));
      setTimeout(function(){
        el.classList.add("out");
        setTimeout(function(){ if(el.parentNode) el.remove(); }, 280);
      }, left);
    }
    if(document.readyState === "complete") hide();
    else addEventListener("load", hide, {once:true});
  }

  var PROVIDERS = [
    {id:"openrouter", label:"OpenRouter", type:"openai", base:"https://openrouter.ai/api/v1",
     keyHint:"sk-or-v1-…", keysUrl:"https://openrouter.ai/keys", note:"One key, every model",
     models:[
       {id:"anthropic/claude-opus-4.1", label:"Claude Opus 4.1", ctx:200000},
       {id:"anthropic/claude-sonnet-4.5", label:"Claude Sonnet 4.5", ctx:200000},
       {id:"openai/gpt-4o", label:"GPT-4o", ctx:128000},
       {id:"openai/gpt-4o-mini", label:"GPT-4o mini", ctx:128000},
       {id:"google/gemini-2.5-flash", label:"Gemini 2.5 Flash", ctx:1048576},
       {id:"meta-llama/llama-3.3-70b-instruct", label:"Llama 3.3 70B", ctx:131072},
       {id:"deepseek/deepseek-chat", label:"DeepSeek V3", ctx:65536}
     ]},
    {id:"openai", label:"OpenAI", type:"openai", base:"https://api.openai.com/v1",
     keyHint:"sk-…", keysUrl:"https://platform.openai.com/api-keys", note:"GPT models",
     models:[
       {id:"gpt-4o", label:"GPT-4o", ctx:128000},
       {id:"gpt-4o-mini", label:"GPT-4o mini", ctx:128000},
       {id:"gpt-4.1", label:"GPT-4.1", ctx:1047576},
       {id:"gpt-4.1-mini", label:"GPT-4.1 mini", ctx:1047576},
       {id:"o4-mini", label:"o4-mini (reasoning)", ctx:200000}
     ]},
    {id:"anthropic", label:"Anthropic", type:"anthropic", base:"https://api.anthropic.com/v1",
     keyHint:"sk-ant-…", keysUrl:"https://console.anthropic.com/settings/keys", note:"Claude models",
     models:[
       {id:"claude-opus-4-1-20250805", label:"Claude Opus 4.1", ctx:200000},
       {id:"claude-sonnet-4-5-20250929", label:"Claude Sonnet 4.5", ctx:200000},
       {id:"claude-3-5-haiku-latest", label:"Claude 3.5 Haiku", ctx:200000}
     ]},
    {id:"gemini", label:"Google Gemini", type:"gemini", base:"https://generativelanguage.googleapis.com/v1beta",
     keyHint:"AIza…", keysUrl:"https://aistudio.google.com/apikey", note:"Gemini models",
     models:[
       {id:"gemini-2.5-pro", label:"Gemini 2.5 Pro", ctx:1048576},
       {id:"gemini-2.5-flash", label:"Gemini 2.5 Flash", ctx:1048576},
       {id:"gemini-2.0-flash", label:"Gemini 2.0 Flash", ctx:1048576}
     ]},
    {id:"groq", label:"Groq", type:"openai", base:"https://api.groq.com/openai/v1",
     keyHint:"gsk_…", keysUrl:"https://console.groq.com/keys", note:"Very fast open models",
     models:[
       {id:"llama-3.3-70b-versatile", label:"Llama 3.3 70B", ctx:131072},
       {id:"deepseek-r1-distill-llama-70b", label:"DeepSeek R1 Distill 70B", ctx:131072}
     ]},
    {id:"mistral", label:"Mistral", type:"openai", base:"https://api.mistral.ai/v1",
     keyHint:"…", keysUrl:"https://console.mistral.ai/api-keys", note:"Mistral models",
     models:[
       {id:"mistral-large-latest", label:"Mistral Large", ctx:131072},
       {id:"mistral-small-latest", label:"Mistral Small", ctx:32768}
     ]},
    {id:"deepseek", label:"DeepSeek", type:"openai", base:"https://api.deepseek.com/v1",
     keyHint:"sk-…", keysUrl:"https://platform.deepseek.com/api_keys", note:"Chat and reasoner",
     models:[
       {id:"deepseek-chat", label:"DeepSeek V3", ctx:65536},
       {id:"deepseek-reasoner", label:"DeepSeek R1", ctx:65536}
     ]},
    {id:"xai", label:"xAI", type:"openai", base:"https://api.x.ai/v1",
     keyHint:"xai-…", keysUrl:"https://console.x.ai", note:"Grok models",
     models:[
       {id:"grok-4", label:"Grok 4", ctx:256000},
       {id:"grok-3", label:"Grok 3", ctx:131072}
     ]},
    {id:"custom", label:"Custom (OpenAI-compatible)", type:"openai", base:"",
     keyHint:"your key", keysUrl:"", note:"Ollama, LM Studio, vLLM, a proxy…",
     models:[]}
  ];
  function provider(id){
    for(var i=0;i<PROVIDERS.length;i++) if(PROVIDERS[i].id === id) return PROVIDERS[i];
    return PROVIDERS[0];
  }
  function modelLabel(providerId, modelId){
    var p = provider(providerId), i;
    for(i=0;i<p.models.length;i++) if(p.models[i].id === modelId) return p.models[i].label;
    return modelId;
  }
  /* kept for the landing page marquee */
  var MODELS = provider("openrouter").models.slice();

  theme.apply();
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ splash(); });
  else splash();
  return {K:K, splash:splash, PROVIDERS:PROVIDERS, provider:provider, modelLabel:modelLabel, read:read, write:write, theme:theme, toast:toast, auth:auth, md:md, esc:esc,
          copy:copy, download:download, reveal:reveal, MODELS:MODELS};
})();
