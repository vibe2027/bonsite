-- ═══════════════════════════════════════════════════════════════════
-- VIBE — Vérification post-migration
--
-- À exécuter APRÈS align-backend-to-live-db.sql sur fhksytcoyjtcrkmhnoyw.
-- Compare le résultat à la ligne de base ci-dessous : toute différence
-- sur les valeurs marquées « doit être identique » signale une régression
-- et justifie le rollback documenté dans align-backend-to-live-db.sql.
--
-- Ces requêtes reproduisent exactement les appels que le site vivant
-- adresse à la base, relevés dans les edge logs :
--   POST /rest/v1/rpc/stats_publiques
--   POST /rest/v1/rpc/membres_par_ville
--   GET  /rest/v1/salon_messages?salon=eq.flottant
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- LIGNE DE BASE — capturée le 2026-08-28 19:11:02 UTC, avant migration
--
--   stats_publiques        : membres 5, fondateurs_payes 0,
--                            places_totales 500, places_restantes 500,
--                            sos 3, dossiers 1
--   membres_par_ville      : 1 ligne
--   salon_messages flottant: 2
--   profiles               : 4
--   founder_codes          : 500
--   salons                 : 27
--   members                : 14
-- ───────────────────────────────────────────────────────────────────

select
  -- Doivent être IDENTIQUES à la ligne de base.
  -- (membres et messages peuvent avoir augmenté si de vrais utilisateurs
  --  ont été actifs entre-temps : une hausse est normale, une baisse ou
  --  une erreur ne l'est pas.)
  (select public.stats_publiques())::text            as stats_publiques,
  (select count(*) from public.membres_par_ville())  as lignes_membres_par_ville,
  (select count(*) from public.salon_messages
     where salon = 'flottant')                       as messages_flottant,
  (select count(*) from public.profiles)             as profiles,
  (select count(*) from public.founder_codes)        as codes_fondateurs,
  (select count(*) from public.salons)               as salons,
  (select count(*) from public.members)              as members,

  -- Nouveaux, absents de la ligne de base.
  (select count(*) from public.users)                as users_attendu_4,
  (select count(*) from public.users
     where role = 'admin')                           as admins_attendu_1,
  (select count(*) from public.users
     where subscription_tier = 'basic')              as basic_attendu_3,
  (select count(*) from pg_trigger
     where tgname = 'profiles_sync_to_users')        as trigger_attendu_1,

  now()::text                                        as verifie_le;

-- ───────────────────────────────────────────────────────────────────
-- Contrôles complémentaires
-- ───────────────────────────────────────────────────────────────────

-- 1. Aucune erreur côté API dans les minutes suivant la migration.
--    À lancer via les logs Supabase (edge_logs), en cherchant les
--    statuts >= 400 sur la fenêtre d'exécution.

-- 2. Le trigger n'écoute que les colonnes projetées : vérifier qu'un
--    battement de présence ne le déclenche pas.
--    select tgname, pg_get_triggerdef(oid) from pg_trigger
--      where tgname = 'profiles_sync_to_users';
--    La définition doit contenir « UPDATE OF real_email, display_name,
--    username, city, is_admin, is_cofondateur, membership_tier,
--    photo_verifiee » et NON un « UPDATE » nu.

-- 3. Côté backend Express :
--    GET https://www.vibegay.ca/health          → config.supabase_service_role = true
--    GET https://www.vibegay.ca/pubs/active/voix → 200
