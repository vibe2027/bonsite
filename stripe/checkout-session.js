/**
 * VIBE Stripe Checkout Session Creator
 * Frontend function to initiate payment flow
 *
 * Usage:
 * const session = await createCheckoutSession('premium');
 * window.location.href = session.url; // Redirect to Stripe Checkout
 */

async function createCheckoutSession(tier = 'premium') {
  try {
    // 1. Get current user
    const { data: { user }, error: authError } = await window._supa.auth.getUser();

    if (authError || !user) {
      throw new Error('Session expirée — reconnecte-toi');
    }

    console.log(`🛒 Creating checkout session for ${user.id} (${tier})`);

    // 2. Call backend endpoint to create Stripe session
    // (Your backend handles Stripe SDK calls — frontend never touches Stripe API directly)
    const response = await fetch('/api/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.id}` // Optional: for backend validation
      },
      body: JSON.stringify({
        tier,
        auth_id: user.id,
        email: user.email
      })
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const session = await response.json();
    console.log(`✅ Session created:`, session.id);

    // 3. Redirect to Stripe Checkout
    // (Stripe.js redirects to hosted checkout)
    window.location.href = session.url;

  } catch (err) {
    console.error(`❌ Checkout error: ${err.message}`);
    alert(`Erreur: ${err.message}`);
  }
}

/**
 * BACKEND ENDPOINT (Node.js/Express)
 * This runs on YOUR server, not the browser
 *
 * POST /api/checkout-session
 * {
 *   "tier": "premium",
 *   "auth_id": "user-uuid",
 *   "email": "user@example.com"
 * }
 */

// ─────────────────────────────────────────────────────────────
// Backend Implementation (Express + Stripe Node SDK)
// ─────────────────────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');
const app = express();

// Pricing (adjust as needed)
const PRICING = {
  premium: {
    priceId: 'price_xyz123', // Get from Stripe Dashboard
    name: 'Premium Pass',
    description: '1 month of premium features'
  },
  founder: {
    priceId: 'price_abc789',
    name: 'Founder Pass',
    description: 'Lifetime founder benefits'
  }
};

app.post('/api/checkout-session', express.json(), async (req, res) => {
  try {
    const { tier, auth_id, email } = req.body;

    if (!PRICING[tier]) {
      return res.status(400).json({ error: `Invalid tier: ${tier}` });
    }

    console.log(`🛒 Creating Stripe session for ${auth_id} (${tier})`);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICING[tier].priceId,
          quantity: 1
        }
      ],
      mode: 'payment', // or 'subscription' for recurring
      customer_email: email,

      // ⚠️ CRITICAL: Metadata links payment back to user
      // This is the ONLY way to know which user made the payment
      metadata: {
        auth_id, // Your app's user ID
        tier
      },

      // Redirect after payment
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
// Test Payment Success Redirect
// ─────────────────────────────────────────────────────────────

app.get('/payment/success', async (req, res) => {
  const { session_id } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const authId = session.metadata.auth_id;

    console.log(`✅ Payment confirmed for ${authId}`);
    // Update user role (optional — webhook already did this)
    // Redirect to dashboard
    res.redirect('/dashboard?payment=success');

  } catch (err) {
    console.error(`❌ Success page error: ${err.message}`);
    res.redirect('/dashboard?payment=failed');
  }
});

app.get('/payment/cancelled', (req, res) => {
  res.redirect('/dashboard?payment=cancelled');
});

module.exports = { createCheckoutSession };
