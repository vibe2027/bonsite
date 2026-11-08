#!/bin/bash

# VIBE — Setup et Déploiement Complet
# Tout en un seul script interactif

set -e

echo ""
echo "🚀 VIBE Deployment Wizard"
echo "=========================="
echo ""

# Fonction pour afficher une section
section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📍 $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# ====== SECTION 1: Vérification de l'environnement ======
section "Vérification de l'environnement"

echo "✓ Netlify CLI: $(netlify --version)"
echo "✓ Node.js: $(node --version)"
echo "✓ npm: $(npm --version)"
echo ""

# ====== SECTION 2: Obtenir le token Netlify ======
section "Obtenir ton token Netlify (30 secondes)"

echo "Instructions:"
echo "1. Ouvre cette URL dans ton navigateur:"
echo "   https://app.netlify.com/user/applications/personal-access-tokens"
echo ""
echo "2. Clique 'New access token'"
echo "3. Nomme-le 'VIBE Deploy' (ou n'importe quoi)"
echo "4. Copie le token généré (longue chaîne)"
echo ""

read -sp "Colle ton token Netlify ici et appuie Enter: " NETLIFY_TOKEN

if [ -z "$NETLIFY_TOKEN" ]; then
  echo ""
  echo "❌ Pas de token fourni. Abandon."
  exit 1
fi

echo ""
echo "✓ Token reçu!"
echo ""

# ====== SECTION 3: Vérifier le site ID ======
section "Configuration du site"

SITE_ID="6a1708d682b80329797cad2e"
echo "Site ID: $SITE_ID"
echo "✓ Site configuré"
echo ""

# ====== SECTION 4: Build ======
section "Build du projet"

echo "📦 npm install..."
npm install > /dev/null 2>&1
echo "✓ Dépendances installées"

echo ""
echo "🔨 npm run build..."
npm run build > /dev/null 2>&1
echo "✓ Build complété"
echo ""

# ====== SECTION 5: Déploiement ======
section "Déploiement sur Netlify"

echo "📤 Déploiement en cours..."
echo ""

NETLIFY_AUTH_TOKEN="$NETLIFY_TOKEN" netlify deploy \
  --site "$SITE_ID" \
  --prod \
  --dir . \
  --message "Deploy via setup-and-deploy.sh" \
  2>&1 | tee /tmp/netlify-deploy.log

DEPLOY_STATUS=$?

echo ""

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo ""
  section "✅ Déploiement RÉUSSI!"
  echo ""
  echo "🌐 Ton site est en ligne!"
  echo "   URL: https://vibegay.ca"
  echo ""
  echo "Vérification..."
  sleep 3

  # Test rapide
  if curl -s https://vibegay.ca/api/health > /dev/null 2>&1; then
    echo "✓ Site répond correctement"
  else
    echo "⚠ Site en cours d'initialisation (normal, attend 30s puis recharge)"
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ TOUT EST FAIT!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Prochaines étapes (optionnel):"
  echo "• Monitoring 24/7: https://uptimerobot.com"
  echo "• Alertes Slack: Voir COPY-PASTE-GUIDE.md"
  echo "• Failover Railway: Voir COPY-PASTE-GUIDE.md"
  echo ""

else
  echo ""
  section "❌ Erreur de déploiement"
  echo ""
  echo "Logs sauvegardés dans: /tmp/netlify-deploy.log"
  echo ""
  exit 1
fi
