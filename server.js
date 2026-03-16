const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const { initDB }     = require("./db");
const reportsRouter  = require("./routes/reports");
const clustersRouter = require("./routes/clusters");

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── Middleware ────────────────────────────────────────────────────────────── */
app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all origins for demo
  credentials: true,
}));
app.use(express.json());

/* ── Routes ────────────────────────────────────────────────────────────────── */
app.use("/api/reports",  reportsRouter);
app.use("/api/clusters", clustersRouter);
app.use("/api/dashboard", clustersRouter);  // dashboard endpoint lives in clusters router

app.get("/api/health", (_, res) => res.json({ status: "ok", ts: new Date() }));

/* ── Start ──────────────────────────────────────────────────────────────────── */
initDB();

app.listen(PORT, () => {
  console.log(`🚀  CivicFlow API running at http://localhost:${PORT}`);
});
