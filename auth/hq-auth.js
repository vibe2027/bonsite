/**
 * VIBE — Authentification vérifiée (JWT Supabase) + rôles du QG
 *
 * Remplace les anciens contrôles basés sur des en-têtes envoyés par le client
 * (x-user-role, x-user-id, Authorization = identifiant brut), qui pouvaient être
 * falsifiés par n'importe qui.
 *
 * Source de vérité des rôles : table public.hq_command_emails (founder | coo),
 * valable seulement si le courriel du compte est confirmé.
 */

const { createClient } = require('@supabase/supabase-js');

let _sb = null;
function sb() {
  if (!_sb) {
    _sb = createClient(require('../lib/supabase-key').url, require('../lib/supabase-key').key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return _sb;
}

function bearerToken(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  return m ? m[1].trim() : null;
}

/** Retourne l'utilisateur Supabase correspondant au JWT, ou null. */
async function getUserFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const { data, error } = await sb().auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}

/** Rôle QG ('founder' | 'coo') ou null. Exige un courriel confirmé. */
async function getHqRole(user) {
  if (!user || !user.email || !user.email_confirmed_at) return null;
  try {
    const { data } = await sb()
      .from('hq_command_emails')
      .select('role')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();
    return data ? data.role : null;
  } catch (e) {
    return null;
  }
}

/** Middleware : JWT valide requis. Pose req.user et req.userId. */
async function verifyAuth(req, res, next) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentification requise' });
  req.user = user;
  req.userId = user.id;
  next();
}

/**
 * Middleware : JWT valide ET rôle QG parmi `roles` (par défaut founder + coo).
 * Pose req.user, req.userId et req.hq = { role, email }.
 */
function requireHq(roles) {
  const allowed = roles && roles.length ? roles : ['founder', 'coo'];
  return async function (req, res, next) {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentification requise' });
    const role = await getHqRole(user);
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    req.user = user;
    req.userId = user.id;
    req.hq = { role, email: user.email.toLowerCase() };
    next();
  };
}

module.exports = { getUserFromRequest, getHqRole, verifyAuth, requireHq };
