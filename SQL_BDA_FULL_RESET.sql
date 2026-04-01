-- ============================================================
--  BDA — RESET COMPLET + PSEUDO UNIQUE
--  Supprime TOUTES les donnees joueurs (comptes, points, cartes,
--  badges, defis valides, commandes, sutom, lots gagnes).
--  Conserve les definitions (cartes, packs, badges, lots, menu).
--  Ajoute la contrainte pseudo unique par site.
--  A executer dans Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1. VIDER LES DONNEES JOUEURS (ordre = FK d'abord)
-- ============================================================

-- Lots gagnes
DELETE FROM bda_lot_wins WHERE site_id = 'bda';

-- Commandes hotlines
DELETE FROM bda_hotlines_orders WHERE site_id = 'bda';

-- Pack openings
DELETE FROM bda_pack_openings WHERE site_id = 'bda';

-- Cartes obtenues par les joueurs
DELETE FROM bda_user_cards WHERE site_id = 'bda';

-- Badges obtenus par les joueurs
DELETE FROM bda_user_badges WHERE site_id = 'bda';

-- Cartes personnalisees
DELETE FROM bda_custom_cards WHERE site_id = 'bda';

-- Validations de defis (challenge_validations)
DELETE FROM challenge_validations WHERE site_id = 'bda';

-- Transactions (toutes)
DELETE FROM transactions WHERE site_id = 'bda';

-- Achats boutique
DELETE FROM achats WHERE site_id = 'bda';

-- Comptes joueurs
DELETE FROM etudiants WHERE site_id = 'bda';

-- ============================================================
-- 2. RESET DES STOCKS DE LOTS
-- ============================================================
UPDATE bda_lots
SET qty_remaining = qty_total
WHERE site_id = 'bda';

-- ============================================================
-- 3. SUPPRIMER LES UTILISATEURS SUPABASE AUTH
--    (vide la table auth.users pour que les gens
--     doivent se re-inscrire)
-- ============================================================
-- ATTENTION : ceci supprime TOUS les users Supabase Auth,
-- y compris les admins. Vous devrez re-creer les admins.
DELETE FROM auth.users;

-- ============================================================
-- 4. AJOUTER CONTRAINTE PSEUDO UNIQUE PAR SITE
--    (empeche deux joueurs d'avoir le meme pseudo)
-- ============================================================
-- D'abord supprimer si elle existe deja
ALTER TABLE etudiants DROP CONSTRAINT IF EXISTS uq_etudiants_site_pseudo;

-- Creer un index unique partiel (ignore les NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_etudiants_site_pseudo
  ON etudiants (site_id, LOWER(pseudo))
  WHERE pseudo IS NOT NULL AND pseudo != '';

-- ============================================================
-- FIN — Resume :
-- - Tous les comptes supprimes (etudiants + auth.users)
-- - Toutes les transactions, cartes, badges, lots gagnes supprimes
-- - Stocks de lots remis a leur valeur initiale
-- - Pseudo unique par site (case-insensitive)
-- - Les definitions (bda_cards, bda_packs, bda_badges, bda_lots,
--   bda_defis, bda_hotlines_menu, bda_sutom_words) sont CONSERVEES
-- ============================================================
