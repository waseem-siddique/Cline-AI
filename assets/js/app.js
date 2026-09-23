/* CLINE AI — workspace */
(function(){
  "use strict";
  var user = CL.auth.require();
  if(!user) return;

  var ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var $ = function(id){ return document.getElementById(id); };

  var data = CL.auth.data(user.id);
  var activeId = null;
  var controller = null;
  var searchTerm = "";

  /* ---------------- persistence ---------------- */
  function persist(){
    if(!CL.auth.saveData(user.id, data)) CL.toast("This browser blocked local storage, so changes will not persist.", "bad", 4000);
  }
  function chat(){
    var i;
    for(i=0;i<data.chats.length;i++) if(data.chats[i].id === activeId) return data.chats[i];
    return null;
  }
  function newChat(){
    var c = {id:"c_" + Date.now().toString(36), title:"New chat", createdAt:Date.now(), updatedAt:Date.now(), model:data.settings.model, messages:[]};
    data.chats.unshift(c); activeId = c.id; persist();
    return c;
  }
  function touch(c){
    c.updatedAt = Date.now();
    data.chats.sort(function(a,b){ return b.updatedAt - a.updatedAt; });
    persist();
  }

  /* ---------------- sidebar ---------------- */
  function renderChats(){
    var list = $("chatList"), term = searchTerm.toLowerCase();
    var items = data.chats.filter(function(c){
      if(!term) return true;
      if(c.title.toLowerCase().indexOf(term) !== -1) return true;
      return c.messages.some(function(m){ return m.content.toLowerCase().indexOf(term) !== -1; });
    });
    list.innerHTML = "";
    if(!items.length){
      var p = document.createElement("p");
      p.className = "empty-list";
      p.textContent = term ? "No chat matches “" + searchTerm + "”." : "No conversations yet.";
      list.appendChild(p);
      return;
    }
    var label = document.createElement("p");
    label.className = "chats-label";
    label.textContent = term ? items.length + " MATCHING" : "RECENT";
    list.appendChild(label);

    items.forEach(function(c){
      var b = document.createElement("button");
      b.type = "button"; b.className = "chat-item";
      if(c.id === activeId) b.setAttribute("aria-current","true");
      var t = document.createElement("span");
      t.className = "t"; t.textContent = c.title;
      b.appendChild(t);
      var x = document.createElement("span");
      x.className = "x"; x.setAttribute("role","button"); x.setAttribute("tabindex","0");
      x.setAttribute("aria-label","Delete " + c.title); x.title = "Delete";
      x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      function del(e){
        e.stopPropagation(); e.preventDefault();
        data.chats = data.chats.filter(function(o){ return o.id !== c.id; });
        if(activeId === c.id) activeId = data.chats.length ? data.chats[0].id : null;
        if(!data.chats.length) newChat();
        persist(); renderAll();
        CL.toast("Chat deleted.", "good");
      }
      x.addEventListener("click", del);
      x.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " ") del(e); });
      b.appendChild(x);
      b.addEventListener("click", function(){ open(c.id); });
      list.appendChild(b);
    });
  }

  function renderUsage(){
    var msgs = 0, chars = 0;
    data.chats.forEach(function(c){
      msgs += c.messages.length;
      c.messages.forEach(function(m){ chars += m.content.length; });
    });
    var tokens = Math.round(chars / 4);
    $("usageTokens").textContent = tokens > 999 ? (tokens/1000).toFixed(1) + "k tokens" : tokens + " tokens";
    $("usageBar").style.width = Math.min(100, (tokens / 120000) * 100) + "%";
    $("usageFoot").textContent = msgs + (msgs === 1 ? " message" : " messages") + " across " +
      data.chats.length + (data.chats.length === 1 ? " chat" : " chats");
  }

  /* ---------------- transcript ---------------- */
  function renderThread(){
    var c = chat();
    var thread = $("thread");
    thread.innerHTML = "";
    var has = c && c.messages.length;
    $("welcome").hidden = !!has;
    thread.hidden = !has;
    $("chatTitle").textContent = c ? c.title : "New chat";
    $("regen").hidden = !(c && c.messages.some(function(m){ return m.role === "user"; }));
    if(!has) return;
    c.messages.forEach(function(m, i){ paintMessage(m, i); });
    jumpToEnd();
  }

  function paintMessage(m, index){
    var el = document.createElement("article");
    el.className = "msg " + m.role;

    var who = document.createElement("div");
    who.className = "who-line";
    if(m.role === "user"){ who.textContent = "You"; }
    else{
      var mid = document.createElement("span");
      mid.className = "mid"; mid.textContent = labelFor(m.model || (chat() && chat().model) || data.settings.model);
      who.appendChild(mid);
    }
    el.appendChild(who);

    var body = document.createElement("div");
    body.className = "body";
    body.innerHTML = CL.md(m.content);
    el.appendChild(body);

    var tools = document.createElement("div");
    tools.className = "tools";
    tools.appendChild(toolButton("Copy", function(){
      CL.copy(m.content).then(function(){ CL.toast("Copied to clipboard.", "good"); });
    }));
    if(m.role === "user"){
      tools.appendChild(toolButton("Edit", function(){
        $("input").value = m.content; grow(); $("input").focus();
        CL.toast("Loaded into the composer — edit and send.", null, 2000);
      }));
    }
    if(m.role === "assistant" && index === (chat().messages.length - 1)){
      tools.appendChild(toolButton("Regenerate", regenerate));
    }
    el.appendChild(tools);
    wireCodeCopy(el);
    $("thread").appendChild(el);
    return {el:el, body:body};
  }
  function toolButton(text, fn){
    var b = document.createElement("button");
    b.type = "button"; b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }
  function wireCodeCopy(scope){
    scope.querySelectorAll(".copy-code").forEach(function(btn){
      btn.addEventListener("click", function(){
        var pre = btn.closest("pre"), code = pre && pre.querySelector("code");
        if(!code) return;
        CL.copy(code.textContent).then(function(){
          btn.textContent = "Copied";
          setTimeout(function(){ btn.textContent = "Copy"; }, 1400);
        });
      });
    });
  }
  function labelFor(id){
    for(var i=0;i<CL.MODELS.length;i++) if(CL.MODELS[i].id === id) return CL.MODELS[i].label;
    return id;
  }

  var scroll = $("scroll");
  function nearBottom(){ return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 130; }
  function jumpToEnd(){ scroll.scrollTop = scroll.scrollHeight; }
  scroll.addEventListener("scroll", function(){
    $("jump").hidden = nearBottom() || $("thread").hidden;
  }, {passive:true});
  $("jump").addEventListener("click", function(){ jumpToEnd(); $("jump").hidden = true; });

  /* ---------------- errors ---------------- */
  function showError(msg){ $("alertText").textContent = msg; $("alert").hidden = false; }
  function clearError(){ $("alert").hidden = true; }
  $("alertClose").addEventListener("click", clearError);

  function friendlyError(status, detail){
    if(status === 401 || status === 403) return "OpenRouter rejected the API key. Open Settings and paste a current key.";
    if(status === 402) return "This OpenRouter account is out of credit for the selected model.";
    if(status === 404) return "OpenRouter does not recognise this model ID. Pick another model or correct it in Settings.";
    if(status === 429) return "Rate limited by OpenRouter. Wait a moment, then send again.";
    if(status >= 500) return "OpenRouter had a server error (" + status + "). Try again shortly.";
    return detail ? ("OpenRouter returned " + status + ": " + detail) : ("OpenRouter returned " + status + ".");
  }

  /* ---------------- sending ---------------- */
  function busy(on){
    var send = $("send");
    send.textContent = on ? "Stop" : "Send";
    send.classList.toggle("stop", on);
    if(on) send.setAttribute("aria-label","Stop generating"); else send.removeAttribute("aria-label");
    $("modelPick").disabled = on;
    $("regen").disabled = on;
    if(!on) controller = null;
  }

  async function ask(){
    var c = chat();
    if(!c) c = newChat();
    clearError();
    if(!data.settings.apiKey){
      showError("No API key yet. Open Settings and add your OpenRouter key.");
      openSettings(); return;
    }

    var modelId = data.settings.model;
    c.model = modelId;
    $("welcome").hidden = true; $("thread").hidden = false;

    var slotMsg = {role:"assistant", content:"", model:modelId, ts:Date.now()};
    var slot = paintMessage(slotMsg, -1);
    slot.body.innerHTML = '<span class="typing" aria-label="Waiting for the model"><i></i><i></i><i></i></span>';
    jumpToEnd();

    var acc = "", painting = false, finished = false, started = false;
    var caret = document.createElement("span");
    caret.className = "caret";

    function paint(){
      if(painting || finished) return;
      painting = true;
      requestAnimationFrame(function(){
        painting = false;
        if(finished) return;
        var stick = nearBottom();
        slot.body.innerHTML = CL.md(acc);
        var last = slot.body.lastElementChild;
        if(last && (last.tagName === "P" || last.tagName === "H3")) last.appendChild(caret);
        else if(last && (last.tagName === "UL" || last.tagName === "OL")) (last.lastElementChild || last).appendChild(caret);
        else slot.body.appendChild(caret);
        if(stick) jumpToEnd();
      });
    }

    controller = new AbortController();
    busy(true);

    var payload = {model:modelId, stream:true, messages:[]};
    if(data.settings.system && data.settings.system.trim()) payload.messages.push({role:"system", content:data.settings.system.trim()});
    payload.messages = payload.messages.concat(c.messages.map(function(m){ return {role:m.role, content:m.content}; }));
    if(typeof data.settings.temperature === "number") payload.temperature = data.settings.temperature;

    try{
      var res = await fetch(ENDPOINT, {
        method:"POST",
        headers:{
          "Authorization":"Bearer " + data.settings.apiKey,
          "Content-Type":"application/json",
          "HTTP-Referer": location.origin && location.origin !== "null" ? location.origin : "https://localhost",
          "X-Title":"CLINE AI"
        },
        body:JSON.stringify(payload),
        signal:controller.signal
      });
      if(!res.ok){
        var detail = "";
        try{ var j = await res.json(); detail = j && j.error && j.error.message ? j.error.message : ""; }catch(e){}
        throw {kind:"http", status:res.status, detail:detail};
      }
      if(!res.body) throw {kind:"nostream"};

      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
      for(;;){
        var r = await reader.read();
        if(r.done) break;
        buf += dec.decode(r.value, {stream:true});
        var lines = buf.split("\n");
        buf = lines.pop();
        for(var i=0;i<lines.length;i++){
          var line = lines[i].trim();
          if(!line || line.charAt(0) === ":" || line.indexOf("data:") !== 0) continue;
          var payloadLine = line.slice(5).trim();
          if(payloadLine === "[DONE]"){ buf = ""; break; }
          try{
            var obj = JSON.parse(payloadLine);
            var d = obj.choices && obj.choices[0] && obj.choices[0].delta;
            if(d && typeof d.content === "string" && d.content){
              acc += d.content; started = true; paint();
            }
          }catch(e){}
        }
      }
      finished = true;
      if(caret.parentNode) caret.remove();
      if(!acc){
        slot.el.remove();
        showError("The model returned an empty response. Try again or switch models.");
      }else{
        slotMsg.content = acc;
        c.messages.push(slotMsg);
        slot.body.innerHTML = CL.md(acc);
        wireCodeCopy(slot.el);
        touch(c); renderChats(); renderUsage(); renderThread();
      }
    }catch(err){
      finished = true;
      if(caret.parentNode) caret.remove();
      if(err && err.name === "AbortError"){
        if(acc){
          slotMsg.content = acc; c.messages.push(slotMsg);
          touch(c); renderUsage(); renderThread();
          CL.toast("Stopped. The partial reply was kept.", null, 2200);
        }else{
          slot.el.remove();
          if(!c.messages.length){ $("thread").hidden = true; $("welcome").hidden = false; }
        }
      }else{
        slot.el.remove();
        undoLastUser(c);
        if(err && err.kind === "http") showError(friendlyError(err.status, err.detail));
        else if(err && err.kind === "nostream") showError("This browser could not read the streamed response. Use a current version of Chrome, Edge, Safari or Firefox.");
        else showError("Could not reach OpenRouter. Check your connection, then send again.");
      }
    }finally{
      busy(false);
      if(!started) void 0;
      $("input").focus();
    }
  }

  function undoLastUser(c){
    var last = c.messages[c.messages.length - 1];
    if(last && last.role === "user"){
      c.messages.pop();
      if(!$("input").value.trim()){ $("input").value = last.content; grow(); }
    }
    persist(); renderUsage(); renderThread();
  }

  function submit(){
    if(controller){ controller.abort(); return; }
    var text = $("input").value.trim();
    if(!text) return;
    var c = chat() || newChat();
    c.messages.push({role:"user", content:text, ts:Date.now()});
    if(c.title === "New chat"){
      c.title = text.replace(/\s+/g," ").slice(0, 46) + (text.length > 46 ? "…" : "");
    }
    touch(c);
    $("input").value = ""; grow();
    renderThread(); renderChats(); renderUsage();
    ask();
  }

  function regenerate(){
    if(controller) return;
    var c = chat();
    if(!c || !c.messages.length) return;
    if(c.messages[c.messages.length - 1].role === "assistant") c.messages.pop();
    if(!c.messages.length) return;
    persist(); renderThread();
    ask();
  }
  $("regen").addEventListener("click", regenerate);

  /* ---------------- composer ---------------- */
  var input = $("input");
  function grow(){
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, innerHeight * 0.38) + "px";
    var n = input.value.length;
    $("count").textContent = n ? (n + " chars · ~" + Math.max(1, Math.round(n/4)) + " tokens") : "Enter to send";
  }
  input.addEventListener("input", grow);
  input.addEventListener("keydown", function(e){
    if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); submit(); }
  });
  $("send").addEventListener("click", submit);

  /* ---------------- model pickers ---------------- */
  function fillComposerPicker(){
    var sel = $("modelPick");
    sel.innerHTML = "";
    var seen = false;
    CL.MODELS.forEach(function(m){
      var o = document.createElement("option");
      o.value = m.id; o.textContent = m.label;
      if(m.id === data.settings.model){ o.selected = true; seen = true; }
      sel.appendChild(o);
    });
    if(!seen){
      var o2 = document.createElement("option");
      o2.value = data.settings.model; o2.textContent = data.settings.model; o2.selected = true;
      sel.insertBefore(o2, sel.firstChild);
    }
  }
  $("modelPick").addEventListener("change", function(){
    data.settings.model = this.value;
    var c = chat(); if(c) c.model = this.value;
    persist();
    CL.toast("Now using " + labelFor(this.value) + ".", null, 1800);
  });

  /* ---------------- presets ---------------- */
  var PRESETS = [
    ["Explain a trade-off","Compare Claude Opus and Sonnet for day-to-day coding work, with a recommendation."],
    ["Write code","Write a Python script that watches a folder and logs every new file with a timestamp."],
    ["Tighten writing","Rewrite this paragraph so it is half the length and twice as clear:\n\n"],
    ["Plan a build","I want to ship a small SaaS dashboard this month. Draft a realistic week-by-week plan."]
  ];
  $("presets").innerHTML = PRESETS.map(function(p, i){
    return '<button class="preset" type="button" data-i="' + i + '"><b>' + CL.esc(p[0]) +
      "</b><span>" + CL.esc(p[1].split("\n")[0].slice(0, 62)) + "</span></button>";
  }).join("");
  $("presets").addEventListener("click", function(e){
    var b = e.target.closest(".preset");
    if(!b) return;
    input.value = PRESETS[+b.getAttribute("data-i")][1];
    grow(); input.focus();
  });

  /* ---------------- settings ---------------- */
  var dlg = $("settings");
  var PERSONAS = [
    ["Default","You are a helpful assistant. Be accurate and concise."],
    ["Engineer","You are a senior software engineer. Give precise, working code with short explanations and call out edge cases."],
    ["Editor","You are a ruthless copy editor. Tighten prose, cut filler, keep the author's voice, and explain each major change in one line."],
    ["Analyst","You are a data analyst. Show your reasoning in steps, state assumptions explicitly, and flag anything the data cannot support."]
  ];
  (function(){
    var row = $("personaRow");
    PERSONAS.forEach(function(p){
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn secondary sm"; b.textContent = p[0];
      b.addEventListener("click", function(){ $("systemPrompt").value = p[1]; });
      row.appendChild(b);
    });
  })();
  (function(){
    var sel = $("modelSelect");
    CL.MODELS.forEach(function(m){
      var o = document.createElement("option");
      o.value = m.id; o.textContent = m.label + " — " + m.note;
      sel.appendChild(o);
    });
    var other = document.createElement("option");
    other.value = "__custom__"; other.textContent = "Other model ID…";
    sel.appendChild(other);
    sel.addEventListener("change", function(){
      var custom = sel.value === "__custom__";
      $("customWrap").hidden = !custom;
      if(custom) setTimeout(function(){ $("customModel").focus(); }, 0);
    });
  })();
  $("temp").addEventListener("input", function(){ $("tempVal").textContent = Number(this.value).toFixed(1); });

  function openSettings(){
    $("apiKey").value = data.settings.apiKey;
    $("apiKey").type = "password";
    $("revealKey").textContent = "Show"; $("revealKey").setAttribute("aria-pressed","false");
    $("systemPrompt").value = data.settings.system;
    $("temp").value = String(typeof data.settings.temperature === "number" ? data.settings.temperature : 0.7);
    $("tempVal").textContent = Number($("temp").value).toFixed(1);
    var known = CL.MODELS.some(function(m){ return m.id === data.settings.model; });
    $("modelSelect").value = known ? data.settings.model : "__custom__";
    $("customModel").value = known ? "" : data.settings.model;
    $("customWrap").hidden = known;
    dlg.showModal();
  }
  $("openSettings").addEventListener("click", openSettings);
  $("needKeyBtn").addEventListener("click", openSettings);
  $("cancelSettings").addEventListener("click", function(){ dlg.close(); });
  $("revealKey").addEventListener("click", function(){
    var k = $("apiKey"), shown = k.type === "text";
    k.type = shown ? "password" : "text";
    this.textContent = shown ? "Show" : "Hide";
    this.setAttribute("aria-pressed", String(!shown));
  });
  $("settingsForm").addEventListener("submit", function(){
    data.settings.apiKey = $("apiKey").value.trim();
    data.settings.system = $("systemPrompt").value;
    data.settings.temperature = Number($("temp").value);
    var chosen = $("modelSelect").value;
    data.settings.model = chosen === "__custom__" ? ($("customModel").value.trim() || data.settings.model) : chosen;
    persist(); fillComposerPicker(); reflectKey(); clearError();
    CL.toast("Settings saved.", "good");
  });
  $("wipe").addEventListener("click", function(){
    if(!confirm("Delete every chat, your key and this account from this browser? This cannot be undone.")) return;
    try{
      localStorage.removeItem(CL.K.data(user.id));
      var users = CL.auth.users().filter(function(u){ return u.id !== user.id; });
      CL.write(CL.K.users, users);
    }catch(e){}
    CL.auth.logOut();
    location.replace("index.html");
  });
  function reflectKey(){ $("needKey").hidden = !!data.settings.apiKey; }

  /* ---------------- export ---------------- */
  $("exportChat").addEventListener("click", function(){
    var c = chat();
    if(!c || !c.messages.length){ CL.toast("Nothing to export yet.", "bad"); return; }
    var lines = ["# " + c.title, "", "Model: " + labelFor(c.model), "Exported: " + new Date().toISOString(), ""];
    c.messages.forEach(function(m){
      lines.push("## " + (m.role === "user" ? "You" : labelFor(m.model || c.model)), "", m.content, "");
    });
    CL.download(c.title.replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").toLowerCase() + ".md", lines.join("\n"), "text/markdown;charset=utf-8");
    CL.toast("Markdown exported.", "good");
  });

  /* ---------------- sidebar controls ---------------- */
  var shell = $("shell");
  function narrow(){ return innerWidth <= 860; }
  function setSide(open){
    shell.classList.toggle("collapsed", !open);
    var scrim = document.querySelector(".scrim");
    if(open && narrow()){
      if(!scrim){
        scrim = document.createElement("button");
        scrim.className = "scrim"; scrim.type = "button"; scrim.setAttribute("aria-label","Close sidebar");
        scrim.addEventListener("click", function(){ setSide(false); });
        document.body.appendChild(scrim);
      }
    }else if(scrim) scrim.remove();
  }
  setSide(!narrow());
  $("toggleSide").addEventListener("click", function(){ setSide(shell.classList.contains("collapsed")); });
  $("closeSide").addEventListener("click", function(){ setSide(false); });
  addEventListener("resize", function(){
    var scrim = document.querySelector(".scrim");
    if(!narrow() && scrim) scrim.remove();
  });

  $("newChat").addEventListener("click", function(){
    if(controller) controller.abort();
    var c = chat();
    if(c && !c.messages.length){ CL.toast("This chat is already empty.", null, 1600); input.focus(); return; }
    newChat(); searchTerm = ""; $("searchChats").value = "";
    renderAll(); if(narrow()) setSide(false);
    input.focus();
  });
  $("searchChats").addEventListener("input", function(){ searchTerm = this.value.trim(); renderChats(); });
  $("signOut").addEventListener("click", function(){
    if(controller) controller.abort();
    CL.auth.logOut(); location.replace("index.html");
  });

  function open(id){
    if(controller) controller.abort();
    activeId = id;
    renderAll();
    if(narrow()) setSide(false);
    input.focus();
  }

  /* ---------------- command palette ---------------- */
  var pal = $("palette"), palIndex = 0, palItems = [];
  function commands(){
    var base = [
      {label:"New chat", hint:"Ctrl+Shift+O", run:function(){ $("newChat").click(); }},
      {label:"Open settings", hint:"Ctrl+,", run:openSettings},
      {label:"Export this chat as Markdown", run:function(){ $("exportChat").click(); }},
      {label:"Regenerate last reply", run:regenerate},
      {label:"Theme: light", run:function(){ CL.theme.set("light"); }},
      {label:"Theme: dark", run:function(){ CL.theme.set("dark"); }},
      {label:"Theme: match system", run:function(){ CL.theme.set("system"); }},
      {label:"Keyboard shortcuts", hint:"Ctrl+/", run:function(){ $("shortcuts").showModal(); }},
      {label:"Sign out", run:function(){ $("signOut").click(); }}
    ];
    data.chats.slice(0, 12).forEach(function(c){
      base.push({label:c.title, hint:"chat", run:function(){ open(c.id); }});
    });
    return base;
  }
  function renderPalette(){
    var term = $("paletteInput").value.trim().toLowerCase();
    palItems = commands().filter(function(c){ return !term || c.label.toLowerCase().indexOf(term) !== -1; });
    palIndex = 0;
    var ul = $("paletteList");
    ul.innerHTML = "";
    $("paletteNone").hidden = !!palItems.length;
    palItems.forEach(function(c, i){
      var li = document.createElement("li");
      if(i === 0) li.setAttribute("aria-selected","true");
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c.label;
      if(c.hint){
        var s = document.createElement("small");
        s.textContent = c.hint; b.appendChild(s);
      }
      b.addEventListener("click", function(){ pal.close(); c.run(); });
      li.appendChild(b); ul.appendChild(li);
    });
  }
  function movePalette(step){
    var lis = $("paletteList").children;
    if(!lis.length) return;
    lis[palIndex].removeAttribute("aria-selected");
    palIndex = (palIndex + step + lis.length) % lis.length;
    lis[palIndex].setAttribute("aria-selected","true");
    lis[palIndex].scrollIntoView({block:"nearest"});
  }
  function openPalette(){
    $("paletteInput").value = "";
    renderPalette();
    pal.showModal();
    $("paletteInput").focus();
  }
  $("openPalette").addEventListener("click", openPalette);
  $("paletteInput").addEventListener("input", renderPalette);
  $("paletteInput").addEventListener("keydown", function(e){
    if(e.key === "ArrowDown"){ e.preventDefault(); movePalette(1); }
    else if(e.key === "ArrowUp"){ e.preventDefault(); movePalette(-1); }
    else if(e.key === "Enter"){
      e.preventDefault();
      if(palItems[palIndex]){ pal.close(); palItems[palIndex].run(); }
    }
  });

  /* shortcuts dialog */
  var SHORTCUTS = [
    ["Command palette", MAC ? "⌘ K" : "Ctrl K"],
    ["New chat", MAC ? "⌘ ⇧ O" : "Ctrl Shift O"],
    ["Send message", "Enter"],
    ["New line", "Shift Enter"],
    ["Stop generating", "Esc"],
    ["Search chats", MAC ? "⌘ F" : "Ctrl F"],
    ["Settings", MAC ? "⌘ ," : "Ctrl ,"],
    ["This list", MAC ? "⌘ /" : "Ctrl /"]
  ];
  $("shortcutList").innerHTML = SHORTCUTS.map(function(s){
    return "<div><span>" + s[0] + '</span><span class="kbd">' + s[1] + "</span></div>";
  }).join("");
  $("closeShortcuts").addEventListener("click", function(){ $("shortcuts").close(); });
  $("paletteKbd").textContent = MAC ? "⌘K" : "Ctrl K";

  addEventListener("keydown", function(e){
    var meta = MAC ? e.metaKey : e.ctrlKey;
    if(meta && e.key.toLowerCase() === "k"){ e.preventDefault(); openPalette(); }
    else if(meta && e.shiftKey && e.key.toLowerCase() === "o"){ e.preventDefault(); $("newChat").click(); }
    else if(meta && e.key === ","){ e.preventDefault(); openSettings(); }
    else if(meta && e.key === "/"){ e.preventDefault(); $("shortcuts").showModal(); }
    else if(meta && e.key.toLowerCase() === "f"){ e.preventDefault(); setSide(true); $("searchChats").focus(); }
    else if(e.key === "Escape" && controller){ controller.abort(); }
  });

  /* ---------------- boot ---------------- */
  function renderAll(){ renderChats(); renderThread(); renderUsage(); }

  CL.theme.mount($("themeSwitch"));
  $("avatar").textContent = CL.auth.initials(user.name);
  $("userName").textContent = user.name;
  $("userEmail").textContent = user.email;
  $("welcomeTitle").textContent = "Ready when you are, " + user.name.split(" ")[0] + ".";
  if(!data.chats.length) newChat(); else activeId = data.chats[0].id;
  fillComposerPicker();
  reflectKey();
  renderAll();
  grow();
  input.focus();
})();
