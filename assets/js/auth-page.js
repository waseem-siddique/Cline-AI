/* CLINE AI — login / signup */
(function(){
  "use strict";
  CL.theme.mount(document.getElementById("themeSwitch"));
  if(CL.auth.current()){ location.replace("app.html"); return; }

  var q = new URLSearchParams(location.search);
  var mode = q.get("mode") === "signup" ? "signup" : "login";

  var el = {
    tabLogin:document.getElementById("tabLogin"), tabSignup:document.getElementById("tabSignup"),
    headline:document.getElementById("headline"), subhead:document.getElementById("subhead"),
    nameField:document.getElementById("nameField"), name:document.getElementById("name"),
    email:document.getElementById("email"), password:document.getElementById("password"),
    meter:document.getElementById("meter"), pwNote:document.getElementById("pwNote"),
    submit:document.getElementById("submit"), form:document.getElementById("form"),
    err:document.getElementById("formError"), altText:document.getElementById("altText"),
    altBtn:document.getElementById("altBtn"), reveal:document.getElementById("reveal"),
    remember:document.getElementById("remember")
  };

  function setMode(next){
    mode = next;
    var signup = mode === "signup";
    el.tabLogin.setAttribute("aria-selected", String(!signup));
    el.tabSignup.setAttribute("aria-selected", String(signup));
    el.headline.textContent = signup ? "Create your workspace" : "Welcome back";
    el.subhead.textContent = signup
      ? "One local account keeps your chats, key and preferences together."
      : "Log in to reach your saved conversations.";
    el.nameField.hidden = !signup;
    el.meter.hidden = !signup;
    el.pwNote.hidden = !signup;
    el.submit.textContent = signup ? "Create account" : "Log in";
    el.password.setAttribute("autocomplete", signup ? "new-password" : "current-password");
    el.altText.textContent = signup ? "Already have an account?" : "New to CLINE AI?";
    el.altBtn.textContent = signup ? "Log in instead" : "Create an account";
    document.title = (signup ? "Sign up" : "Log in") + " · CLINE AI";
    hideError();
    (signup ? el.name : el.email).focus();
  }
  function showError(msg){ el.err.textContent = msg; el.err.hidden = false; }
  function hideError(){ el.err.hidden = true; }

  el.tabLogin.addEventListener("click", function(){ setMode("login"); });
  el.tabSignup.addEventListener("click", function(){ setMode("signup"); });
  el.altBtn.addEventListener("click", function(){ setMode(mode === "signup" ? "login" : "signup"); });

  el.reveal.addEventListener("click", function(){
    var shown = el.password.type === "text";
    el.password.type = shown ? "password" : "text";
    el.reveal.textContent = shown ? "Show" : "Hide";
    el.reveal.setAttribute("aria-pressed", String(!shown));
  });

  el.password.addEventListener("input", function(){
    var v = el.password.value, score = 0;
    if(v.length >= 8) score++;
    if(v.length >= 12) score++;
    if(/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if(/\d/.test(v)) score++;
    if(/[^A-Za-z0-9]/.test(v)) score++;
    var pct = Math.min(100, score * 20);
    el.meter.querySelector("i").style.width = pct + "%";
    el.meter.classList.toggle("mid", score >= 3 && score < 5);
    el.meter.classList.toggle("ok", score >= 5);
  });

  document.getElementById("forgot").addEventListener("click", function(){
    CL.toast("No server, no reset email. Sign up again with the same email after clearing site data.", "bad", 4200);
  });

  el.form.addEventListener("submit", async function(e){
    e.preventDefault();
    hideError();
    el.submit.disabled = true;
    var was = el.submit.textContent;
    el.submit.textContent = mode === "signup" ? "Creating…" : "Checking…";
    try{
      if(mode === "signup") await CL.auth.signUp(el.name.value, el.email.value, el.password.value);
      else await CL.auth.logIn(el.email.value, el.password.value, el.remember.checked);
      location.href = "app.html";
    }catch(err){
      showError(err.message || "Something went wrong. Try again.");
      el.submit.disabled = false;
      el.submit.textContent = was;
    }
  });

  setMode(mode);
})();
