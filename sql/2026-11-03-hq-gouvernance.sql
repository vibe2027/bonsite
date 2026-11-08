-- ============================================================
-- VIBE — Gouvernance QG (delta idempotent, base fhksytcoyjtcrkmhnoyw)
-- ============================================================
-- Ce delta ne recrée RIEN de ce qui existe déjà et fonctionne :
--   billets_vip_1500 (duree, accord_fondateur, expire_le), evenements_vibe,
--   profiles_protect, enregistrer_vue(), qui_ma_vu(), vues_profil,
--   handle_new_user() (essai 7 jours + promotion QG), hq_promouvoir_apres_confirmation().
-- Colonnes conservées telles quelles : boost_expire_le, ghost_mode_expire_le,
--   ghost_mode, trial_until, visites_until, montre_active.
--
-- Ce qu'il ajoute :
--   1. Les courriels Fondateur / COO dans hq_command_emails (les deux
--      orthographes du COO : jmarcreid et jmarceid).
--   2. Une promotion immédiate des comptes déjà existants et confirmés.
--   La promotion automatique à l'inscription est déjà assurée par
--   handle_new_user() + on_auth_user_confirmed_hq (courriel confirmé requis).
-- ============================================================

insert into public.hq_command_emails (email, role) values
  ('vibevibre2027@hotmail.com', 'founder'),
  ('support@vibegay.ca',        'founder'),
  ('vibequebec@hotmail.com',    'founder'),
  ('vibeqbc2026@hotmail.com',   'founder'),
  ('jmarcreid@gmail.com',       'coo'),
  ('jmarceid@gmail.com',        'coo')
on conflict (email) do nothing;

-- Promotion des comptes déjà créés ET confirmés (même logique que
-- hq_promouvoir_apres_confirmation : le trigger de protection laisse passer service_role).
do $$
declare r record;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  for r in
    select u.id, c.role
      from auth.users u
      join public.hq_command_emails c on c.email = lower(u.email)
     where u.email_confirmed_at is not null
  loop
    update public.profiles
       set is_admin        = (r.role = 'founder'),
           is_founder      = true,
           is_immune       = true,
           membership_tier = 'founder',
           acces_expire_le = null
     where id = r.id;
  end loop;
end $$;

-- ============================================================
-- 3. hq_offrir_extra : le Fondateur offre un Extra à un membre
--    (Boost, Fantôme, Qui m'a consulté, Montre). Fondateur seulement.
--    Déjà appliqué dans la base fhksytcoyjtcrkmhnoyw.
-- ============================================================
create or replace function public.hq_offrir_extra(p_email text, p_extra text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_uid uuid;
  v_now timestamptz := now();
  v_dest text;
begin
  if coalesce(public.hq_caller_role(), '') <> 'founder' then
    return jsonb_build_object('ok', false, 'error', 'Réservé au Fondateur.');
  end if;
  if p_extra is null or p_extra not in ('boost', 'fantome', 'visites', 'montre') then
    return jsonb_build_object('ok', false, 'error', 'Extra invalide (boost, fantome, visites, montre).');
  end if;
  v_dest := lower(trim(coalesce(p_email, '')));
  select u.id into v_uid from auth.users u where lower(u.email) = v_dest;
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Aucun compte avec ce courriel.');
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'Profil introuvable.');
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  if p_extra = 'boost' then
    update public.profiles set boost_expire_le = greatest(v_now, coalesce(boost_expire_le, v_now)) + interval '1 day' where id = v_uid;
  elsif p_extra = 'fantome' then
    update public.profiles set ghost_mode_expire_le = greatest(v_now, coalesce(ghost_mode_expire_le, v_now)) + interval '7 days' where id = v_uid;
  elsif p_extra = 'visites' then
    update public.profiles set visites_until = greatest(v_now, coalesce(visites_until, v_now)) + interval '7 days' where id = v_uid;
  end if;

  insert into public.payments (user_id, stripe_payment_intent_id, amount, currency, status, plan)
  values (v_uid, 'offert-' || gen_random_uuid()::text, 0, 'cad', 'offert', p_extra);

  return jsonb_build_object('ok', true, 'extra', p_extra);
end;
$fn$;

revoke all on function public.hq_offrir_extra(text, text) from public, anon;
grant execute on function public.hq_offrir_extra(text, text) to authenticated;
