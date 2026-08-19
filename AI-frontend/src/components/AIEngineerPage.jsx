import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Backend wiring. VITE_AI_BACKEND_URL is read from the Vite env at build/dev
// time; falls back to localhost for local dev. The AI-backend /chat endpoint
// accepts { message } and returns { intent, intent_label, data, reply } — we
// map `reply` to the assistant bubble's `text`.
// ---------------------------------------------------------------------------
const AI_BACKEND_URL =
  import.meta.env.VITE_AI_BACKEND_URL || "https://solar-calculator001-3-5qgs.onrender.com";

async function askAIEngineer(text) {
  const response = await fetch(`${AI_BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });
  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      detail = `${response.status} ${response.statusText}`;
    }
    throw new Error(detail || "Failed to get response from AI-Engineer.");
  }
  const data = await response.json();
  if (!data?.reply) {
    throw new Error("AI-Engineer returned an empty response.");
  }
  return data.reply;
}

const STARTERS = [
  "Tubular vs lithium — which is better for me?",
  "Explain series vs parallel wiring",
  "What are peak sun hours?",
  "How do I size an inverter for surge?",
];


const CLIP_PANEL = "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))";
const CLIP_BTN = "polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))";


export default function AIEngineerPage() {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "I'm the AI-Engineer — ask me anything about solar sizing, batteries, wiring, or panels. I stay on solar; for anything else, use the load audit or request a callback with a licensed engineer.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const threadRef = useRef(null);


  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);


  async function send(text) {
    const clean = text.trim();
    if (!clean || thinking) return;
    setMessages((m) => [...m, { role: "user", text: clean }]);
    setInput("");
    setThinking(true);

    try {
      const reply = await askAIEngineer(clean);
      setMessages((m) => [...m, { role: "ai", text: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: `⚠️ ${err.message || "Couldn't reach the AI-Engineer. Make sure the backend is running."}` },
      ]);
    } finally {
      setThinking(false);
    }
  }


  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }


  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        .ae-scroll::-webkit-scrollbar { width: 6px; }
        .ae-scroll::-webkit-scrollbar-thumb { background: #263021; border-radius: 3px; }
        .ae-starter:hover { border-color: #76B900 !important; color: #EAF2E4 !important; }
        .ae-send:hover { background: #9FEF00 !important; }
        .ae-back:hover { color: #EAF2E4 !important; }
        @keyframes ae-dot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
        .ae-typing span { animation: ae-dot 1.2s infinite; display: inline-block; }
        .ae-typing span:nth-child(2) { animation-delay: 0.15s; }
        .ae-typing span:nth-child(3) { animation-delay: 0.3s; }
        @media (max-width: 640px) {
          .ae-starters { grid-template-columns: 1fr !important; }
        }
      `}</style>


      <nav style={s.nav}>
        <div style={s.logo}>
          <span style={s.logoMark} />
          VOLTRA
        </div>
        <a href="#" className="ae-back" style={s.backLink}>← Back to Voltra</a>
      </nav>


      <div style={s.frameOuter}>
        <div style={s.frame}>
          <div style={s.frameHead}>
            <span style={s.headerBadge} />
            <div>
              <div style={s.frameTitle}>AI-ENGINEER</div>
              <div style={s.frameSub}>Solar sizing, batteries, wiring, panels — nothing else.</div>
            </div>
          </div>


          <div ref={threadRef} className="ae-scroll" style={s.thread}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "ai" ? "flex-start" : "flex-end" }}>
                <div style={m.role === "ai" ? s.bubbleAI : s.bubbleUser}>{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ ...s.bubbleAI, ...s.typingBubble }} className="ae-typing">
                  <span>●</span><span>●</span><span>●</span>
                </div>
              </div>
            )}
          </div>


          {messages.length === 1 && (
            <div className="ae-starters" style={s.starters}>
              {STARTERS.map((q) => (
                <button key={q} className="ae-starter" style={s.starterBtn} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}


          <div style={s.inputRow}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about sizing, batteries, wiring, panels..."
              style={s.textarea}
              rows={2}
            />
            <button className="ae-send" style={s.sendBtn} onClick={() => send(input)} disabled={thinking}>
              Send
            </button>
          </div>
          <div style={s.disclaimer}>
            For installation-specific or code decisions, request a callback with a licensed engineer instead.
          </div>
        </div>
      </div>
    </div>
  );
}


const s = {
  page: {
    minHeight: "100vh",
    background: "#090C08",
    color: "#EAF2E4",
    fontFamily: "'Inter', sans-serif",
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "22px 48px",
    borderBottom: "1px solid #1E2718",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: "22px",
    letterSpacing: "0.08em",
  },
  logoMark: { width: "10px", height: "10px", background: "#76B900" },
  backLink: { color: "#7C8A72", fontSize: "13px", textDecoration: "none" },
  frameOuter: {
    display: "flex",
    justifyContent: "center",
    padding: "48px 20px 64px",
  },
  frame: {
    width: "100%",
    maxWidth: "680px",
    background: "#12160F",
    border: "1px solid #263021",
    clipPath: CLIP_PANEL,
    display: "flex",
    flexDirection: "column",
  },
  frameHead: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 24px",
    borderBottom: "1px solid #263021",
  },
  headerBadge: { width: "9px", height: "9px", background: "#9FEF00", flexShrink: 0 },
  frameTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: "16px",
    letterSpacing: "0.06em",
  },
  frameSub: { fontSize: "12px", color: "#7C8A72", marginTop: "2px" },
  thread: {
    minHeight: "360px",
    maxHeight: "460px",
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  bubbleAI: {
    background: "#F2F5EE",
    color: "#10140D",
    fontSize: "14px",
    lineHeight: 1.6,
    padding: "12px 16px",
    maxWidth: "85%",
  },
  bubbleUser: {
    background: "#151B10",
    border: "1px solid #4A5C3C",
    color: "#EAF2E4",
    fontSize: "14px",
    lineHeight: 1.6,
    padding: "12px 16px",
    maxWidth: "85%",
  },
  typingBubble: { display: "flex", gap: "4px", padding: "14px 16px" },
  starters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    padding: "0 24px 20px",
  },
  starterBtn: {
    background: "#0E120C",
    border: "1px solid #263021",
    color: "#A8B39F",
    fontSize: "12px",
    textAlign: "left",
    padding: "10px 12px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  inputRow: {
    display: "flex",
    gap: "10px",
    padding: "16px 24px 8px",
    borderTop: "1px solid #263021",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    resize: "none",
    background: "#0E120C",
    border: "1px solid #263021",
    color: "#EAF2E4",
    fontFamily: "'Inter', sans-serif",
    fontSize: "14px",
    padding: "10px 14px",
    outline: "none",
  },
  sendBtn: {
    background: "#76B900",
    color: "#090C08",
    border: "none",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600,
    fontSize: "13px",
    padding: "11px 18px",
    cursor: "pointer",
    clipPath: CLIP_BTN,
  },
  disclaimer: {
    fontSize: "11px",
    color: "#7C8A72",
    padding: "8px 24px 20px",
  },
};
