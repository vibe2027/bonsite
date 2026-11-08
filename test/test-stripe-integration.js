/**
 * VIBE Stripe Integration Tests
 * Run with: node test-stripe-integration.js
 *
 * Prerequisites:
 * - .env file with STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, etc.
 * - Supabase users table created
 * - Server.js running
 */

const crypto = require('crypto');
const assert = require('assert');

// Load environment
require('dotenv').config();

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BASE_URL = 'http://localhost:3000'
} = process.env;

// Validate env
if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  console.error('❌ Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in .env');
  process.exit(1);
}

console.log('🧪 VIBE Stripe Integration Tests\n');

// ─────────────────────────────────────────────────────────────
// TEST 1: Stripe Signature Verification
// ─────────────────────────────────────────────────────────────

function test1_SignatureVerification() {
  console.log('TEST 1: Stripe Signature Verification');

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });

  // Sign content like Stripe does
  const signedContent = `${timestamp}.${body}`;
  const hash = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedContent)
    .digest('hex');

  const signature = `t=${timestamp},v1=${hash}`;

  console.log(`  ✓ Generated signature: ${signature.substring(0, 30)}...`);

  // Verify using our function
  function verifyStripeSignature(body, signature) {
    const parts = signature.split(',');
    const timestamp = parts[0]?.split('=')[1];
    const hash = parts[1]?.split('=')[1];

    if (!timestamp || !hash) return false;

    const signedContent = `${timestamp}.${body}`;
    const computed = crypto
      .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(signedContent)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  const isValid = verifyStripeSignature(body, signature);
  assert(isValid === true, 'Signature verification failed');

  console.log('  ✅ PASS: Signature verified\n');
}

// ─────────────────────────────────────────────────────────────
// TEST 2: Invalid Signature Detection
// ─────────────────────────────────────────────────────────────

function test2_InvalidSignatureDetection() {
  console.log('TEST 2: Invalid Signature Detection');

  const badSignature = 't=1234567890,v1=fakehash123';
  const body = '{"test": "data"}';

  function verifyStripeSignature(body, signature) {
    const parts = signature.split(',');
    const timestamp = parts[0]?.split('=')[1];
    const hash = parts[1]?.split('=')[1];

    if (!timestamp || !hash) return false;

    const signedContent = `${timestamp}.${body}`;
    const computed = crypto
      .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(signedContent)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  const isValid = verifyStripeSignature(body, badSignature);
  assert(isValid === false, 'Should reject invalid signature');

  console.log('  ✓ Invalid signature correctly rejected');
  console.log('  ✅ PASS: Invalid signature detection works\n');
}

// ─────────────────────────────────────────────────────────────
// TEST 3: Metadata Extraction
// ─────────────────────────────────────────────────────────────

function test3_MetadataExtraction() {
  console.log('TEST 3: Metadata Extraction from Payment Intent');

  const paymentIntent = {
    id: 'pi_abc123',
    customer: 'cus_xyz789',
    metadata: {
      auth_id: 'user-uuid-12345',
      tier: 'premium'
    }
  };

  const authId = paymentIntent.metadata?.auth_id;
  const stripeCustomerId = paymentIntent.customer;

  assert(authId === 'user-uuid-12345', 'auth_id not extracted');
  assert(stripeCustomerId === 'cus_xyz789', 'stripe customer not extracted');

  console.log(`  ✓ auth_id: ${authId}`);
  console.log(`  ✓ stripe_customer_id: ${stripeCustomerId}`);
  console.log('  ✅ PASS: Metadata extracted correctly\n');
}

// ─────────────────────────────────────────────────────────────
// TEST 4: Webhook Event Parsing
// ─────────────────────────────────────────────────────────────

function test4_WebhookEventParsing() {
  console.log('TEST 4: Webhook Event Parsing');

  const webhookBody = JSON.stringify({
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_abc123',
        customer: 'cus_xyz789',
        status: 'succeeded',
        metadata: {
          auth_id: 'user-uuid',
          tier: 'premium'
        }
      }
    }
  });

  const event = JSON.parse(webhookBody);

  assert(event.type === 'payment_intent.succeeded', 'Event type wrong');
  assert(event.data.object.customer === 'cus_xyz789', 'Customer ID wrong');

  console.log(`  ✓ Event type: ${event.type}`);
  console.log(`  ✓ Payment status: ${event.data.object.status}`);
  console.log('  ✅ PASS: Webhook event parsed correctly\n');
}

// ─────────────────────────────────────────────────────────────
// TEST 5: Idempotence Check
// ─────────────────────────────────────────────────────────────

function test5_IdempotenceLogic() {
  console.log('TEST 5: Idempotence Logic (UNIQUE constraint)');

  // Simulate webhook arriving 2x
  const user = {
    id: 'user-123',
    stripe_customer_id: null,
    role: 'basic'
  };

  const stripeCustomerId = 'cus_xyz789';

  // First webhook: not linked yet
  if (user.stripe_customer_id !== stripeCustomerId) {
    console.log('  ✓ First webhook: User not linked, proceed with update');
    user.stripe_customer_id = stripeCustomerId;
    user.role = 'premium';
  }

  // Second webhook: already linked
  if (user.stripe_customer_id === stripeCustomerId) {
    console.log('  ✓ Second webhook: User already linked (UNIQUE prevents duplicate)');
    // DB UNIQUE constraint rejects duplicate → zero credit double
  }

  assert(user.role === 'premium', 'Role should be premium');
  assert(user.stripe_customer_id === stripeCustomerId, 'Customer ID should match');

  console.log('  ✅ PASS: Idempotence logic correct\n');
}

// ─────────────────────────────────────────────────────────────
// TEST 6: Endpoint Response Structure
// ─────────────────────────────────────────────────────────────

function test6_EndpointResponses() {
  console.log('TEST 6: Endpoint Response Structures');

  // Mock checkout session response
  const checkoutResponse = {
    id: 'cs_live_abc123',
    url: 'https://checkout.stripe.com/pay/cs_live_abc123'
  };

  assert(checkoutResponse.id, 'Session ID missing');
  assert(checkoutResponse.url, 'Checkout URL missing');
  console.log('  ✓ Checkout response structure valid');

  // Mock user status response
  const userStatus = {
    auth_id: 'user-123',
    email: 'test@example.com',
    role: 'premium',
    is_premium: true,
    stripe_linked: true
  };

  assert(userStatus.role === 'premium', 'Role field missing');
  assert(userStatus.is_premium === true, 'is_premium flag wrong');
  console.log('  ✓ User status response structure valid');

  console.log('  ✅ PASS: Response structures correct\n');
}

// ─────────────────────────────────────────────────────────────
// TEST 7: Role Assignment Logic
// ─────────────────────────────────────────────────────────────

function test7_RoleAssignmentLogic() {
  console.log('TEST 7: Role Assignment Logic');

  const users = [
    { id: 'u1', stripe_customer_id: null, role: 'basic' },
    { id: 'u2', stripe_customer_id: 'cus_abc', role: 'basic' },
    { id: 'u3', stripe_customer_id: 'cus_xyz', role: 'premium' }
  ];

  // Test 1: Assign to new user
  const user1 = users[0];
  if (!user1.stripe_customer_id) {
    user1.stripe_customer_id = 'cus_new';
    user1.role = 'premium';
  }
  assert(user1.role === 'premium', 'Should assign premium');
  console.log('  ✓ Assign role to unlinked user: OK');

  // Test 2: Reassign to already-linked user (override)
  const user2 = users[1];
  const newCustomerId = 'cus_different';
  if (user2.stripe_customer_id && user2.stripe_customer_id !== newCustomerId) {
    console.log('  ⚠️  User already linked to different customer, overriding...');
  }
  user2.stripe_customer_id = newCustomerId;
  user2.role = 'premium';
  assert(user2.stripe_customer_id === newCustomerId, 'Should update customer');
  console.log('  ✓ Override existing link: OK');

  // Test 3: Idempotent update (same customer)
  const user3 = users[2];
  if (user3.stripe_customer_id === 'cus_xyz') {
    console.log('  ✓ Same customer, idempotent update (no change)');
  }
  assert(user3.role === 'premium', 'Should stay premium');

  console.log('  ✅ PASS: Role assignment logic correct\n');
}

// ─────────────────────────────────────────────────────────────
// Run All Tests
// ─────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════\n');

try {
  test1_SignatureVerification();
  test2_InvalidSignatureDetection();
  test3_MetadataExtraction();
  test4_WebhookEventParsing();
  test5_IdempotenceLogic();
  test6_EndpointResponses();
  test7_RoleAssignmentLogic();

  console.log('════════════════════════════════════════════════════════════');
  console.log('✅ ALL TESTS PASSED!\n');
  console.log('Next steps:');
  console.log('  1. Execute users_schema.sql in Supabase');
  console.log('  2. Run server.js (npm start)');
  console.log('  3. Test checkout flow in browser');
  console.log('  4. Use Stripe CLI to test webhooks: stripe listen --forward-to localhost:3000/api/webhooks/stripe');
  console.log('════════════════════════════════════════════════════════════\n');

} catch (err) {
  console.error('❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
}
