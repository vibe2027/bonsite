/**
 * VIBE Backend Server
 * Complete platform: Auth + Admin Dashboard + Stripe + Realtime Salons
 */

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────
// Environment Validation
// ─────────────────────────────────────────────────────────────
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NODE_ENV',
  'BASE_URL'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('🚨 CRITICAL: Missing environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('\n📋 Please add these to Vercel Environment Variables:');
  console.error('   → Vercel Dashboard → Settings → Environment Variables');
  console.error('\n⚠️  Server starting in degraded mode...\n');
}

// Initialize Stripe with error handling
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');
} catch (e) {
  console.warn('⚠️ Stripe initialization warning - check STRIPE_SECRET_KEY');
  stripe = null;
}

const authRoutes = require('./auth/auth-routes');
const adminRoutes = require('./dashboard/admin-routes');
const pubsRoutes = require('./pubs/pubs-routes');
const searchRoutes = require('./search/search-routes');
const contactRoutes = require('./contact/contact-routes');
const { verifyAuth, getUserFromRequest } = require('./auth/hq-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// Supabase Client (service_role bypasses RLS)
// ─────────────────────────────────────────────────────────────
let supabase;
try {
  supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
} catch (e) {
  console.warn('⚠️ Supabase initialization warning - check credentials');
  supabase = null;
}

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

// ⚠️ CRITICAL: Raw body parser for Stripe webhooks (MUST be before json)
app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

// Regular JSON parser for other routes
app.use(express.json());

// ─────────────────────────────────────────────────────────────
// Fichiers statiques
// ─────────────────────────────────────────────────────────────
// Servis par Vercel (voir le handler "filesystem" dans vercel.json), qui
// les livre avant que la requête n'atteigne cette fonction.
//
// Ne PAS remettre express.static('.') ici : il servait tout le contenu du
// paquet de la fonction, code backend compris — server.js était
// téléchargeable publiquement sur /server.js.

// Fichiers statiques sur hébergeur Node (Render, Railway…) : liste blanche stricte.
// Sur Vercel, le handler "filesystem" de vercel.json les livre avant cette fonction ;
// ce bloc ne sert donc qu'aux hébergeurs où le serveur est seul devant le trafic.
// Jamais express.static('.') : server.js, .env et le code backend resteraient téléchargeables.
const path = require('path');
const STATIC_PAGES = new Set([
  'index.html', 'login.html', 'paiement.html', 'contact.html',
  'conditions.html', 'confidentialite.html', 'bande-annonce.html'
]);
const STATIC_FILES = /^(manifest\.json|sw\.js|robots\.txt|sitemap\.xml|[\w-]+\.(png|ico|svg|webp))$/;
const STATIC_JS = /^js\/[\w.-]+\.js$/;

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/admin/') ||
      req.path.startsWith('/pubs/') || req.path.startsWith('/payment/') || req.path === '/health') {
    return next();
  }
  let rel = decodeURIComponent(req.path).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  if (rel.includes('..') || rel.includes('\\')) return next();
  const ok = STATIC_PAGES.has(rel) || STATIC_FILES.test(rel) || STATIC_JS.test(rel);
  if (!ok) return next();
  const file = path.join(__dirname, rel);
  if (!file.startsWith(__dirname + path.sep)) return next();
  res.sendFile(file, (err) => { if (err) next(); });
});

// ─────────────────────────────────────────────────────────────
// Mount Routes
// ─────────────────────────────────────────────────────────────

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/pubs', pubsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/contact', contactRoutes);

// Authentification : voir auth/hq-auth.js (JWT Supabase vérifié côté serveur).
// req.userId / req.user viennent du jeton — jamais du corps de la requête.

// ─────────────────────────────────────────────────────────────
// Grille de prix PRESTIGE (CAD, en cents) — source de vérité côté serveur
// ─────────────────────────────────────────────────────────────
const PRESTIGE = {
  pionnier: { name: 'Pass Pionnier — 1 an (4 Extras inclus)', amount: 14900 },
  mois1:    { name: 'VIBE — abonnement 1 mois',  amount: 2999 },
  mois3:    { name: 'VIBE — abonnement 3 mois',  amount: 7499 },
  mois6:    { name: 'VIBE — abonnement 6 mois',  amount: 11999 },
  an1:      { name: 'VIBE — abonnement 1 an',    amount: 17999 },
  boost:    { name: 'Boost 24 h',                amount: 999 },
  fantome:  { name: 'Mode Fantôme — 7 jours',    amount: 1299 },
  visites:  { name: 'Qui m\'a consulté — 7 jours', amount: 999 },
  montre:   { name: 'Connexion Montre intelligente', amount: 1499 },
  tribunal: { name: 'Pardon du Tribunal',        amount: 4900 }
};
const MAX_PIONNIERS = 500;

// ─────────────────────────────────────────────────────────────
// ROUTE: Create Checkout Session
// ─────────────────────────────────────────────────────────────

app.post('/api/checkout-session', verifyAuth, async (req, res) => {
  try {
    const { tier } = req.body;
    // Identité tirée du JWT : on ignore tout auth_id / email envoyé par le client.
    const auth_id = req.user.id;
    const email = req.user.email;

    if (!tier) {
      return res.status(400).json({ error: 'Missing required field: tier' });
    }

    // Grille Prestige : prix définis ici (price_data), aucun identifiant de prix Stripe à créer.
    if (PRESTIGE[tier]) {
      if (!stripe) return res.status(503).json({ error: 'Paiement indisponible' });

      if (tier === 'pionnier') {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_founder', true);
        if ((count || 0) >= MAX_PIONNIERS) {
          return res.status(409).json({ error: 'Les 500 places Pionnier sont toutes prises.' });
        }
      }

      const item = PRESTIGE[tier];
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: { currency: 'cad', product_data: { name: item.name }, unit_amount: item.amount },
          quantity: 1
        }],
        mode: 'payment',
        customer_email: email,
        client_reference_id: auth_id,
        metadata: { auth_id, plan: tier },
        success_url: `${process.env.BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/payment/cancelled`
      });
      return res.json({ id: session.id, url: session.url });
    }

    // Pricing tiers
    const PRICING = {
      premium: {
        priceId: process.env.STRIPE_PRICE_PREMIUM || 'price_123',
        name: 'VIBE Premium',
        description: '1 month premium access'
      },
      founder: {
        priceId: process.env.STRIPE_PRICE_FOUNDER || 'price_456',
        name: 'VIBE Founder Pass',
        description: 'Lifetime founder benefits'
      }
    };

    if (!PRICING[tier]) {
      return res.status(400).json({ error: `Invalid tier: ${tier}` });
    }

    console.log(`🛒 Creating checkout for ${auth_id} (${tier})`);

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICING[tier].priceId,
          quantity: 1
        }
      ],
      mode: 'payment',
      customer_email: email,

      // ⚠️ CRITICAL: Metadata links payment to user
      metadata: {
        auth_id,
        tier
      },

      // Redirects after payment
      success_url: `${process.env.BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/payment/cancelled`
    });

    console.log(`✅ Checkout session created: ${session.id}`);
    res.json({ id: session.id, url: session.url });

  } catch (err) {
    console.error(`❌ Checkout error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// ROUTE: Payment Success Redirect
// ─────────────────────────────────────────────────────────────

app.get('/payment/success', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.redirect('/dashboard?payment=missing');
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const authId = session.metadata.auth_id;

    console.log(`✅ Payment confirmed for ${authId}`);

    // Webhook already updated DB, but we can verify here
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', authId)
      .single();

    if (user?.role === 'premium') {
      res.redirect('/dashboard?payment=success&role=premium');
    } else {
      res.redirect('/dashboard?payment=success');
    }

  } catch (err) {
    console.error(`❌ Success redirect error: ${err.message}`);
    res.redirect('/dashboard?payment=error');
  }
});

app.get('/payment/cancelled', (req, res) => {
  res.redirect('/dashboard?payment=cancelled');
});

// ─────────────────────────────────────────────────────────────
// WEBHOOK: Stripe Events Handler
// ─────────────────────────────────────────────────────────────

async function handleWebhook(req, res) {
  const rawBody = req.body;
  const signature = req.headers['stripe-signature'];

  // Verify signature
  if (!verifyStripeSignature(rawBody, signature)) {
    console.error('❌ Invalid Stripe signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('✅ Stripe signature verified');

  // Parse JSON
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error(`❌ JSON parse error: ${err.message}`);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`📨 Webhook event: ${event.type}`);

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const stripeCustomerId = paymentIntent.customer;
      const metadata = paymentIntent.metadata || {};
      const authId = metadata.auth_id;

      // Les achats de la grille Prestige sont traités sur checkout.session.completed.
      if (!authId) {
        console.log('⏭️ payment_intent sans auth_id (grille Prestige ou autre) — ignoré ici');
        return res.status(200).json({ received: true });
      }

      if (!stripeCustomerId) {
        console.error('❌ Missing customer ID');
        return res.status(400).json({ error: 'Missing customer ID' });
      }

      await assignPremiumRole(authId, stripeCustomerId);
      return res.status(200).json({ received: true });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};
      if (meta.plan && PRESTIGE[meta.plan]) {
        if (session.payment_status !== 'paid') {
          console.log(`⏭️ Session ${session.id} non payée (${session.payment_status})`);
          return res.status(200).json({ received: true });
        }
        if (!meta.auth_id) {
          console.error('❌ Missing auth_id in session metadata');
          return res.status(400).json({ error: 'Missing auth_id' });
        }
        await appliquerAchat(meta.auth_id, meta.plan, session.payment_intent || session.id, session.amount_total);
      }
      return res.status(200).json({ received: true });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      console.log(`⚠️ Payment failed: ${paymentIntent.id}`);
      // Optional: notify user
      return res.status(200).json({ received: true });
    }

    // Ignore other events
    console.log(`⏭️ Ignoring event: ${event.type}`);
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error(`❌ Webhook error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER: Verify Stripe Signature (HMAC-SHA256)
// ─────────────────────────────────────────────────────────────

function verifyStripeSignature(body, signature) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET || !signature) {
    console.error('❌ Missing WEBHOOK_SECRET or stripe-signature');
    return false;
  }

  // Parse signature: t=timestamp,v1=hash
  const parts = signature.split(',');
  const timestamp = parts[0]?.split('=')[1];
  const hash = parts[1]?.split('=')[1];

  if (!timestamp || !hash) {
    console.error('❌ Invalid signature format');
    return false;
  }

  // Reconstruct signed content
  const signedContent = `${timestamp}.${body}`;

  // Compute HMAC-SHA256
  const computed = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedContent)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(computed)
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER: Appliquer un achat de la grille Prestige
// ─────────────────────────────────────────────────────────────
// Idempotent : payments.stripe_payment_intent_id est UNIQUE, un rejeu du webhook ne double rien.
// Les colonnes existantes sont utilisées telles quelles :
//   boost_expire_le · ghost_mode_expire_le · visites_until · acces_expire_le · lecture_seule_jusqu
// « montre » s'appuie sur la ligne payments (lue par extra_actif).

function plusJours(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }
function plusMois(base, n) { const d = new Date(base); d.setMonth(d.getMonth() + n); return d; }

async function appliquerAchat(authId, plan, paymentId, amountCents) {
  if (!paymentId) throw new Error('paymentId manquant');

  const { error: insErr } = await supabase.from('payments').insert({
    user_id: authId,
    stripe_payment_intent_id: String(paymentId),
    amount: amountCents ?? PRESTIGE[plan].amount,
    currency: 'cad',
    status: 'succeeded',
    plan
  });
  if (insErr) {
    if (insErr.code === '23505') { console.log(`✅ Achat ${paymentId} déjà traité (idempotent)`); return { duplicate: true }; }
    throw insErr;
  }

  try {
    const { data: p, error } = await supabase
      .from('profiles')
      .select('acces_expire_le, boost_expire_le, ghost_mode_expire_le, visites_until')
      .eq('id', authId)
      .maybeSingle();
    if (error || !p) throw new Error(`Profil introuvable pour ${authId}`);

    const now = new Date();
    // Prolonge à partir de l'échéance en cours si elle est encore valide.
    const depart = (iso) => (iso && new Date(iso) > now ? new Date(iso) : now);
    const patch = {};

    switch (plan) {
      case 'boost':    patch.boost_expire_le = plusJours(depart(p.boost_expire_le), 1).toISOString(); break;
      case 'fantome':  patch.ghost_mode_expire_le = plusJours(depart(p.ghost_mode_expire_le), 7).toISOString(); break;
      case 'visites':  patch.visites_until = plusJours(depart(p.visites_until), 7).toISOString(); break;
      case 'mois1':    patch.acces_expire_le = plusMois(depart(p.acces_expire_le), 1).toISOString(); break;
      case 'mois3':    patch.acces_expire_le = plusMois(depart(p.acces_expire_le), 3).toISOString(); break;
      case 'mois6':    patch.acces_expire_le = plusMois(depart(p.acces_expire_le), 6).toISOString(); break;
      case 'an1':      patch.acces_expire_le = plusMois(depart(p.acces_expire_le), 12).toISOString(); break;
      case 'pionnier':
        patch.is_founder = true;
        patch.membership_tier = 'founder';
        patch.acces_expire_le = plusMois(depart(p.acces_expire_le), 12).toISOString();
        break;
      case 'tribunal': patch.lecture_seule_jusqu = null; break;
      case 'montre':   break; // activé par la ligne payments
    }

    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', authId);
      if (upErr) throw upErr;
    }
    console.log(`✅ Achat appliqué : ${plan} → ${authId}`);
    return { ok: true };
  } catch (err) {
    // Rend le rejeu possible : sans cette ligne, le webhook relancé serait vu comme un doublon.
    await supabase.from('payments').delete().eq('stripe_payment_intent_id', String(paymentId));
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER: Assign Premium Role
// ─────────────────────────────────────────────────────────────

async function assignPremiumRole(authId, stripeCustomerId) {
  console.log(`🔄 Assigning premium role to ${authId}`);

  // Find user by auth_id
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, stripe_customer_id, role')
    .eq('auth_id', authId)
    .single();

  if (fetchError || !user) {
    console.error(`❌ User not found: ${authId}`);
    throw new Error(`User ${authId} not found`);
  }

  // Idempotence check
  if (user.stripe_customer_id === stripeCustomerId) {
    console.log(`✅ User already linked, idempotent OK`);
    return user;
  }

  // Update user
  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({
      stripe_customer_id: stripeCustomerId,
      role: 'premium'
    })
    .eq('id', user.id)
    .select()
    .single();

  if (updateError) {
    console.error(`❌ Update error: ${updateError.message}`);
    throw updateError;
  }

  console.log(`✅ Premium assigned to ${authId}`);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// ROUTE: Check User Status (for frontend)
// ─────────────────────────────────────────────────────────────

app.get('/api/user/status', async (req, res) => {
  try {
    // JWT vérifié côté serveur : on n'accepte plus un identifiant brut comme « jeton ».
    const authUser = await getUserFromRequest(req);

    if (!authUser) {
      return res.status(401).json({ error: 'Missing or invalid auth' });
    }
    const authId = authUser.id;

    const { data: user } = await supabase
      .from('users')
      .select('auth_id, email, role, stripe_customer_id')
      .eq('auth_id', authId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      auth_id: user.auth_id,
      email: user.email,
      role: user.role,
      is_premium: user.role === 'premium',
      stripe_linked: !!user.stripe_customer_id
    });

  } catch (err) {
    console.error(`❌ Status check error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// ROUTE: Health Check & Diagnostics
// ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  const env_config = {
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripe_secret: !!process.env.STRIPE_SECRET_KEY,
    stripe_webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    stripe_price_premium: !!process.env.STRIPE_PRICE_PREMIUM,
    stripe_price_founder: !!process.env.STRIPE_PRICE_FOUNDER,
    resend: !!process.env.RESEND_API_KEY,
    elasticsearch: !!process.env.ELASTICSEARCH_URL,
    node_env: process.env.NODE_ENV || 'not-set',
    base_url: process.env.BASE_URL || 'not-set'
  };

  const missing = Object.entries(env_config)
    .filter(([k, v]) => !v && ['supabase_url', 'supabase_service_role', 'stripe_secret', 'node_env', 'base_url'].includes(k))
    .map(([k]) => k);

  res.json({
    status: missing.length > 0 ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    domain: process.env.BASE_URL || 'not-configured',
    services: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      supabase: !!process.env.SUPABASE_URL,
      elasticsearch: !!process.env.ELASTICSEARCH_URL
    },
    config: env_config,
    ...(missing.length > 0 && {
      warnings: [
        '⚠️ Missing critical environment variables detected',
        `Missing: ${missing.join(', ')}`,
        'Go to Vercel Dashboard → Settings → Environment Variables to add them'
      ]
    })
  });
});

// Diagnostic endpoint (for debugging)
app.get('/api/diagnostics', (req, res) => {
  const requiredVars = [
    'NODE_ENV',
    'BASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];

  const status = {};
  requiredVars.forEach(v => {
    status[v] = process.env[v] ? '✅ SET' : '❌ MISSING';
  });

  res.json({
    diagnostics: 'VIBE Environment Check',
    timestamp: new Date().toISOString(),
    environment_variables: status,
    tips: [
      'If any variable shows "MISSING", go to:',
      'Vercel Dashboard → Project → Settings → Environment Variables',
      'Add all missing variables',
      'Then redeploy: Deployments → Latest → Redeploy'
    ]
  });
});

// ─────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 VIBE Server running on port ${PORT}`);
  console.log(`📍 Webhook endpoint: POST /api/webhooks/stripe`);
  console.log(`💳 Checkout endpoint: POST /api/checkout-session`);
  console.log(`✅ Health check: GET /health`);
});

module.exports = app;
