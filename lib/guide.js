// Server side of the AI guide: builds the prompt from the same data file the page uses,
// checks what the browser sent, and calls the Anthropic Messages API with the key kept on the server.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA = (() => {
  const file = path.join(__dirname, "..", "public", "data.js");
  const code = fs.readFileSync(file, "utf8") + "\n;({ INV, GROUND, HABITATS, FAMILIES, ROLES });";
  return vm.runInNewContext(code, {});
})();
const IDS = new Set(DATA.INV.map(i => i.id).concat(DATA.GROUND.map(g => g.id)));

const TOOLS = [
  { name: "focus_investigation", description: "Select and fly to one investigation in the dashboard.",
    input_schema: { type: "object", properties: { id: { type: "string", description: "PSI ID like PSI-20" } }, required: ["id"] } },
  { name: "compare_investigations", description: "Pin 2-3 investigations to the comparison bench.",
    input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] } },
  { name: "set_habitat", description: "Switch the crew environment lens: spacecraft, lunar, rover, mars, suit, earth.",
    input_schema: { type: "object", properties: { habitat: { type: "string", enum: Object.keys(DATA.HABITATS) } }, required: ["habitat"] } },
];

function systemPrompt({ role, habitat, selected, scores }) {
  const R = DATA.ROLES[role] || DATA.ROLES.engineer, H = DATA.HABITATS[habitat] || DATA.HABITATS.lunar;
  const F = DATA.FAMILIES;
  const cat = DATA.INV.map(i => `${i.id} | ${i.ac} — ${i.name} | ${F[i.fam].name} | ${i.plat} | phase ${i.phase} | fuels: ${i.fuels} | sample: ${i.sample} | O2: ${i.o2} | P: ${i.pres} | flow: ${i.flow} | varied: ${i.varied.join("; ")} | held: ${i.held.join("; ")} | sensors: ${i.diag.join("; ")} | objective: ${i.obj} | takeaway: ${i.take} | Earth: ${i.earth} | related: ${i.rel.join(",")} | relevance for ${H.label}: ${scores[i.id] ?? "n/a"}`).join("\n")
    + "\nGROUND STUDIES REUSING PSI DATA:\n" + DATA.GROUND.map(g => `${g.id} | ${g.ac} | builds on ${g.parent || "none"} | ${g.obj}`).join("\n");
  return `You are the "${R.agent}", a guide inside Combustion Atlas, a dashboard of NASA PSI combustion investigations for fire safety in crew habitats. The user is a ${R.label}. ${R.blurb}
Context: selected crew environment is ${H.label} (${H.p} psia, ${H.o2}% O2). Facts from the brief: spacesuits run 100% O2 at 4.3 psi; Moon base and pressurized rovers are expected at >=30% O2 and <=10.2 psi (over 40% more O2 fraction than Earth air), reducing EVA pre-breathe; there is no partial-gravity combustion data in PSI yet (LUCI and FM2 expected); E-FIELD mimics partial gravity via ion wind; microgravity and 1-g results bound intermediate gravity; the highest microgravity O2 (up to 85%) was in ACME CFI-G. The SAME/SAME-R smoke instrument also measured dust in DAFT. ACME's six experiments shared CIR hardware; FLEX, FLEX-2, CFI used MDCA in CIR; BASS, BASS-II, SPICE, SLICE used the SPICE flow duct in the MSG.
Currently selected in the dashboard: ${selected}.
Rules: Answer in under 170 words unless asked for more, in plain prose or short lists, pitched for a ${R.label.toLowerCase()}. Cite investigations by acronym with PSI ID. Use only the catalog and facts above; if something is not in them, say the PSI summary does not state it. Do not invent numbers. Stay on the topic of these investigations and fire safety. When your answer centers on one investigation, call focus_investigation; when comparing, call compare_investigations; when the user names a crew environment, call set_habitat.
CATALOG:
${cat}`;
}

// ---- input checks: the endpoint only ever serves this guide ----
class BadRequest extends Error {}
const str = (v, max) => typeof v === "string" && v.length <= max;
function cleanContext(c) {
  if (!c || typeof c !== "object") throw new BadRequest("context missing");
  const scores = {};
  for (const [k, v] of Object.entries(c.scores || {})) if (IDS.has(k) && Number.isFinite(v)) scores[k] = Math.max(0, Math.min(100, Math.round(v)));
  return {
    role: DATA.ROLES[c.role] ? c.role : "engineer",
    habitat: DATA.HABITATS[c.habitat] ? c.habitat : "lunar",
    selected: IDS.has(c.selected) ? c.selected : "PSI-20",
    scores,
  };
}
function cleanMessages(m) {
  if (!Array.isArray(m) || !m.length || m.length > 24) throw new BadRequest("messages must be 1-24 items");
  if (JSON.stringify(m).length > 150000) throw new BadRequest("conversation too long");
  return m.map(x => {
    if (!x || (x.role !== "user" && x.role !== "assistant")) throw new BadRequest("bad role");
    if (str(x.content, 4000)) return { role: x.role, content: x.content };
    if (!Array.isArray(x.content)) throw new BadRequest("bad content");
    return { role: x.role, content: x.content.map(b => {
      if (b.type === "text" && str(b.text, 6000)) return { type: "text", text: b.text };
      // Sonnet 5.5 thinks before answering; its thinking blocks must be sent back unchanged during a tool loop
      if (x.role === "assistant" && b.type === "thinking" && str(b.thinking, 60000) && str(b.signature, 20000)) return { type: "thinking", thinking: b.thinking, signature: b.signature };
      if (x.role === "assistant" && b.type === "redacted_thinking" && str(b.data, 60000)) return { type: "redacted_thinking", data: b.data };
      if (b.type === "tool_use" && str(b.id, 200) && TOOLS.some(t => t.name === b.name)) return { type: "tool_use", id: b.id, name: b.name, input: b.input || {} };
      if (b.type === "tool_result" && str(b.tool_use_id, 200) && str(b.content, 2000)) return { type: "tool_result", tool_use_id: b.tool_use_id, content: b.content, is_error: !!b.is_error };
      throw new BadRequest("bad content block");
    }) };
  });
}

// ---- simple per-visitor rate limit (per server instance) ----
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = Number(process.env.RATE_LIMIT_PER_10_MIN || 30);
  const list = (hits.get(ip) || []).filter(t => now - t < win); list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

// ---- the call ----
// AI_PROVIDER: "anthropic" (default) or "openai" (any OpenAI-compatible API). AI_API_KEY works for both;
// ANTHROPIC_API_KEY is still accepted for the default provider.
const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
const KEY = process.env.AI_API_KEY || (PROVIDER === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
async function handleAsk(body, { ip = "anon", origin } = {}) {
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && origin && origin !== allowed) return { status: 403, json: { error: "origin not allowed" } };
  if (!KEY) return { status: 503, json: { error: "No API key is set on the server (AI_API_KEY or ANTHROPIC_API_KEY)" } };
  if (rateLimited(ip)) return { status: 429, json: { error: "too many requests" } };
  let context, messages;
  try { context = cleanContext(body && body.context); messages = cleanMessages(body && body.messages); }
  catch (e) { if (e instanceof BadRequest) return { status: 400, json: { error: e.message } }; throw e; }
  const system = systemPrompt(context);
  try { return await (PROVIDER === "openai" ? callOpenAICompatible(system, messages) : callAnthropic(system, messages)); }
  catch (e) { console.error("Could not reach the AI service:", e.cause || e.message); return { status: 502, json: { error: "could not reach the AI service", detail: String((e.cause && e.cause.code) || e.message).slice(0, 200) } }; }
}

// Pass the provider's own error message back so the guide (and the terminal) can say what went wrong.
function upstreamError(who, status, data) {
  const e = Array.isArray(data) ? data[0] && data[0].error : data && data.error;
  const msg = (e && (e.message || e.status)) || (typeof e === "string" ? e : "") || "no details";
  console.error(`${who} error ${status}: ${msg}`);
  return { status: status === 429 ? 429 : 502, json: { error: `${who} returned ${status}`, detail: String(msg).slice(0, 300) } };
}

// ---- provider: Anthropic (default) ----
async function callAnthropic(system, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: Number(process.env.MAX_TOKENS || 4000), system, tools: TOOLS, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return upstreamError("Anthropic", r.status, data);
  return { status: 200, json: { content: data.content, stop_reason: data.stop_reason } };
}

// ---- provider: any OpenAI-compatible chat API (OpenAI, Google Gemini, Groq, OpenRouter, Mistral, Ollama...) ----
// The page always speaks one format; this translates it to chat-completions and the reply back.
function toOpenAI(system, messages) {
  const out = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === "assistant") {
      const text = m.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      const calls = m.content.filter(b => b.type === "tool_use").map(b => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      out.push(calls.length ? { role: "assistant", content: text || null, tool_calls: calls } : { role: "assistant", content: text });
    } else {
      for (const b of m.content) {
        if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
        else if (b.type === "text") out.push({ role: "user", content: b.text });
      }
    }
  }
  return out;
}
async function callOpenAICompatible(system, messages) {
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!process.env.AI_MODEL) return { status: 503, json: { error: "AI_MODEL is not set on the server" } };
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
    body: JSON.stringify({
      model: process.env.AI_MODEL, max_tokens: Number(process.env.MAX_TOKENS || 1200), messages: toOpenAI(system, messages),
      tools: TOOLS.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return upstreamError("AI provider", r.status, data);
  const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: String(msg.content) });
  for (const c of msg.tool_calls || []) {
    let input = {}; try { input = JSON.parse(c.function.arguments || "{}"); } catch (e) {}
    content.push({ type: "tool_use", id: c.id || ("call_" + Math.random().toString(36).slice(2)), name: c.function.name, input });
  }
  return { status: 200, json: { content, stop_reason: content.some(b => b.type === "tool_use") ? "tool_use" : "end_turn" } };
}

function describeConfig() {
  return `AI guide: provider=${PROVIDER}, model=${process.env.AI_MODEL || (PROVIDER === "anthropic" ? "claude-sonnet-5-5" : "(not set!)")}` +
    (PROVIDER === "openai" ? `, base=${process.env.AI_BASE_URL || "https://api.openai.com/v1"}` : "") + `, key=${KEY ? "set (" + KEY.slice(0, 4) + "…)" : "MISSING"}`;
}

module.exports = { handleAsk, systemPrompt, describeConfig, DATA };
