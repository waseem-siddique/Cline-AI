# CLINE AI

A browser-native chat client for nine model providers — **OpenRouter, OpenAI, Anthropic, Google
Gemini, Groq, Mistral, DeepSeek, xAI** and any OpenAI-compatible endpoint (Ollama, LM Studio, a
proxy). Switch provider and model mid-conversation and the thread follows. Ships with a marketing
landing page, local accounts, saved conversations and a light/dark theme switch.

Styled to match the **CampusPulse** design language: warm cream canvas, terracotta accent, serif
display type, uppercase tracked labels, near-black primary buttons, and a warm near-black dark
mode. Every page opens with a short ring-spinner splash (~0.5s) before revealing the UI.

Developed by **Mohammed Waseem Siddique** ·
[GitHub](https://github.com/waseem-siddique/) ·
[LinkedIn](https://www.linkedin.com/in/waseemop/)

---

## How to run

There is no build step and no dependencies. Any static file server works.

**Option A — Python (recommended)**

```bash
cd cline-ai
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

**Option B — Node**

```bash
cd cline-ai
npx serve .        # or: npx http-server -p 8000
```

**Option C — double-click `index.html`**

It works, but a local server is better: on `file://` some browsers disable the Web Crypto API, and
the app then falls back to a weaker password hash (it warns you by still working, just less safely).

### First run

1. Open the landing page and choose **Get started**.
2. Create an account — name, email, password (8+ characters). It is stored in this browser only.
3. In the workspace, open **Settings**, choose a provider and paste its API key. You can add keys
   for several providers in one visit — pick each from the Provider dropdown, paste, then Save.
4. Pick a provider and model under the composer and send a message.

### Providers and keys

| Provider | Key from | Browser-callable |
| --- | --- | --- |
| OpenRouter | openrouter.ai/keys | yes |
| OpenAI | platform.openai.com/api-keys | blocked by CORS — use a proxy or OpenRouter |
| Anthropic | console.anthropic.com | yes (direct browser access header is sent) |
| Google Gemini | aistudio.google.com/apikey | yes |
| Groq | console.groq.com/keys | yes |
| Mistral | console.mistral.ai/api-keys | yes |
| DeepSeek | platform.deepseek.com | yes |
| xAI | console.x.ai | yes |
| Custom (OpenAI-compatible) | your own | depends on your server's CORS |

Every provider row also accepts an **API base URL** override, so you can point CLINE AI at Ollama,
LM Studio, vLLM or your own proxy.

---

## What's included

**Landing page (`index.html`)**
- Animated aurora hero, scrolling model marquee, scroll-reveal sections, animated counters
- Feature grid, three-step onboarding, FAQ accordion, final call to action
- Footer credit with GitHub and LinkedIn links
- Sticky nav with the theme switch; CTAs change to "Open app" once you are signed in

**Accounts (`auth.html`)**
- Combined login / signup with tabbed switching and inline validation
- Live password-strength meter, show/hide password, "Keep me signed in"
- PBKDF2-SHA256 password hashing (120k iterations) with a per-account salt
- Signed-in visitors are redirected straight to the workspace; the workspace redirects back here

**Workspace (`app.html`)**
- Streaming replies over server-sent events, with **Stop** mid-answer and **Regenerate**
- Unlimited saved chats: auto-titles, full-text search, delete, per-chat model memory
- Provider picker **and** model picker in the composer — switch either mid-chat and the full
  conversation is replayed to the new provider (OpenAI, Anthropic and Gemini wire formats are all
  handled, including their different streaming events)
- Any custom model ID per provider
- Command palette (`Ctrl/⌘ K`) over commands and chats, and a shortcuts sheet (`Ctrl/⌘ /`)
- Settings: per-provider API keys, optional base URL, default provider and model, system prompt
  with four persona presets, creativity slider
- Usage meter estimating messages and tokens per workspace
- Markdown rendering with per-block code copy, message copy, edit-and-resend
- Export any chat to Markdown
- Light / System / Dark switch, remembered across pages and sessions
- Splash screen on load: rotating ring with the brand dot and a tracked wordmark, then a fade-out
  (skipped gracefully if the page is already loaded; honours reduced-motion)
- Toasts, empty states, and plain-language errors for bad keys, no credit, unknown models,
  rate limits, server errors and network failures
- Off-canvas sidebar on small screens; responsive from 320px to ultrawide
- The document never scrolls: the transcript is the only scroll container, so the header, sidebar
  and composer stay pinned no matter how long a reply is
- Every animation respects `prefers-reduced-motion`

### Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Command palette | `Ctrl/⌘ K` |
| New chat | `Ctrl/⌘ Shift O` |
| Search chats | `Ctrl/⌘ F` |
| Settings | `Ctrl/⌘ ,` |
| Shortcut list | `Ctrl/⌘ /` |
| Send / new line | `Enter` / `Shift Enter` |
| Stop generating | `Esc` |

---

## Files

```
cline-ai/
├── index.html              landing page
├── auth.html               login + signup
├── app.html                chat workspace
├── assets/css/base.css     design tokens, buttons, fields, dialogs, toasts, theme switch
├── assets/css/landing.css  landing + auth layout and animations
├── assets/css/app.css      workspace layout, transcript, composer, palette
├── assets/js/core.js       theme, storage, accounts, markdown, toasts, provider registry
├── assets/js/landing.js    landing interactions
├── assets/js/auth-page.js  login / signup logic
├── assets/js/app.js        workspace logic and multi-provider streaming
└── README.md
```

## Where your data lives

Everything is in this browser's `localStorage`:

| Key | Contents |
| --- | --- |
| `cline.theme` | `light`, `dark` or `system` |
| `cline.users.v1` | accounts: name, email, salt, password hash |
| `cline.session.v1` | which account is signed in |
| `cline.data.<userId>` | that account's API keys, settings and chats |

Nothing is uploaded. `Settings → Delete all my data` removes the account and its chats.

## Honest limitations

- **Auth is local, not secure.** There is no backend, so sign-up and login are verified in the
  browser. Anyone with devtools access can read `localStorage`. Treat accounts as profile
  separation on a shared machine, not as a security boundary.
- **The API keys are in the browser.** Fine on your own machine. Before hosting this publicly, add
  a small server-side proxy that holds the keys, then set that proxy as the base URL in Settings.
- **CORS is the provider's call.** OpenAI rejects direct browser requests; use OpenRouter or a
  proxy for GPT models. OpenRouter, Anthropic, Gemini and Groq all allow them.
- **Costs are yours.** The app is free; each provider bills your key per token.
- **Model IDs change.** If a listed model 404s, check the provider's current IDs and paste one into
  Settings → Other model ID.
