#!/usr/bin/env node

/**
 * Pre-Deployment Validation Script
 * Vérifie toutes les dépendances et configurations avant déploiement Phase 6
 *
 * Usage: node pre-deployment-check.js
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const checks = [];
let passCount = 0;
let failCount = 0;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = (level, message) => {
  const prefix = {
    '✅': `${colors.green}✅${colors.reset}`,
    '❌': `${colors.red}❌${colors.reset}`,
    '⚠️': `${colors.yellow}⚠️${colors.reset}`,
    'ℹ️': `${colors.blue}ℹ️${colors.reset}`
  };
  console.log(`${prefix[level]} ${message}`);
};

const addCheck = (name, passed, message) => {
  checks.push({ name, passed, message });
  if (passed) {
    passCount++;
    log('✅', `${name}: ${message}`);
  } else {
    failCount++;
    log('❌', `${name}: ${message}`);
  }
};

const separator = () => console.log('\n' + '='.repeat(60) + '\n');

// ============================================
// CHECK 1: Environment Variables
// ============================================

console.log(`${colors.blue}🔍 Vérification Variables d'Environnement${colors.reset}\n`);

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'ELASTICSEARCH_URL',
  'OPENAI_API_KEY',
  'TURN_SERVER_URL',
  'TURN_USERNAME',
  'TURN_PASSWORD'
];

requiredEnvVars.forEach(varName => {
  const exists = !!process.env[varName];
  addCheck(
    `Variable ${varName}`,
    exists,
    exists ? 'Définie' : 'Manquante ou vide'
  );
});

separator();

// Only run if this file is executed directly (not imported)
if (require.main === module) {
  runValidation();
}

async function runValidation() {
  // ============================================
  // CHECK 2: Supabase Connection
  // ============================================

  console.log(`${colors.blue}🔍 Vérification Supabase${colors.reset}\n`);
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data, error } = await supabase.from('users').select('COUNT(*)', { count: 'exact' }).limit(1);
    addCheck(
      'Connexion Supabase',
      !error,
      error ? `Erreur: ${error.message}` : 'Connectée'
    );

    // Vérifier tables Phase 6
    const phase6Tables = [
      'operation_history',
      'document_snapshots',
      'search_logs',
      'user_interactions',
      'recommendation_logs',
      'video_calls',
      'call_signaling',
      'video_recordings',
      'moderation_logs',
      'moderation_queue',
      'tribunal_cases'
    ];

    for (const table of phase6Tables) {
      const { error } = await supabase.from(table).select('COUNT(*)', { count: 'exact' }).limit(1);
      addCheck(
        `Table ${table}`,
        !error,
        error ? `Non trouvée: ${error.message}` : 'OK'
      );
    }

  } catch (err) {
    addCheck('Supabase Setup', false, `Exception: ${err.message}`);
  }

  separator();

  // ============================================
  // CHECK 3: Elasticsearch
  // ============================================

  console.log(`${colors.blue}🔍 Vérification Elasticsearch${colors.reset}\n`);

  try {
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const auth = process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
      ? {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD
        }
      : undefined;

    const response = await axios.get(`${esUrl}/_health`, { auth });
    const isHealthy = response.data.status === 'green' || response.data.status === 'yellow';

    addCheck(
      'Elasticsearch Health',
      isHealthy,
      `Status: ${response.data.status}`
    );

    addCheck(
      'Elasticsearch Uptime',
      response.data.uptime_in_millis > 0,
      `Uptime: ${Math.floor(response.data.uptime_in_millis / 1000)}s`
    );

  } catch (err) {
    addCheck('Elasticsearch Connection', false, `Erreur: ${err.message}`);
  }

  separator();

  // ============================================
  // CHECK 4: OpenAI API
  // ============================================

  console.log(`${colors.blue}🔍 Vérification OpenAI API${colors.reset}\n`);

  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    addCheck(
      'OpenAI API Key',
      response.status === 200,
      `${response.data.data.length} modèles disponibles`
    );

    // Test moderation endpoint
    const modResponse = await axios.post(
      'https://api.openai.com/v1/moderations',
      { input: 'Hello, this is a test.' },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    addCheck(
      'OpenAI Moderation Endpoint',
      modResponse.status === 200,
      'Endpoint fonctionnel'
    );

  } catch (err) {
    addCheck('OpenAI Configuration', false, `Erreur: ${err.message}`);
  }

  separator();

  // ============================================
  // CHECK 5: TURN Server
  // ============================================

  console.log(`${colors.blue}🔍 Vérification TURN Server${colors.reset}\n`);

  try {
    const turnUrl = process.env.TURN_SERVER_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnPassword = process.env.TURN_PASSWORD;

    addCheck(
      'TURN Server Configuration',
      turnUrl && turnUsername && turnPassword,
      'Tous les paramètres définis'
    );

    log('ℹ️', `TURN Server: ${turnUrl}`);
    log('ℹ️', 'Note: Validation complète nécessite stunclient ou turnclient');

  } catch (err) {
    addCheck('TURN Server Check', false, `Erreur: ${err.message}`);
  }

  separator();

  // ============================================
  // CHECK 6: Feature Flags
  // ============================================

  console.log(`${colors.blue}🔍 Vérification Feature Flags${colors.reset}\n`);

  const featureFlags = [
    'FEATURE_FLAG_REALTIME_COLLAB',
    'FEATURE_FLAG_ADVANCED_SEARCH',
    'FEATURE_FLAG_RECOMMENDATIONS',
    'FEATURE_FLAG_MOBILE_APP',
    'FEATURE_FLAG_WEBRTC_VIDEO',
    'FEATURE_FLAG_NLP_MODERATION'
  ];

  featureFlags.forEach(flag => {
    const value = process.env[flag];
    const isEnabled = value === 'true' || value === '1' || value === 'yes';
    log('ℹ️', `${flag}: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
  });

  separator();

  // ============================================
  // SUMMARY
  // ============================================

  console.log(`${colors.blue}📊 Résumé${colors.reset}\n`);
  console.log(`${colors.green}✅ Réussis: ${passCount}${colors.reset}`);
  console.log(`${colors.red}❌ Échoués: ${failCount}${colors.reset}`);

  if (failCount === 0) {
    console.log(`\n${colors.green}🚀 Tous les contrôles sont passés!${colors.reset}`);
    console.log(`${colors.green}Vous pouvez procéder au déploiement.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}⚠️ ${failCount} contrôle(s) ont échoué.${colors.reset}`);
    console.log(`${colors.red}Veuillez corriger les erreurs avant le déploiement.${colors.reset}\n`);
    process.exit(1);
  }
}
