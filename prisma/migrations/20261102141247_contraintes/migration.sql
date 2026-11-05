-- =====================================================================
-- KDExpress — contraintes, vues, fonction et données de départ
-- Ce que schema.prisma ne sait pas exprimer. À coller dans la migration
-- « contraintes » créée avec : npx prisma migrate dev --create-only --name contraintes
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contrôles de valeurs (CHECK)
-- ---------------------------------------------------------------------

ALTER TABLE categorie        ADD CONSTRAINT ck_categorie_poids      CHECK (poids_par_defaut_kg > 0);
ALTER TABLE photo_produit    ADD CONSTRAINT ck_photo_produit_ordre  CHECK (ordre_affichage > 0);
ALTER TABLE variante         ADD CONSTRAINT ck_variante_prix        CHECK (prix_catalogue_aed >= 0);
ALTER TABLE variante         ADD CONSTRAINT ck_variante_poids       CHECK (poids_estime_kg > 0);
ALTER TABLE palier_prix      ADD CONSTRAINT ck_palier_quantite      CHECK (quantite_minimum >= 2);
ALTER TABLE palier_prix      ADD CONSTRAINT ck_palier_prix          CHECK (prix_palier_aed >= 0);
ALTER TABLE offre_boutique   ADD CONSTRAINT ck_offre_prix           CHECK (prix_boutique_aed >= 0);

ALTER TABLE commande         ADD CONSTRAINT ck_commande_taux        CHECK (taux_change_aed_usd > 0);
ALTER TABLE commande         ADD CONSTRAINT ck_commande_frais       CHECK (frais_transport_usd >= 0 AND frais_service_usd >= 0);
ALTER TABLE ligne_commande   ADD CONSTRAINT ck_ligne_quantite       CHECK (quantite > 0);
ALTER TABLE ligne_commande   ADD CONSTRAINT ck_ligne_prix           CHECK (prix_unitaire_aed >= 0 AND (prix_achat_reel_aed IS NULL OR prix_achat_reel_aed >= 0));
ALTER TABLE ligne_commande   ADD CONSTRAINT ck_ligne_poids          CHECK (poids_unitaire_kg > 0);
-- une ligne achetée est forcément rattachée à un achat
ALTER TABLE ligne_commande   ADD CONSTRAINT ck_ligne_achat          CHECK (statut_ligne_commande <> 'achetee' OR id_achat_boutique IS NOT NULL);

ALTER TABLE agence_transport ADD CONSTRAINT ck_agence_tarif         CHECK (tarif_kg_usd IS NULL OR tarif_kg_usd >= 0);
ALTER TABLE lot_expedition   ADD CONSTRAINT ck_lot_poids_cout       CHECK ((poids_facture_kg IS NULL OR poids_facture_kg > 0) AND (cout_facture_usd IS NULL OR cout_facture_usd >= 0));
ALTER TABLE lot_expedition   ADD CONSTRAINT ck_lot_dates            CHECK (date_arrivee IS NULL OR date_depart IS NULL OR date_arrivee >= date_depart);
ALTER TABLE colis            ADD CONSTRAINT ck_colis_poids          CHECK (poids_reel_kg IS NULL OR poids_reel_kg > 0);
-- un colis remis a forcément une date et un agent de remise
ALTER TABLE colis            ADD CONSTRAINT ck_colis_remise         CHECK (statut_colis <> 'remis' OR (date_remise IS NOT NULL AND id_agent_remise IS NOT NULL));
ALTER TABLE contenu_colis    ADD CONSTRAINT ck_contenu_quantite     CHECK (quantite_emballee > 0);

ALTER TABLE paiement         ADD CONSTRAINT ck_paiement_montant     CHECK (montant_paye_usd > 0);
-- un paiement en espèces est forcément encaissé par un agent du bureau
ALTER TABLE paiement         ADD CONSTRAINT ck_paiement_especes     CHECK (moyen_paiement <> 'especes' OR id_agent_encaissement IS NOT NULL);
ALTER TABLE operation_avoir  ADD CONSTRAINT ck_avoir_montant        CHECK (montant_usd <> 0);
ALTER TABLE etape_commande   ADD CONSTRAINT ck_etape_ordre          CHECK (ordre_etape > 0);
ALTER TABLE avis_service     ADD CONSTRAINT ck_avis_note            CHECK (note_sur_5 BETWEEN 1 AND 5);

-- ---------------------------------------------------------------------
-- 2. Vues (calculées, rien n'est stocké en double)
-- ---------------------------------------------------------------------

-- solde d'avoir de chaque client
CREATE VIEW v_solde_avoir AS
SELECT id_client, SUM(montant_usd) AS solde_avoir_usd
FROM operation_avoir
GROUP BY id_client;

-- étape actuelle de chaque commande = la dernière étape franchie
CREATE VIEW v_etape_actuelle AS
SELECT DISTINCT ON (h.id_commande)
       h.id_commande, e.libelle_etape, h.date_franchissement
FROM historique_commande h
JOIN etape_commande e USING (id_etape_commande)
ORDER BY h.id_commande, e.ordre_etape DESC;

-- ---------------------------------------------------------------------
-- 3. Prix unitaire applicable selon la quantité (paliers)
-- ---------------------------------------------------------------------

CREATE FUNCTION prix_unitaire_applicable(p_id_variante integer, p_quantite integer)
RETURNS numeric(12,2) LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT prix_palier_aed FROM palier_prix
          WHERE id_variante = p_id_variante AND quantite_minimum <= p_quantite
          ORDER BY quantite_minimum DESC LIMIT 1),
        (SELECT prix_catalogue_aed FROM variante WHERE id_variante = p_id_variante));
$$;

-- ---------------------------------------------------------------------
-- 4. Données de départ
-- ---------------------------------------------------------------------

INSERT INTO etape_commande (libelle_etape, ordre_etape) VALUES
    ('En attente de paiement', 1),
    ('Payée', 2),
    ('Achat en cours', 3),
    ('Achetée', 4),
    ('Expédiée', 5),
    ('Arrivée à Kinshasa', 6),
    ('Prête au retrait', 7),
    ('Récupérée', 8),
    ('Annulée', 9);

INSERT INTO parametre (code_parametre, valeur_parametre, libelle_parametre) VALUES
    ('frais_service_mode', 'fixe', 'Mode de calcul des frais de service : fixe ou pourcentage'),
    ('frais_service_usd', '10', 'Frais de service par commande, en dollars'),
    ('transport_mode', 'pourcentage', 'Mode de calcul du transport : pourcentage ou poids'),
    ('transport_pourcentage', '5', 'Transport facturé, en % du montant de la commande'),
    ('transport_prix_kg_usd', '', 'Prix du kilo facturé au client (à régler à la mise en production)'),
    ('transport_minimum_kg', '1', 'Poids minimum facturé par commande, en kg'),
    ('taux_change_aed_usd', '0.272294', 'Valeur d''un dirham en dollars (à mettre à jour par la direction)'),
    ('delai_retrait_jours', '30', 'Délai de retrait au bureau avant frais de stockage'),
    ('frais_stockage_usd', '', 'Frais de stockage après le délai (à décider)'),
    ('delai_alerte_achat_jours', '3', 'Nombre de jours avant une alerte pour un achat en attente');
