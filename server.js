// Plain Node server for any host (Render, Railway, Fly.io, a VPS, or your laptop).
// Serves the dashboard from /public and the AI guide at POST /api/ask.
// Run: npm install && npm start   (needs Node 18+; reads .env if present)
"use strict";
try { require("dotenv").config({ path: require("path").join(__dirname, ".env") }); } catch (e) {}
if (Number(process.versions.node.split(".")[0]) < 18) { console.error("Node 18 or newer is required (you have " + process.version + ")."); process.exit(1); }
const express = require("express");
const path = require("path");
const { handleAsk, describeConfig } = require("./lib/guide");

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "100kb" }));
app.post("/api/ask", async (req, res) => {
  try {
    const { status, json } = await handleAsk(req.body, { ip: req.ip, origin: req.get("origin") });
    res.status(status).json(json);
  } catch (e) { console.error(e); res.status(500).json({ error: "server error" }); }
});
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`Combustion Atlas running at http://localhost:${port}`); console.log(describeConfig()); });
