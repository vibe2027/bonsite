/**
 * VIBE Auth Routes
 * Complete authentication endpoints with role management
 */

const express = require('express');
const {
  signup,
  login,
  verifyEmail,
  sendRoleConfirmation,
  sendBillets,
  createTribunalCase
} = require('./auth-service');

const { requireHq } = require('./hq-auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// POST /auth/signup
// ─────────────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, region } = req.body;

    // Validate
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine role based on email
    let role = 'user';
    if (email === 'vibeqbc2026@hotmail.com') {
      role = 'admin';
    } else if (email === 'jmarcreid@gmail.com' || email === 'jmarceid@gmail.com') {
      role = 'co_founder';
    }

    // Signup
    const result = await signup(email, password, fullName, region, role);

    // Send role confirmation if admin or co-founder
    if (role !== 'user') {
      await sendRoleConfirmation(email, role);
    }

    res.status(201).json({
      success: true,
      user: result.user,
      message: `Account created as ${role}. Please verify your email.`
    });

  } catch (err) {
    console.error(`❌ Signup error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const result = await login(email, password);

    res.json({
      success: true,
      session: result.session,
      user: result.user
    });

  } catch (err) {
    console.error(`❌ Login error: ${err.message}`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /auth/verify-email
// ─────────────────────────────────────────────────────────────

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing verification token' });
    }

    const result = await verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully',
      user: result.user
    });

  } catch (err) {
    console.error(`❌ Verification error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /auth/send-billets (Co-founder only)
// ─────────────────────────────────────────────────────────────

// Rôle vérifié via le JWT + hq_command_emails (plus d'en-tête x-user-role falsifiable).
router.post('/send-billets', requireHq(['founder', 'coo']), async (req, res) => {
  try {
    const { toEmail, amount } = req.body;
    const userRole = req.hq.role;

    if (!toEmail || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'toEmail et amount (> 0) requis' });
    }

    // Le Directeur des Opérations est limité à 1000 billets par envoi.
    if (userRole === 'coo' && Number(amount) > 1000) {
      return res.status(400).json({ error: 'Monthly limit exceeded (1000 billets/month)' });
    }

    // L'expéditeur est l'utilisateur authentifié, jamais une valeur du corps de requête.
    const result = await sendBillets(req.userId, toEmail, Number(amount));

    res.json({
      success: true,
      message: `Sent ${amount} billets to ${toEmail}`
    });

  } catch (err) {
    console.error(`❌ Send billets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /auth/tribunal-case (Create case)
// ─────────────────────────────────────────────────────────────

router.post('/tribunal-case', async (req, res) => {
  try {
    const { complainantId, defendantId, caseType, description } = req.body;

    if (!complainantId || !defendantId || !caseType || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await createTribunalCase(
      complainantId,
      defendantId,
      caseType,
      description
    );

    res.status(201).json(result);

  } catch (err) {
    console.error(`❌ Tribunal error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
