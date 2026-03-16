const express = require("express");
const router  = express.Router();
const { db }  = require("../db");

/* ── Haversine distance in metres ─────────────────────────────────────────── */
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── GET /api/reports ──────────────────────────────────────────────────────── */
router.get("/", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, issue_type, sub_type, description,
             latitude, longitude, location, ward, status, created_at
      FROM   reports
      WHERE  status != 'resolved'
      ORDER  BY created_at DESC
      LIMIT  200
    `).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

/* ── POST /api/reports ─────────────────────────────────────────────────────── */
router.post("/", (req, res) => {
  const { issue_type, sub_type, description, latitude, longitude, location, ward } = req.body;

  if (!issue_type || !sub_type || !latitude || !longitude) {
    return res.status(400).json({ error: "issue_type, sub_type, latitude and longitude are required" });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO reports (issue_type, sub_type, description, latitude, longitude, location, ward)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info      = insert.run(issue_type, sub_type, description || null, latitude, longitude, location || null, ward || null);
    const newReport = db.prepare("SELECT * FROM reports WHERE id = ?").get(info.lastInsertRowid);

    /* Update ward stats */
    if (ward) {
      db.prepare(`
        INSERT INTO wards (name, total_reports, resolved)
        VALUES (?, 1, 0)
        ON CONFLICT(name) DO UPDATE
        SET total_reports = total_reports + 1, updated_at = datetime('now')
      `).run(ward);
    }

    /* Cluster detection for water reports */
    if (issue_type === "water") {
      detectClusters(newReport);
    }

    res.status(201).json(newReport);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create report" });
  }
});

/* ── PATCH /api/reports/:id/status ────────────────────────────────────────── */
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  const validStatuses = ["open", "in_progress", "resolved"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    db.prepare(`
      UPDATE reports
      SET status      = ?,
          resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE NULL END
      WHERE id = ?
    `).run(status, status, req.params.id);

    const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
    if (!updated) return res.status(404).json({ error: "Report not found" });

    if (status === "resolved" && updated.ward) {
      db.prepare(`
        UPDATE wards SET resolved = resolved + 1, updated_at = datetime('now')
        WHERE name = ?
      `).run(updated.ward);
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update report" });
  }
});

/* ── Cluster detection ─────────────────────────────────────────────────────── */
function detectClusters(newReport) {
  const RADIUS_M  = 500;
  const THRESHOLD = 3;

  const nearby = db.prepare(`
    SELECT id, latitude, longitude FROM reports
    WHERE  issue_type = ?
    AND    status != 'resolved'
    AND    created_at > datetime('now', '-24 hours')
  `).all(newReport.issue_type);

  const group = nearby.filter(
    (r) => haversine(newReport.latitude, newReport.longitude, r.latitude, r.longitude) <= RADIUS_M
  );

  if (group.length >= THRESHOLD) {
    const ids    = group.map((r) => r.id);
    const avgLat = group.reduce((s, r) => s + r.latitude,  0) / group.length;
    const avgLng = group.reduce((s, r) => s + r.longitude, 0) / group.length;

    db.prepare(`
      INSERT INTO clusters (issue_type, center_lat, center_lng, report_ids, report_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(newReport.issue_type, avgLat, avgLng, JSON.stringify(ids), ids.length);

    console.log(`🚨  Cluster detected — ${ids.length} ${newReport.issue_type} reports`);
  }
}

module.exports = router;
