(function () {
  const script = document.currentScript;
  if (!script || window.SignalHostChatLoaded) return;
  window.SignalHostChatLoaded = true;

  const config = {
    accentColor: script.dataset.accentColor || script.dataset.primaryColor || "#d84824",
    greeting: script.dataset.greeting || "",
    locationId: script.dataset.locationId || "",
    position: script.dataset.position || "right",
    primaryColor: script.dataset.primaryColor || "#211713",
    subtitle: script.dataset.subtitle || "Usually replies right away",
    title: script.dataset.title || "SignalHost",
    voiceServiceUrl: (script.dataset.voiceServiceUrl || "").replace(/\/$/, ""),
  };
  const quickPrompts = parseList(script.dataset.prompts) || [
    "What are your hours?",
    "Can I book?",
    "Can I get a link?",
  ];

  if (!config.voiceServiceUrl) {
    console.warn("[SignalHost Chat] Missing data-voice-service-url.");
  }

  const style = document.createElement("style");
  style.textContent = `
    .signalhost-chat-root{--sh-primary:${config.primaryColor};--sh-accent:${config.accentColor};position:fixed;bottom:20px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#211713}
    .signalhost-chat-root[data-position="left"]{left:20px}.signalhost-chat-root[data-position="right"]{right:20px}
    .signalhost-chat-button{display:flex;align-items:center;gap:10px;border:0;border-radius:999px;background:var(--sh-primary);color:#fff;padding:13px 16px;font-size:14px;font-weight:750;box-shadow:0 18px 48px rgba(33,23,19,.24);cursor:pointer}
    .signalhost-chat-button-mark{display:grid;height:26px;width:26px;place-items:center;border-radius:999px;background:var(--sh-accent);font-size:15px;line-height:1}
    .signalhost-chat-button:hover{transform:translateY(-1px)}
    .signalhost-chat-panel{display:none;width:min(390px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));overflow:hidden;border:1px solid rgba(33,23,19,.16);border-radius:14px;background:#fff;box-shadow:0 26px 80px rgba(33,23,19,.26)}
    .signalhost-chat-root[data-open="true"] .signalhost-chat-panel{display:flex;flex-direction:column}.signalhost-chat-root[data-open="true"] .signalhost-chat-button{display:none}
    .signalhost-chat-header{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--sh-primary);color:#fff;padding:15px 16px}
    .signalhost-chat-brand{display:flex;min-width:0;align-items:center;gap:10px}.signalhost-chat-avatar{display:grid;height:36px;width:36px;place-items:center;border-radius:10px;background:var(--sh-accent);font-weight:800}
    .signalhost-chat-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:800}.signalhost-chat-subtitle{margin-top:1px;font-size:12px;color:rgba(255,255,255,.72)}
    .signalhost-chat-close{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:9px;width:32px;height:32px;cursor:pointer}
    .signalhost-chat-messages{flex:1;display:flex;flex-direction:column;gap:10px;overflow-y:auto;background:#faf7f3;padding:14px}
    .signalhost-chat-message{max-width:84%;border-radius:12px;padding:10px 11px;font-size:14px;line-height:1.43;box-shadow:0 1px 2px rgba(33,23,19,.06);white-space:pre-wrap}
    .signalhost-chat-message[data-role="assistant"]{align-self:flex-start;border:1px solid rgba(33,23,19,.12);background:#fff}.signalhost-chat-message[data-role="user"]{align-self:flex-end;background:var(--sh-accent);color:#fff}
    .signalhost-chat-actions{display:flex;flex-direction:column;gap:8px;align-self:flex-start;width:min(300px,88%)}.signalhost-chat-action{display:block;border:1px solid rgba(216,72,36,.22);border-radius:10px;background:#fff7f3;padding:10px 11px;color:#211713;text-decoration:none;font-size:13px;font-weight:700}.signalhost-chat-action span{display:block;margin-top:2px;color:rgba(33,23,19,.62);font-size:12px;font-weight:500}
    .signalhost-chat-prompts{display:flex;flex-wrap:wrap;gap:7px;border-top:1px solid rgba(33,23,19,.08);background:#fff;padding:10px 12px 0}.signalhost-chat-prompt{border:1px solid rgba(33,23,19,.12);border-radius:999px;background:#fff;color:#4b3931;padding:7px 9px;font-size:12px;cursor:pointer}.signalhost-chat-prompt:hover{border-color:var(--sh-accent);color:var(--sh-accent)}
    .signalhost-chat-contact{display:none;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid rgba(33,23,19,.08);background:#fff;padding:10px 12px 0}.signalhost-chat-root[data-contact="true"] .signalhost-chat-contact{display:grid}.signalhost-chat-contact input{min-width:0;border:1px solid rgba(33,23,19,.14);border-radius:9px;padding:9px 10px;font-size:13px;outline:none}
    .signalhost-chat-form{display:flex;gap:8px;background:#fff;padding:12px}.signalhost-chat-input{min-width:0;flex:1;border:1px solid rgba(33,23,19,.16);border-radius:10px;padding:11px 12px;font-size:14px;outline:none}.signalhost-chat-input:focus,.signalhost-chat-contact input:focus{border-color:var(--sh-accent);box-shadow:0 0 0 3px rgba(216,72,36,.13)}
    .signalhost-chat-send{border:0;border-radius:10px;background:var(--sh-accent);color:#fff;padding:0 14px;font-size:14px;font-weight:750;cursor:pointer}.signalhost-chat-send:disabled{cursor:not-allowed;opacity:.58}
    .signalhost-chat-footer{padding:0 12px 12px;background:#fff;color:rgba(33,23,19,.5);font-size:11px}.signalhost-chat-typing{align-self:flex-start;border:1px solid rgba(33,23,19,.12);border-radius:12px;background:#fff;padding:10px 11px;color:rgba(33,23,19,.62);font-size:13px}
    @media (max-width:520px){.signalhost-chat-root{right:12px!important;left:12px!important;bottom:12px}.signalhost-chat-panel{width:calc(100vw - 24px);height:calc(100vh - 44px)}}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "signalhost-chat-root";
  root.dataset.open = "false";
  root.dataset.position = config.position === "left" ? "left" : "right";
  root.innerHTML = `
    <button class="signalhost-chat-button" type="button" aria-label="Open chat">
      <span class="signalhost-chat-button-mark">●</span>
      <span>Chat with us</span>
    </button>
    <section class="signalhost-chat-panel" aria-label="Website chat">
      <header class="signalhost-chat-header">
        <div class="signalhost-chat-brand">
          <div class="signalhost-chat-avatar">SH</div>
          <div>
            <div class="signalhost-chat-title"></div>
            <div class="signalhost-chat-subtitle"></div>
          </div>
        </div>
        <button class="signalhost-chat-close" type="button" aria-label="Close chat">×</button>
      </header>
      <div class="signalhost-chat-messages"></div>
      <div class="signalhost-chat-prompts"></div>
      <div class="signalhost-chat-contact">
        <input class="signalhost-chat-name" autocomplete="name" placeholder="Name, optional" />
        <input class="signalhost-chat-phone" autocomplete="tel" placeholder="Phone, optional" />
      </div>
      <form class="signalhost-chat-form">
        <input class="signalhost-chat-input" name="message" autocomplete="off" placeholder="Ask a question..." />
        <button class="signalhost-chat-send" type="submit">Send</button>
      </form>
      <div class="signalhost-chat-footer">Powered by SignalHost</div>
    </section>
  `;
  document.body.appendChild(root);

  const openButton = root.querySelector(".signalhost-chat-button");
  const closeButton = root.querySelector(".signalhost-chat-close");
  const title = root.querySelector(".signalhost-chat-title");
  const subtitle = root.querySelector(".signalhost-chat-subtitle");
  const avatar = root.querySelector(".signalhost-chat-avatar");
  const messagesEl = root.querySelector(".signalhost-chat-messages");
  const promptsEl = root.querySelector(".signalhost-chat-prompts");
  const form = root.querySelector(".signalhost-chat-form");
  const input = root.querySelector(".signalhost-chat-input");
  const sendButton = root.querySelector(".signalhost-chat-send");
  const nameInput = root.querySelector(".signalhost-chat-name");
  const phoneInput = root.querySelector(".signalhost-chat-phone");

  title.textContent = config.title;
  subtitle.textContent = config.subtitle;
  avatar.textContent = initials(config.title);

  let pending = false;
  let messages = [
    {
      at: new Date().toISOString(),
      role: "assistant",
      text: config.greeting || `Hi, thanks for reaching out to ${config.title}. How can I help?`,
    },
  ];
  let lastActions = [];

  for (const prompt of quickPrompts.slice(0, 4)) {
    const button = document.createElement("button");
    button.className = "signalhost-chat-prompt";
    button.type = "button";
    button.textContent = prompt;
    button.addEventListener("click", () => sendMessage(prompt));
    promptsEl.appendChild(button);
  }

  openButton.addEventListener("click", () => {
    root.dataset.open = "true";
    input.focus();
  });
  closeButton.addEventListener("click", () => {
    root.dataset.open = "false";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  renderMessages();

  async function sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || !config.voiceServiceUrl || pending) return;

    const transcript = messages.slice(-12);
    messages = messages.concat({
      at: new Date().toISOString(),
      role: "user",
      text,
    });
    input.value = "";
    pending = true;
    sendButton.disabled = true;
    root.dataset.contact = shouldShowContact(text) ? "true" : root.dataset.contact || "false";
    renderMessages();

    try {
      const response = await fetch(`${config.voiceServiceUrl}/web-chat/message`, {
        body: JSON.stringify({
          locationId: config.locationId,
          message: text,
          transcript,
          visitorId: getVisitorId(),
          visitorName: nameInput.value.trim() || undefined,
          visitorPhone: phoneInput.value.trim() || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
      const result = await response.json();
      lastActions = Array.isArray(result.actions) ? result.actions : [];
      messages = Array.isArray(result.transcript) && result.transcript.length
        ? result.transcript
        : messages.concat({
          at: new Date().toISOString(),
          role: "assistant",
          text: result.reply || "I can help with that. What else should I know?",
        });
      if (lastActions.some((action) => action.type === "customer_request")) {
        root.dataset.contact = "true";
      }
    } catch (error) {
      console.warn("[SignalHost Chat] Message failed.", error);
      lastActions = [];
      messages = messages.concat({
        at: new Date().toISOString(),
        role: "assistant",
        text: "Sorry, I hit a quick connection issue. Please try again in a moment.",
      });
    } finally {
      pending = false;
      sendButton.disabled = false;
      renderMessages();
      input.focus();
    }
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    for (const message of messages) {
      const bubble = document.createElement("div");
      bubble.className = "signalhost-chat-message";
      bubble.dataset.role = message.role === "user" ? "user" : "assistant";
      bubble.textContent = message.text;
      messagesEl.appendChild(bubble);
    }
    renderActions();
    if (pending) {
      const typing = document.createElement("div");
      typing.className = "signalhost-chat-typing";
      typing.textContent = "Checking that now...";
      messagesEl.appendChild(typing);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderActions() {
    const linkActions = lastActions.filter((action) => action.type === "business_link" && action.link && action.link.url);
    if (!linkActions.length) return;

    const wrapper = document.createElement("div");
    wrapper.className = "signalhost-chat-actions";
    for (const action of linkActions) {
      const link = document.createElement("a");
      link.className = "signalhost-chat-action";
      link.href = action.link.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = action.link.label || "Open link";
      const detail = document.createElement("span");
      detail.textContent = action.link.description || action.link.url;
      link.appendChild(detail);
      wrapper.appendChild(link);
    }
    messagesEl.appendChild(wrapper);
  }

  function shouldShowContact(text) {
    return /\b(call|callback|text|reservation|appointment|book|quote|estimate|order|manager|staff|human|complaint|allergy)\b/i.test(text);
  }

  function getVisitorId() {
    const key = "signalhost.chat.visitorId";
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = `web_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  }

  function parseList(value) {
    const items = String(value || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : null;
  }

  function initials(value) {
    return String(value || "SH")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.match(/[A-Za-z0-9]/)?.[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SH";
  }
})();
