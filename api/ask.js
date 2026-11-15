// Vercel serverless function: POST /api/ask
"use strict";
const { handleAsk } = require("../lib/guide");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "POST only" }); }
  try {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
    const { status, json } = await handleAsk(req.body, { ip, origin: req.headers.origin });
    res.status(status).json(json);
  } catch (e) {
    console.error(e); res.status(500).json({ error: "server error" });
  }
};
