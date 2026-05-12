(function () {
  const script = document.currentScript;
  if (!script || window.HostLineChatLoaded) return;
  window.HostLineChatLoaded = true;

  const config = {
    locationId: script.dataset.locationId || "",
    primaryColor: script.dataset.primaryColor || "#d84824",
    title: script.dataset.title || "HostLine AI",
    voiceServiceUrl: (script.dataset.voiceServiceUrl || "").replace(/\/$/, ""),
  };

  if (!config.voiceServiceUrl) {
    console.warn("[HostLine Chat] Missing data-voice-service-url.");
  }

  const style = document.createElement("style");
  style.textContent = `
    .hline-chat-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#211713}
    .hline-chat-button{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;background:var(--hline-primary);color:#fff;padding:13px 16px;font-size:14px;font-weight:700;box-shadow:0 16px 40px rgba(33,23,19,.22);cursor:pointer}
    .hline-chat-panel{display:none;width:min(380px,calc(100vw - 32px));height:min(580px,calc(100vh - 104px));overflow:hidden;border:1px solid rgba(33,23,19,.16);border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(33,23,19,.24)}
    .hline-chat-root[data-open="true"] .hline-chat-panel{display:flex;flex-direction:column}
    .hline-chat-root[data-open="true"] .hline-chat-button{display:none}
    .hline-chat-header{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#211713;color:#fff;padding:14px 16px}
    .hline-chat-title{font-size:14px;font-weight:800}
    .hline-chat-subtitle{font-size:12px;color:rgba(255,255,255,.72)}
    .hline-chat-close{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer}
    .hline-chat-messages{flex:1;display:flex;flex-direction:column;gap:10px;overflow-y:auto;background:#faf7f3;padding:14px}
    .hline-chat-message{max-width:84%;border-radius:10px;padding:10px 11px;font-size:14px;line-height:1.42;box-shadow:0 1px 2px rgba(33,23,19,.06)}
    .hline-chat-message[data-role="assistant"]{align-self:flex-start;border:1px solid rgba(33,23,19,.12);background:#fff}
    .hline-chat-message[data-role="user"]{align-self:flex-end;background:var(--hline-primary);color:#fff}
    .hline-chat-form{display:flex;gap:8px;border-top:1px solid rgba(33,23,19,.12);background:#fff;padding:12px}
    .hline-chat-input{min-width:0;flex:1;border:1px solid rgba(33,23,19,.16);border-radius:9px;padding:11px 12px;font-size:14px;outline:none}
    .hline-chat-input:focus{border-color:var(--hline-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--hline-primary) 16%,transparent)}
    .hline-chat-send{border:0;border-radius:9px;background:var(--hline-primary);color:#fff;padding:0 14px;font-size:14px;font-weight:700;cursor:pointer}
    .hline-chat-send:disabled{cursor:not-allowed;opacity:.58}
    @media (max-width:520px){.hline-chat-root{right:12px;bottom:12px}.hline-chat-panel{width:calc(100vw - 24px);height:calc(100vh - 48px)}}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "hline-chat-root";
  root.style.setProperty("--hline-primary", config.primaryColor);
  root.innerHTML = `
    <button class="hline-chat-button" type="button" aria-label="Open chat">Chat with us</button>
    <section class="hline-chat-panel" aria-label="Website chat">
      <header class="hline-chat-header">
        <div>
          <div class="hline-chat-title"></div>
          <div class="hline-chat-subtitle">Usually replies right away</div>
        </div>
        <button class="hline-chat-close" type="button" aria-label="Close chat">x</button>
      </header>
      <div class="hline-chat-messages"></div>
      <form class="hline-chat-form">
        <input class="hline-chat-input" name="message" autocomplete="off" placeholder="Ask a question..." />
        <button class="hline-chat-send" type="submit">Send</button>
      </form>
    </section>
  `;
  document.body.appendChild(root);

  const openButton = root.querySelector(".hline-chat-button");
  const closeButton = root.querySelector(".hline-chat-close");
  const title = root.querySelector(".hline-chat-title");
  const messagesEl = root.querySelector(".hline-chat-messages");
  const form = root.querySelector(".hline-chat-form");
  const input = root.querySelector(".hline-chat-input");
  const sendButton = root.querySelector(".hline-chat-send");
  title.textContent = config.title;

  let messages = [
    {
      at: new Date().toISOString(),
      role: "assistant",
      text: "Hi, thanks for reaching out. How can I help?",
    },
  ];

  openButton.addEventListener("click", () => {
    root.dataset.open = "true";
    input.focus();
  });
  closeButton.addEventListener("click", () => {
    root.dataset.open = "false";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !config.voiceServiceUrl) return;

    const transcript = messages.slice(-12);
    messages = messages.concat({
      at: new Date().toISOString(),
      role: "user",
      text,
    });
    input.value = "";
    sendButton.disabled = true;
    renderMessages();

    try {
      const response = await fetch(`${config.voiceServiceUrl}/web-chat/message`, {
        body: JSON.stringify({
          locationId: config.locationId,
          message: text,
          transcript,
          visitorId: getVisitorId(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
      const result = await response.json();
      messages = Array.isArray(result.transcript) && result.transcript.length
        ? result.transcript
        : messages.concat({
          at: new Date().toISOString(),
          role: "assistant",
          text: result.reply || "I can help with that. What else should I know?",
        });
    } catch (error) {
      console.warn("[HostLine Chat] Message failed.", error);
      messages = messages.concat({
        at: new Date().toISOString(),
        role: "assistant",
        text: "Sorry, I hit a quick connection issue. Please try again in a moment.",
      });
    } finally {
      sendButton.disabled = false;
      renderMessages();
      input.focus();
    }
  });

  renderMessages();

  function renderMessages() {
    messagesEl.innerHTML = "";
    for (const message of messages) {
      const bubble = document.createElement("div");
      bubble.className = "hline-chat-message";
      bubble.dataset.role = message.role === "user" ? "user" : "assistant";
      bubble.textContent = message.text;
      messagesEl.appendChild(bubble);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function getVisitorId() {
    const key = "hostline.chat.visitorId";
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = `web_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  }
})();
