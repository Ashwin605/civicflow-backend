const express = require("express");
const router  = express.Router();
const { db }  = require("../db");

/* ── GET /api/clusters ─────────────────────────────────────────────────────── */
router.get("/", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, issue_type, center_lat, center_lng, report_count, created_at
      FROM   clusters
      WHERE  active    = 1
      AND    created_at > datetime('now', '-24 hours')
      ORDER  BY created_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

/* ── GET /api/dashboard ────────────────────────────────────────────────────── */
router.get("/dashboard", (req, res) => {
  try {
    const wards = db.prepare(`
      SELECT name,
             total_reports,
             resolved,
             CASE WHEN total_reports = 0 THEN 0
                  ELSE ROUND(CAST(resolved AS REAL) / total_reports * 100)
             END AS resolution_rate
      FROM   wards
      ORDER  BY resolution_rate DESC
    `).all();

    const summary = db.prepare(`
      SELECT
        COUNT(*)                                          AS total,
        SUM(CASE WHEN status = 'open'        THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'resolved'    THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN issue_type = 'water'   THEN 1 ELSE 0 END) AS water,
        SUM(CASE WHEN issue_type = 'civic'   THEN 1 ELSE 0 END) AS civic
      FROM reports
    `).get();

    const { count: active_clusters } = db.prepare(`
      SELECT COUNT(*) AS count FROM clusters
      WHERE active = 1 AND created_at > datetime('now', '-24 hours')
    `).get();

    res.json({ summary, active_clusters: Number(active_clusters), wards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
