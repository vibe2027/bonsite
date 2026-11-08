/**
 * VIBE Stripe Webhook Handler
 * Sécurité: HMAC-SHA256 signature verification + Idempotence
 *
 * Flow:
 * 1. Stripe envoie webhook → POST /api/webhooks/stripe
 * 2. Vérifier signature (HMAC-SHA256 avec WEBHOOK_SECRET)
 * 3. Récupérer l'event
 * 4. Si payment_intent.succeeded:
 *    - Matcher stripe_customer_id à utilisateur en DB
 *    - Assigner role 'premium'
 *    - Sauvegarder stripe_customer_id
 * 5. Répondre 200 OK pour confirmer à Stripe
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─────────────────────────────────────────────────────────────
// Initialize Supabase client (service_role bypasses RLS)
// ─────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─────────────────────────────────────────────────────────────
// HMAC Signature Verification
// ─────────────────────────────────────────────────────────────
function verifyStripeSignature(body, signature) {
  if (!WEBHOOK_SECRET || !signature) {
    console.error('❌ Missing WEBHOOK_SECRET or stripe-signature header');
    return false;
  }

  // Stripe signature format: t=timestamp,v1=hash
  const parts = signature.split(',');
  const timestamp = parts[0].split('=')[1];
  const hash = parts[1].split('=')[1];

  // Reconstruct signed content: timestamp.body
  const signedContent = `${timestamp}.${body}`;

  // Compute HMAC-SHA256
  const computed = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedContent)
    .digest('hex');

  // Compare using timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(computed)
  );
}

// ─────────────────────────────────────────────────────────────
// Assign Premium Role
// ─────────────────────────────────────────────────────────────
async function assignPremiumRole(authId, stripeCustomerId) {
  console.log(`🔄 Assigning premium role to auth_id: ${authId}`);

  // Find user by auth_id (NOT stripe_customer_id, to prevent race conditions)
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, stripe_customer_id, role')
    .eq('auth_id', authId)
    .single();

  if (fetchError || !user) {
    console.error(`❌ User not found for auth_id: ${authId}`);
    throw new Error(`User ${authId} not found in DB`);
  }

  // Check idempotence: if already has this stripe_customer_id, skip
  if (user.stripe_customer_id === stripeCustomerId) {
    console.log(`✅ User already linked to ${stripeCustomerId}, idempotent OK`);
    return user;
  }

  // Prevent duplicate stripe linking (edge case: user somehow linked to 2 Stripe customers)
  if (user.stripe_customer_id && user.stripe_customer_id !== stripeCustomerId) {
    console.warn(`⚠️ User already linked to different Stripe customer: ${user.stripe_customer_id}`);
    // Decide: Update (override) or reject. For now, we override (latest payment wins)
  }

  // Update user with stripe_customer_id and role
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
    console.error(`❌ Failed to update user: ${updateError.message}`);
    throw updateError;
  }

  console.log(`✅ Premium role assigned to ${authId}`);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// Main Webhook Handler
// ─────────────────────────────────────────────────────────────
async function handleWebhook(req, res) {
  // Get raw body for signature verification
  const rawBody = req.rawBody || req.body; // Depends on express config
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
    // Handle payment_intent.succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const stripeCustomerId = paymentIntent.customer;
      const metadata = paymentIntent.metadata || {};
      const authId = metadata.auth_id; // Must be set in checkout session

      if (!authId) {
        console.error('❌ Missing auth_id in payment metadata');
        return res.status(400).json({ error: 'Missing auth_id metadata' });
      }

      if (!stripeCustomerId) {
        console.error('❌ Missing customer ID in payment');
        return res.status(400).json({ error: 'Missing customer ID' });
      }

      // Assign premium role
      await assignPremiumRole(authId, stripeCustomerId);

      console.log(`✅ Payment processed for ${authId}`);
      return res.status(200).json({ received: true });
    }

    // Handle other event types (optional)
    if (event.type === 'payment_intent.payment_failed') {
      console.log('⚠️ Payment failed:', event.data.object.id);
      return res.status(200).json({ received: true });
    }

    // Ignore unknown events
    console.log(`⏭️ Ignoring event type: ${event.type}`);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`❌ Webhook processing error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// Express Middleware Setup (if using Express)
// ─────────────────────────────────────────────────────────────
// NOTE: Stripe requires RAW body for signature verification
// Configure express BEFORE other middleware:
//
// const express = require('express');
// const app = express();
//
// // Raw body for Stripe webhooks (must be BEFORE json middleware)
// app.post('/api/webhooks/stripe',
//   express.raw({ type: 'application/json' }),
//   handleWebhook
// );
//
// // Regular JSON parsing for other routes
// app.use(express.json());

module.exports = { handleWebhook, verifyStripeSignature, assignPremiumRole };
