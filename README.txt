CLINE AI — single-file chat client for OpenRouter
=================================================

WHAT IT IS
  cline-ai.html is a complete chat app in one file. No build step, no server,
  no dependencies. Open it in any modern browser (double-click, or host it
  anywhere that serves static files).

FIRST RUN
  1. Open cline-ai.html.
  2. Click Settings.
  3. Paste an OpenRouter API key — create one at https://openrouter.ai/keys
  4. Pick a default model and, if you want, edit the system prompt. Save.
  5. Type a message and press Enter.

WHAT IT DOES
  - Streams replies token by token from
    https://openrouter.ai/api/v1/chat/completions
  - Model picker in the composer: Claude Opus 4.1, Claude Sonnet 4.5,
    GPT-4o, GPT-4o mini, Gemini 2.5 Flash, Llama 3.3 70B, DeepSeek V3,
    plus "Other model ID…" in Settings for any ID on openrouter.ai/models
  - Keeps the conversation in memory and sends it with each request,
    prefixed by your system prompt
  - Stop button mid-answer, New chat to reset, Copy on any message
  - Enter sends, Shift+Enter adds a line
  - Light and dark mode follow your system setting; works down to ~390px
  - Plain-language errors for a bad key, no credit, unknown model,
    rate limits, server errors and network failures

WHERE YOUR KEY LIVES
  In this browser's localStorage, under the key "cline.ai.settings.v1".
  It is sent only to openrouter.ai. "Remove key" in Settings deletes it.

SECURITY NOTE — READ BEFORE SHARING
  The page calls OpenRouter directly from the browser, so the key is visible
  to anyone who can use that browser profile (and in devtools). That is fine
  for your own machine. If you want to put this on a shared or public URL,
  put a small server-side proxy in front of OpenRouter that holds the key and
  forwards requests, and point ENDPOINT in the file at that proxy instead.

FILES
  cline-ai.html   the app
  README.txt      this file
