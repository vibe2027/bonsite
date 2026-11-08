/**
 * VIBE — Clés Supabase avec repli sûr au démarrage.
 *
 * Si SUPABASE_SERVICE_ROLE_KEY est absente, on retombe sur la clé publique `anon`
 * (publique par conception, soumise aux politiques RLS) pour que le serveur démarre
 * au lieu de planter. Dans ce mode, le serveur n'a PAS les droits d'administration :
 * les routes de paiement et d'administration refusent de fonctionner (503 / 403).
 */
const DEFAULT_URL = 'https://fhksytcoyjtcrkmhnoyw.supabase.co';
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa3N5dGNveWp0Y3JrbWhub3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkzODIsImV4cCI6MjA5MjE3NTM4Mn0.nW9xgEQSuXlq96d53AFE7jUADmr04YdMoD9hCNmw64k';

const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON = process.env.SUPABASE_ANON_KEY || DEFAULT_ANON;
const HAS_SERVICE_KEY = !!SERVICE;
const HAS_STRIPE_KEY = /^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY || '') &&
  process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder';

if (!HAS_SERVICE_KEY) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY absente : mode dégradé (clé anon). Paiements et administration désactivés.');
}

module.exports = {
  url: process.env.SUPABASE_URL || DEFAULT_URL,
  key: SERVICE || ANON,
  anon: ANON,
  HAS_SERVICE_KEY,
  HAS_STRIPE_KEY
};
