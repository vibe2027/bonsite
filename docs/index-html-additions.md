# HTML Additions for Stripe Integration

## 1. Add to `<style>` section (before `</style>`)

```css
/* ─────────────────────────────────────────────────────────────
   Stripe Payment UI Styles
   ───────────────────────────────────────────────────────────── */

[data-upgrade-btn] {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

[data-upgrade-btn]:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

[data-upgrade-btn]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

[data-premium-badge] {
  display: none;
  padding: 8px 16px;
  background: linear-gradient(135deg, #fbbf24 0%, #f97316 100%);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-left: 10px;
}

[data-role-display] {
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 8px;
}

.payment-status {
  padding: 12px;
  border-radius: 8px;
  margin: 10px 0;
  font-size: 14px;
  font-weight: 500;
}

.payment-status.success {
  background: #d1fae5;
  color: #065f46;
  border-left: 4px solid #10b981;
}

.payment-status.error {
  background: #fee2e2;
  color: #7f1d1d;
  border-left: 4px solid #ef4444;
}
```

---

## 2. Add to Dashboard/Profile Section (in `<body>`)

Ajoute cet HTML là où tu veux le bouton d'upgrade et l'affichage du rôle:

```html
<!-- User Status Section -->
<div class="user-status" style="padding: 20px; background: rgba(255,255,255,0.1); border-radius: 12px; margin: 20px 0;">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <div>
      <p style="margin: 0; font-size: 14px; opacity: 0.8;">Statut actuel</p>
      <div style="display: flex; align-items: center; margin-top: 8px;">
        <span data-role-display>👤 Basic</span>
      </div>
    </div>

    <!-- Upgrade Button (hidden if already premium) -->
    <button 
      data-upgrade-btn
      onclick="window.VIBE_Stripe.upgradeToPremiumn('premium')"
      style="display: block;"
    >
      💎 Devenir Premium
    </button>

    <!-- Premium Badge (shown if premium) -->
    <div data-premium-badge style="display: none;">
      ✨ Premium Activé
    </div>
  </div>

  <!-- Payment Status Messages -->
  <div id="payment-message" style="margin-top: 15px;"></div>
</div>
```

---

## 3. Add Scripts (before `</body>`)

```html
<!-- Stripe Integration -->
<script src="/js/stripe-frontend.js" defer></script>

<!-- Optional: Stripe.js library (if you want to use Stripe Elements)
<script src="https://js.stripe.com/v3/"></script>
-->
```

---

## 4. Alternative: Simple Button in Navigation

Si tu veux juste un petit bouton de navigation:

```html
<!-- Navigation Bar -->
<nav class="navbar">
  <!-- ... autres éléments nav ... -->

  <div style="display: flex; gap: 12px; align-items: center;">
    <span data-role-display style="font-size: 14px;">👤 Basic</span>
    
    <button 
      data-upgrade-btn
      onclick="window.VIBE_Stripe.upgradeToPremiumn('premium')"
      style="
        padding: 8px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
      "
    >
      💎 Premium
    </button>
  </div>
</nav>
```

---

## 5. Checkout Success Page (Optional)

Crée une page `/payment/success.html` pour afficher un beau message:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Paiement Réussi — VIBE</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
    }

    .success-card {
      background: white;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
    }

    .success-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    h1 {
      margin: 0 0 10px;
      color: #333;
    }

    p {
      color: #666;
      line-height: 1.6;
      margin: 15px 0;
    }

    .button {
      display: inline-block;
      padding: 12px 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 20px;
      transition: transform 0.3s ease;
    }

    .button:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="success-card">
    <div class="success-icon">✨</div>
    <h1>Paiement Réussi! 💎</h1>
    <p>Bienvenue dans la communauté premium de VIBE.</p>
    <p>Vous avez maintenant accès à toutes les fonctionnalités premium.</p>
    <a href="/dashboard" class="button">Aller au Dashboard</a>
  </div>
</body>
</html>
```

---

## 6. Update Meta Tags (in `<head>`)

```html
<!-- Stripe Meta Tags (optional, for security) -->
<meta name="stripe-public-key" content="pk_live_...">
```

---

## Summary of Changes to index.html

| Section | Action | Location |
|---------|--------|----------|
| `<style>` | Add CSS from section 1 | Before `</style>` |
| `<body>` | Add User Status div from section 2 | In profile/dashboard area |
| `<body>` | Add script tag from section 3 | Before `</body>` |
| Navigation | Update with role display + button | In navbar |

---

## Expected Result

After integration:
- ✅ Button shows "💎 Devenir Premium" (or hidden if already premium)
- ✅ Click button → redirects to Stripe Checkout
- ✅ User pays
- ✅ Webhook updates DB
- ✅ User redirected to success page
- ✅ Dashboard shows "Premium" badge
- ✅ Premium features unlocked

