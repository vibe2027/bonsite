/**
 * VIBE Stripe Frontend Integration
 * Add to index.html <script> section
 *
 * Usage:
 * - Call upgradeToPremiumn() when user clicks upgrade button
 * - Displays user's current role on dashboard
 */

// ─────────────────────────────────────────────────────────────
// Check User Payment Status on Page Load
// ─────────────────────────────────────────────────────────────

(async function initPaymentStatus() {
  try {
    const { data: { user } } = await window._supa.auth.getUser();
    if (!user) return; // Not authenticated

    // Fetch user status from backend
    const response = await fetch('/api/user/status', {
      headers: { 'Authorization': `Bearer ${user.id}` }
    });

    if (!response.ok) return;

    const status = await response.json();

    // Update UI based on role
    updatePaymentUI(status.role, status.is_premium);

  } catch (err) {
    console.warn('⚠️ Payment status check error:', err.message);
  }
})();

// ─────────────────────────────────────────────────────────────
// Upgrade to Premium
// ─────────────────────────────────────────────────────────────

async function upgradeToPremiumn(tier = 'premium') {
  try {
    console.log(`💳 Starting ${tier} checkout...`);

    // Get current user
    const { data: { user }, error: authError } = await window._supa.auth.getUser();

    if (authError || !user) {
      alert('❌ Session expirée — reconnecte-toi');
      return;
    }

    // Disable button to prevent double-clicks
    const btn = document.querySelector('[data-upgrade-btn]');
    if (btn) btn.disabled = true;

    // Call backend to create Stripe checkout session
    const response = await fetch('/api/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.id}`
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
    console.log(`✅ Checkout session created: ${session.id}`);

    // Redirect to Stripe Checkout
    window.location.href = session.url;

  } catch (err) {
    console.error(`❌ Checkout error: ${err.message}`);
    alert(`❌ Erreur: ${err.message}`);

    // Re-enable button
    const btn = document.querySelector('[data-upgrade-btn]');
    if (btn) btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Update UI Based on Payment Status
// ─────────────────────────────────────────────────────────────

function updatePaymentUI(role, isPremium) {
  // Hide/show upgrade button
  const upgradeBtn = document.querySelector('[data-upgrade-btn]');
  if (upgradeBtn) {
    upgradeBtn.style.display = isPremium ? 'none' : 'block';
  }

  // Show premium badge
  if (isPremium) {
    const badge = document.querySelector('[data-premium-badge]');
    if (badge) badge.style.display = 'block';
  }

  // Update role display
  const roleDisplay = document.querySelector('[data-role-display]');
  if (roleDisplay) {
    roleDisplay.textContent = role === 'premium' ? '💎 Premium' : '👤 Basic';
  }
}

// ─────────────────────────────────────────────────────────────
// Handle Payment Success/Failure Redirects
// ─────────────────────────────────────────────────────────────

(function handlePaymentRedirect() {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get('payment');

  if (!paymentStatus) return;

  let message = '';
  let color = '';

  switch (paymentStatus) {
    case 'success':
      message = '✅ Paiement réussi! Bienvenue premium 💎';
      color = 'green';
      break;
    case 'cancelled':
      message = '❌ Paiement annulé';
      color = 'orange';
      break;
    case 'failed':
      message = '❌ Paiement échoué';
      color = 'red';
      break;
    case 'error':
      message = '❌ Erreur lors du traitement';
      color = 'red';
      break;
  }

  if (message) {
    // Display toast/notification
    console.log(`[${paymentStatus.toUpperCase()}] ${message}`);

    // Optional: Show fancy notification
    showNotification(message, color);

    // Clear URL params
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();

// ─────────────────────────────────────────────────────────────
// Simple Notification
// ─────────────────────────────────────────────────────────────

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'green' ? '#10b981' : type === 'red' ? '#ef4444' : '#f59e0b'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => notification.remove(), 5000);
}

// ─────────────────────────────────────────────────────────────
// Expose to window for onclick handlers
// ─────────────────────────────────────────────────────────────

window.VIBE_Stripe = {
  upgradeToPremiumn,
  updatePaymentUI,
  showNotification
};
