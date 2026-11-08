/**
 * VIBE Analytics API Routes
 */

const express = require('express');
const analyticsService = require('./analytics-service');

const router = express.Router();

// Middleware
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  req.userId = userId;
  next();
}

function requireAdmin(req, res, next) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ─────────────────────────────────────────────────────────────
// GET /analytics/user
// User personal analytics
// ─────────────────────────────────────────────────────────────

router.get('/user', requireAuth, async (req, res) => {
  try {
    const analytics = await analyticsService.getUserAnalytics(req.userId);
    res.json(analytics);
  } catch (err) {
    console.error(`❌ GET /analytics/user error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /analytics/admin
// Admin dashboard analytics
// ─────────────────────────────────────────────────────────────

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const analytics = await analyticsService.getAdminAnalytics(parseInt(days));
    res.json(analytics);
  } catch (err) {
    console.error(`❌ GET /analytics/admin error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /analytics/dau
// Daily active users
// ─────────────────────────────────────────────────────────────

router.get('/dau', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const data = await analyticsService.getDailyActiveUsers(parseInt(days));
    res.json({ dau: data });
  } catch (err) {
    console.error(`❌ GET /analytics/dau error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /analytics/leaderboard/:type
// Leaderboard analytics
// ─────────────────────────────────────────────────────────────

router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 100 } = req.query;
    const data = await analyticsService.getLeaderboardAnalytics(type, parseInt(limit));
    res.json({ leaderboard: data });
  } catch (err) {
    console.error(`❌ GET /analytics/leaderboard error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /analytics/salon/:salon
// Salon-specific analytics
// ─────────────────────────────────────────────────────────────

router.get('/salon/:salon', async (req, res) => {
  try {
    const { salon } = req.params;
    const { days = 30 } = req.query;
    const data = await analyticsService.getSalonAnalytics(salon, parseInt(days));
    res.json(data);
  } catch (err) {
    console.error(`❌ GET /analytics/salon error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /analytics/export/pdf
// Export user analytics as PDF
// ─────────────────────────────────────────────────────────────

router.get('/export/pdf', requireAuth, async (req, res) => {
  try {
    const { doc, filename } = await analyticsService.exportUserAnalyticsPDF(req.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
  } catch (err) {
    console.error(`❌ GET /analytics/export/pdf error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /analytics/export/csv
// Export analytics as CSV
// ─────────────────────────────────────────────────────────────

router.get('/export/csv', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { type = 'users', days = 30 } = req.query;
    const csv = await analyticsService.exportAnalyticsCSV(type, parseInt(days));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(`❌ GET /analytics/export/csv error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
