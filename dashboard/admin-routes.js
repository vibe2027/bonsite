/**
 * VIBE Admin Dashboard Routes
 */

const express = require('express');
const { requireHq } = require('../auth/hq-auth');
const {
  getDashboardStats,
  listUsers,
  updateUserRole,
  suspendUser,
  getTribunalCases,
  resolveTribunalCase,
  getPubsForApproval,
  approvePub,
  rejectPub,
  adjustBillets,
  getActivityLog,
  getTribunalStats
} = require('./admin-dashboard');

const router = express.Router();

// Contrôle d'accès : JWT Supabase vérifié + rôle du QG (hq_command_emails).
// Les en-têtes x-user-role / x-user-id ne sont plus jamais lus (falsifiables).
//   requireAdmin        → Fondateur ou Directeur des Opérations
//   requireFounderOnly  → Fondateur seulement (changements majeurs, billets)
const requireAdmin = requireHq(['founder', 'coo']);
const requireFounderOnly = requireHq(['founder']);

// ─────────────────────────────────────────────────────────────
// GET /admin/stats
// ─────────────────────────────────────────────────────────────

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Le Directeur des Opérations ne voit aucune donnée financière.
    const stats = await getDashboardStats(req.hq.role);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/users
// ─────────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await listUsers(page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /admin/users/:userId/role
// ─────────────────────────────────────────────────────────────

router.put('/users/:userId/role', requireFounderOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'co_founder', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await updateUserRole(userId, role);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/users/:userId/suspend
// ─────────────────────────────────────────────────────────────

router.post('/users/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const result = await suspendUser(userId, reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/tribunal
// ─────────────────────────────────────────────────────────────

router.get('/tribunal', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const cases = await getTribunalCases(status);
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /admin/tribunal/:caseId/resolve
// ─────────────────────────────────────────────────────────────

router.put('/tribunal/:caseId/resolve', requireAdmin, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { resolution } = req.body;

    const result = await resolveTribunalCase(caseId, resolution, req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/tribunal/stats
// ─────────────────────────────────────────────────────────────

router.get('/tribunal/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getTribunalStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/pubs
// ─────────────────────────────────────────────────────────────

router.get('/pubs', requireAdmin, async (req, res) => {
  try {
    const pubs = await getPubsForApproval();
    res.json(pubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /admin/pubs/:pubId/approve
// ─────────────────────────────────────────────────────────────

router.put('/pubs/:pubId/approve', requireAdmin, async (req, res) => {
  try {
    const { pubId } = req.params;
    const result = await approvePub(pubId, req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /admin/pubs/:pubId/reject
// ─────────────────────────────────────────────────────────────

router.put('/pubs/:pubId/reject', requireAdmin, async (req, res) => {
  try {
    const { pubId } = req.params;
    const { reason } = req.body;

    const result = await rejectPub(pubId, reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /admin/billets/:userId/adjust
// ─────────────────────────────────────────────────────────────

router.post('/billets/:userId/adjust', requireFounderOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    const result = await adjustBillets(userId, amount, reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /admin/activity
// ─────────────────────────────────────────────────────────────

router.get('/activity', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const activity = await getActivityLog(days);
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
