/**
 * VIBE Pubs Routes
 * Advertising/promotional content system
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sanitizeResults } = require('../utils/response-sanitizer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Middleware: Check authentication
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = userId;
  next();
}

// ─────────────────────────────────────────────────────────────
// POST /pubs
// Create new pub (pending admin approval)
// ─────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, imageUrl, linkUrl, salon, billetsCost } = req.body;

    if (!title || !salon) {
      return res.status(400).json({ error: 'Title and salon required' });
    }

    const { data, error } = await supabase
      .from('pubs')
      .insert({
        user_id: req.userId,
        title,
        description,
        image_url: imageUrl,
        link_url: linkUrl,
        salon,
        billets_cost: billetsCost || 100,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`📢 Pub created: ${data.id} (pending approval)`);
    res.status(201).json({
      success: true,
      pub: data,
      message: 'Pub submitted for admin approval'
    });

  } catch (err) {
    console.error(`❌ Pub creation error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /pubs/my
// Get user's own pubs
// ─────────────────────────────────────────────────────────────

router.get('/my', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pubs')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      pubs: data,
      total: data.length
    });

  } catch (err) {
    console.error(`❌ Get user pubs error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /pubs/active/:salon
// Get active pubs for a specific salon
// ─────────────────────────────────────────────────────────────

router.get('/active/:salon', async (req, res) => {
  try {
    const { salon } = req.params;

    if (!['flottant', 'voix', 'fantomes'].includes(salon)) {
      return res.status(400).json({ error: 'Invalid salon' });
    }

    const { data, error } = await supabase
      .from('pubs')
      .select('*')
      .eq('salon', salon)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Sanitize response: hide personal user info, show VIBE brand
    const sanitized = sanitizeResults(data);

    res.json({
      pubs: sanitized,
      total: sanitized.length,
      salon
    });

  } catch (err) {
    console.error(`❌ Get active pubs error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /pubs/:pubId
// Delete pub (only if pending or owner)
// ─────────────────────────────────────────────────────────────

router.delete('/:pubId', requireAuth, async (req, res) => {
  try {
    const { pubId } = req.params;

    const { data: pub, error: fetchError } = await supabase
      .from('pubs')
      .select('user_id, status')
      .eq('id', pubId)
      .single();

    if (fetchError || !pub) {
      return res.status(404).json({ error: 'Pub not found' });
    }

    // Only owner or admin can delete
    if (pub.user_id !== req.userId && req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Can only delete pending pubs
    if (pub.status !== 'pending') {
      return res.status(400).json({ error: 'Can only delete pending pubs' });
    }

    const { error: deleteError } = await supabase
      .from('pubs')
      .delete()
      .eq('id', pubId);

    if (deleteError) throw deleteError;

    console.log(`🗑️ Pub deleted: ${pubId}`);
    res.json({ success: true, message: 'Pub deleted' });

  } catch (err) {
    console.error(`❌ Delete pub error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
