/**
 * VIBE Notifications API Routes
 */

const express = require('express');
const notificationService = require('./notification-service');

const router = express.Router();

// Middleware: Vérifier authentification
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = userId;
  next();
}

// ─────────────────────────────────────────────────────────────
// GET /notifications
// Récupérer les notifications de l'utilisateur
// ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await notificationService.getUserNotifications(
      req.userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      total: result.total
    });

  } catch (err) {
    console.error(`❌ GET /notifications error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /notifications/:id/read
// Marquer une notification comme lue
// ─────────────────────────────────────────────────────────────

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id);

    console.log(`✅ Notification marquée comme lue: ${req.params.id}`);
    res.json({ success: true, notification });

  } catch (err) {
    console.error(`❌ PATCH /notifications/:id/read error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /notifications/mark-all-read
// Marquer toutes les notifications comme lues
// ─────────────────────────────────────────────────────────────

router.post('/mark-all-read', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.userId)
      .is('read_at', null);

    if (error) throw error;

    console.log(`✅ Toutes les notifications marquées comme lues pour ${req.userId}`);
    res.json({ success: true, updated: data?.length || 0 });

  } catch (err) {
    console.error(`❌ POST /notifications/mark-all-read error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /notifications/preferences
// Récupérer les préférences de notification
// ─────────────────────────────────────────────────────────────

router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const prefs = await notificationService.getNotificationPreferences(req.userId);

    res.json({
      preferences: prefs
    });

  } catch (err) {
    console.error(`❌ GET /notifications/preferences error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /notifications/preferences
// Mettre à jour les préférences de notification
// ─────────────────────────────────────────────────────────────

router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const prefs = await notificationService.updateNotificationPreferences(
      req.userId,
      req.body
    );

    console.log(`✅ Préférences mises à jour pour ${req.userId}`);
    res.json({
      success: true,
      preferences: prefs
    });

  } catch (err) {
    console.error(`❌ PUT /notifications/preferences error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /notifications/test
// Tester l'envoi de notification (admin only)
// ─────────────────────────────────────────────────────────────

router.post('/test', async (req, res) => {
  try {
    const { userId, type, title, body } = req.body;

    if (!userId || !type || !title || !body) {
      return res.status(400).json({
        error: 'Missing required fields: userId, type, title, body'
      });
    }

    const notification = await notificationService.createNotification(
      userId,
      type,
      title,
      body
    );

    console.log(`✅ Notification de test envoyée à ${userId}`);
    res.json({ success: true, notification });

  } catch (err) {
    console.error(`❌ POST /notifications/test error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
