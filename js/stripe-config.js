/**
 * VIBE — Paiements
 *
 * ⚠️ STRIPE HORS SERVICE (compte fermé le 2026-08-17)
 * Stripe a fermé le compte marchand acct_1TdsbPAZtcXHdCSG. Les liens
 * buy.stripe.com ci-dessous renvoient « no valid payment methods » et ne
 * peuvent plus encaisser. Ils sont conservés pour référence uniquement.
 *
 * En attendant un nouveau processeur, `enabled: false` fait basculer tous
 * les boutons d'achat vers les instructions de virement Interac.
 *
 * POUR RÉACTIVER : remettre `enabled: true` et remplacer les liens
 * ci-dessous par ceux du nouveau compte marchand.
 */
window.VIBE_STRIPE = {
  enabled: false,

  currency: 'CAD',

  /* Liens de l'ancien compte — INACTIFS */
  pionnier: 'https://buy.stripe.com/5kQ6oJ8Rc1rVb563rx9R609',
  founder_onetime: 'https://buy.stripe.com/28E14pgjE0nR5KM7HN9R608',
  mois1: 'https://buy.stripe.com/3cIdRbd7sfiL3CEd279R60d',
  mois3: 'https://buy.stripe.com/fZubJ3ebw1rV5KM5zF9R601',
  mois6: 'https://buy.stripe.com/fZu28t0kG8Un7SU8LR9R603',
  an1: 'https://buy.stripe.com/aFaaEZ9Vg5Ibflmfaf9R60e',
  boost: 'https://buy.stripe.com/eVqeVf3wSc6zflm1jp9R604',
  fantome: 'https://buy.stripe.com/fZu3cx4AW6Mfb565zF9R60b',
  visites: 'https://buy.stripe.com/eVq9AVgjE8Un0qs6DJ9R60c',
  montre: '', // à renseigner quand le nouveau processeur de paiement est actif
  tribunal: 'https://buy.stripe.com/dRmcN79VgeeHc9aaTZ9R607',

  interac_email: 'support@vibegay.ca'
};

/* Page expliquant le virement Interac, utilisée tant que `enabled` est faux */
window.VIBE_PAGE_PAIEMENT = '/paiement.html';

window.vibeCheckout = function (key) {
  var cfg = window.VIBE_STRIPE || {};

  // Compte marchand fermé : envoyer vers la page Interac plutôt que vers un lien mort.
  if (!cfg.enabled) {
    window.location.href = window.VIBE_PAGE_PAIEMENT + (key ? '?p=' + encodeURIComponent(key) : '');
    return;
  }

  var url = cfg[key];
  if (!url) {
    if (typeof showError === 'function') showError('⚠ Paiement indisponible.');
    return;
  }
  var user = window.CURRENT_USER;
  var sep = url.indexOf('?') >= 0 ? '&' : '?';
  if (user && user.email) {
    url += sep + 'prefilled_email=' + encodeURIComponent(user.email);
    sep = '&';
  }
  if (user && user.id) {
    url += sep + 'client_reference_id=' + encodeURIComponent(user.id);
  }
  window.location.href = url;
};
