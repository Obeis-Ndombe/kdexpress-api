-- CreateEnum
CREATE TYPE "role_utilisateur" AS ENUM ('client', 'revendeur', 'fournisseur', 'agent_dubai', 'agent_bureau', 'direction');

-- CreateEnum
CREATE TYPE "statut_compte" AS ENUM ('actif', 'en_attente', 'suspendu');

-- CreateEnum
CREATE TYPE "role_boutique" AS ENUM ('proprietaire', 'vendeur');

-- CreateEnum
CREATE TYPE "statut_boutique" AS ENUM ('non_inscrite', 'en_attente', 'verifiee', 'refusee');

-- CreateEnum
CREATE TYPE "statut_produit" AS ENUM ('propose', 'publie', 'refuse', 'retire');

-- CreateEnum
CREATE TYPE "usage_caracteristique" AS ENUM ('description', 'choix_variante');

-- CreateEnum
CREATE TYPE "statut_ligne_commande" AS ENUM ('a_acheter', 'achetee', 'introuvable', 'remboursee');

-- CreateEnum
CREATE TYPE "statut_colis" AS ENUM ('prepare', 'expedie', 'arrive', 'remis');

-- CreateEnum
CREATE TYPE "statut_lot" AS ENUM ('en_preparation', 'parti', 'arrive');

-- CreateEnum
CREATE TYPE "moyen_paiement" AS ENUM ('especes', 'mobile_money', 'carte', 'avoir');

-- CreateEnum
CREATE TYPE "objet_paiement" AS ENUM ('articles_transport', 'solde_retrait', 'frais_stockage');

-- CreateTable
CREATE TABLE "utilisateur" (
    "id_utilisateur" SERIAL NOT NULL,
    "nom" VARCHAR(80) NOT NULL,
    "prenom" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "telephone" VARCHAR(20),
    "mot_de_passe_hash" VARCHAR(255) NOT NULL,
    "role_utilisateur" "role_utilisateur" NOT NULL,
    "statut_compte" "statut_compte" NOT NULL DEFAULT 'actif',
    "date_inscription" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id_utilisateur")
);

-- CreateTable
CREATE TABLE "boutique" (
    "id_boutique" SERIAL NOT NULL,
    "nom_boutique" VARCHAR(120) NOT NULL,
    "adresse_boutique" VARCHAR(255),
    "telephone_boutique" VARCHAR(20),
    "statut_boutique" "statut_boutique" NOT NULL DEFAULT 'non_inscrite',

    CONSTRAINT "boutique_pkey" PRIMARY KEY ("id_boutique")
);

-- CreateTable
CREATE TABLE "gestion_boutique" (
    "id_utilisateur" INTEGER NOT NULL,
    "id_boutique" INTEGER NOT NULL,
    "role_boutique" "role_boutique" NOT NULL,
    "date_rattachement" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gestion_boutique_pkey" PRIMARY KEY ("id_utilisateur","id_boutique")
);

-- CreateTable
CREATE TABLE "categorie" (
    "id_categorie" SERIAL NOT NULL,
    "nom_categorie" VARCHAR(80) NOT NULL,
    "poids_par_defaut_kg" DECIMAL(8,3) NOT NULL,

    CONSTRAINT "categorie_pkey" PRIMARY KEY ("id_categorie")
);

-- CreateTable
CREATE TABLE "marque" (
    "id_marque" SERIAL NOT NULL,
    "nom_marque" VARCHAR(80) NOT NULL,

    CONSTRAINT "marque_pkey" PRIMARY KEY ("id_marque")
);

-- CreateTable
CREATE TABLE "caracteristique" (
    "id_caracteristique" SERIAL NOT NULL,
    "nom_caracteristique" VARCHAR(80) NOT NULL,
    "unite_mesure" VARCHAR(20),

    CONSTRAINT "caracteristique_pkey" PRIMARY KEY ("id_caracteristique")
);

-- CreateTable
CREATE TABLE "caracteristique_categorie" (
    "id_categorie" INTEGER NOT NULL,
    "id_caracteristique" INTEGER NOT NULL,
    "usage_caracteristique" "usage_caracteristique" NOT NULL,

    CONSTRAINT "caracteristique_categorie_pkey" PRIMARY KEY ("id_categorie","id_caracteristique")
);

-- CreateTable
CREATE TABLE "produit" (
    "id_produit" SERIAL NOT NULL,
    "nom_produit" VARCHAR(150) NOT NULL,
    "description_produit" TEXT,
    "statut_produit" "statut_produit" NOT NULL DEFAULT 'propose',
    "id_categorie" INTEGER NOT NULL,
    "id_marque" INTEGER,
    "id_boutique_origine" INTEGER,

    CONSTRAINT "produit_pkey" PRIMARY KEY ("id_produit")
);

-- CreateTable
CREATE TABLE "photo_produit" (
    "id_photo_produit" SERIAL NOT NULL,
    "fichier_photo_produit" VARCHAR(500) NOT NULL,
    "ordre_affichage" SMALLINT NOT NULL DEFAULT 1,
    "id_produit" INTEGER NOT NULL,

    CONSTRAINT "photo_produit_pkey" PRIMARY KEY ("id_photo_produit")
);

-- CreateTable
CREATE TABLE "caracteristique_produit" (
    "id_produit" INTEGER NOT NULL,
    "id_caracteristique" INTEGER NOT NULL,
    "valeur" VARCHAR(120) NOT NULL,

    CONSTRAINT "caracteristique_produit_pkey" PRIMARY KEY ("id_produit","id_caracteristique")
);

-- CreateTable
CREATE TABLE "variante" (
    "id_variante" SERIAL NOT NULL,
    "libelle_variante" VARCHAR(120) NOT NULL DEFAULT 'Standard',
    "prix_catalogue_aed" DECIMAL(12,2) NOT NULL,
    "poids_estime_kg" DECIMAL(8,3) NOT NULL,
    "est_en_vente" BOOLEAN NOT NULL DEFAULT true,
    "id_produit" INTEGER NOT NULL,

    CONSTRAINT "variante_pkey" PRIMARY KEY ("id_variante")
);

-- CreateTable
CREATE TABLE "palier_prix" (
    "id_palier_prix" SERIAL NOT NULL,
    "quantite_minimum" INTEGER NOT NULL,
    "prix_palier_aed" DECIMAL(12,2) NOT NULL,
    "id_variante" INTEGER NOT NULL,

    CONSTRAINT "palier_prix_pkey" PRIMARY KEY ("id_palier_prix")
);

-- CreateTable
CREATE TABLE "caracteristique_variante" (
    "id_variante" INTEGER NOT NULL,
    "id_caracteristique" INTEGER NOT NULL,
    "valeur" VARCHAR(120) NOT NULL,

    CONSTRAINT "caracteristique_variante_pkey" PRIMARY KEY ("id_variante","id_caracteristique")
);

-- CreateTable
CREATE TABLE "offre_boutique" (
    "id_boutique" INTEGER NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "prix_boutique_aed" DECIMAL(12,2) NOT NULL,
    "est_disponible" BOOLEAN NOT NULL DEFAULT true,
    "date_mise_a_jour" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offre_boutique_pkey" PRIMARY KEY ("id_boutique","id_variante")
);

-- CreateTable
CREATE TABLE "commande" (
    "id_commande" SERIAL NOT NULL,
    "numero_commande" VARCHAR(20) NOT NULL,
    "date_commande" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taux_change_aed_usd" DECIMAL(12,6) NOT NULL,
    "frais_transport_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frais_service_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "code_retrait" VARCHAR(12) NOT NULL,
    "id_client" INTEGER NOT NULL,

    CONSTRAINT "commande_pkey" PRIMARY KEY ("id_commande")
);

-- CreateTable
CREATE TABLE "achat_boutique" (
    "id_achat_boutique" SERIAL NOT NULL,
    "date_achat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "est_confirme_boutique" BOOLEAN NOT NULL DEFAULT false,
    "id_agent_achat" INTEGER NOT NULL,
    "id_boutique" INTEGER NOT NULL,

    CONSTRAINT "achat_boutique_pkey" PRIMARY KEY ("id_achat_boutique")
);

-- CreateTable
CREATE TABLE "ligne_commande" (
    "id_ligne_commande" SERIAL NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prix_unitaire_aed" DECIMAL(12,2) NOT NULL,
    "poids_unitaire_kg" DECIMAL(8,3) NOT NULL,
    "prix_achat_reel_aed" DECIMAL(12,2),
    "statut_ligne_commande" "statut_ligne_commande" NOT NULL DEFAULT 'a_acheter',
    "id_commande" INTEGER NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "id_achat_boutique" INTEGER,

    CONSTRAINT "ligne_commande_pkey" PRIMARY KEY ("id_ligne_commande")
);

-- CreateTable
CREATE TABLE "agence_transport" (
    "id_agence_transport" SERIAL NOT NULL,
    "nom_agence" VARCHAR(120) NOT NULL,
    "telephone_agence" VARCHAR(20),
    "tarif_kg_usd" DECIMAL(12,2),

    CONSTRAINT "agence_transport_pkey" PRIMARY KEY ("id_agence_transport")
);

-- CreateTable
CREATE TABLE "lot_expedition" (
    "id_lot_expedition" SERIAL NOT NULL,
    "reference_lot" VARCHAR(30) NOT NULL,
    "date_depart" DATE,
    "date_arrivee" DATE,
    "poids_facture_kg" DECIMAL(8,3),
    "cout_facture_usd" DECIMAL(12,2),
    "statut_lot" "statut_lot" NOT NULL DEFAULT 'en_preparation',
    "id_agence_transport" INTEGER NOT NULL,

    CONSTRAINT "lot_expedition_pkey" PRIMARY KEY ("id_lot_expedition")
);

-- CreateTable
CREATE TABLE "colis" (
    "id_colis" SERIAL NOT NULL,
    "poids_reel_kg" DECIMAL(8,3),
    "date_preparation" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut_colis" "statut_colis" NOT NULL DEFAULT 'prepare',
    "date_remise" TIMESTAMPTZ(6),
    "id_commande" INTEGER NOT NULL,
    "id_lot_expedition" INTEGER,
    "id_agent_remise" INTEGER,

    CONSTRAINT "colis_pkey" PRIMARY KEY ("id_colis")
);

-- CreateTable
CREATE TABLE "contenu_colis" (
    "id_colis" INTEGER NOT NULL,
    "id_ligne_commande" INTEGER NOT NULL,
    "quantite_emballee" INTEGER NOT NULL,

    CONSTRAINT "contenu_colis_pkey" PRIMARY KEY ("id_colis","id_ligne_commande")
);

-- CreateTable
CREATE TABLE "photo_colis" (
    "id_photo_colis" SERIAL NOT NULL,
    "fichier_photo_colis" VARCHAR(500) NOT NULL,
    "date_photo_colis" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_colis" INTEGER NOT NULL,

    CONSTRAINT "photo_colis_pkey" PRIMARY KEY ("id_photo_colis")
);

-- CreateTable
CREATE TABLE "paiement" (
    "id_paiement" SERIAL NOT NULL,
    "montant_paye_usd" DECIMAL(12,2) NOT NULL,
    "moyen_paiement" "moyen_paiement" NOT NULL,
    "objet_paiement" "objet_paiement" NOT NULL,
    "reference_paiement" VARCHAR(100),
    "date_paiement" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_commande" INTEGER NOT NULL,
    "id_agent_encaissement" INTEGER,

    CONSTRAINT "paiement_pkey" PRIMARY KEY ("id_paiement")
);

-- CreateTable
CREATE TABLE "operation_avoir" (
    "id_operation_avoir" SERIAL NOT NULL,
    "montant_usd" DECIMAL(12,2) NOT NULL,
    "motif_operation" VARCHAR(255) NOT NULL,
    "date_operation" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_client" INTEGER NOT NULL,
    "id_commande" INTEGER,

    CONSTRAINT "operation_avoir_pkey" PRIMARY KEY ("id_operation_avoir")
);

-- CreateTable
CREATE TABLE "etape_commande" (
    "id_etape_commande" SERIAL NOT NULL,
    "libelle_etape" VARCHAR(60) NOT NULL,
    "ordre_etape" SMALLINT NOT NULL,

    CONSTRAINT "etape_commande_pkey" PRIMARY KEY ("id_etape_commande")
);

-- CreateTable
CREATE TABLE "historique_commande" (
    "id_commande" INTEGER NOT NULL,
    "id_etape_commande" INTEGER NOT NULL,
    "date_franchissement" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire_etape" VARCHAR(500),

    CONSTRAINT "historique_commande_pkey" PRIMARY KEY ("id_commande","id_etape_commande")
);

-- CreateTable
CREATE TABLE "avis_service" (
    "id_avis_service" SERIAL NOT NULL,
    "note_sur_5" SMALLINT NOT NULL,
    "commentaire_avis" VARCHAR(1000),
    "date_avis" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_commande" INTEGER NOT NULL,

    CONSTRAINT "avis_service_pkey" PRIMARY KEY ("id_avis_service")
);

-- CreateTable
CREATE TABLE "parametre" (
    "code_parametre" VARCHAR(50) NOT NULL,
    "valeur_parametre" VARCHAR(255) NOT NULL,
    "libelle_parametre" VARCHAR(255) NOT NULL,

    CONSTRAINT "parametre_pkey" PRIMARY KEY ("code_parametre")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "gestion_boutique_id_boutique_idx" ON "gestion_boutique"("id_boutique");

-- CreateIndex
CREATE UNIQUE INDEX "categorie_nom_categorie_key" ON "categorie"("nom_categorie");

-- CreateIndex
CREATE UNIQUE INDEX "marque_nom_marque_key" ON "marque"("nom_marque");

-- CreateIndex
CREATE UNIQUE INDEX "caracteristique_nom_caracteristique_key" ON "caracteristique"("nom_caracteristique");

-- CreateIndex
CREATE INDEX "caracteristique_categorie_id_caracteristique_idx" ON "caracteristique_categorie"("id_caracteristique");

-- CreateIndex
CREATE INDEX "produit_id_categorie_idx" ON "produit"("id_categorie");

-- CreateIndex
CREATE INDEX "produit_id_marque_idx" ON "produit"("id_marque");

-- CreateIndex
CREATE INDEX "produit_id_boutique_origine_idx" ON "produit"("id_boutique_origine");

-- CreateIndex
CREATE UNIQUE INDEX "photo_produit_id_produit_ordre_affichage_key" ON "photo_produit"("id_produit", "ordre_affichage");

-- CreateIndex
CREATE INDEX "caracteristique_produit_id_caracteristique_idx" ON "caracteristique_produit"("id_caracteristique");

-- CreateIndex
CREATE UNIQUE INDEX "variante_id_produit_libelle_variante_key" ON "variante"("id_produit", "libelle_variante");

-- CreateIndex
CREATE UNIQUE INDEX "palier_prix_id_variante_quantite_minimum_key" ON "palier_prix"("id_variante", "quantite_minimum");

-- CreateIndex
CREATE INDEX "caracteristique_variante_id_caracteristique_idx" ON "caracteristique_variante"("id_caracteristique");

-- CreateIndex
CREATE INDEX "offre_boutique_id_variante_idx" ON "offre_boutique"("id_variante");

-- CreateIndex
CREATE UNIQUE INDEX "commande_numero_commande_key" ON "commande"("numero_commande");

-- CreateIndex
CREATE UNIQUE INDEX "commande_code_retrait_key" ON "commande"("code_retrait");

-- CreateIndex
CREATE INDEX "commande_id_client_idx" ON "commande"("id_client");

-- CreateIndex
CREATE INDEX "achat_boutique_id_agent_achat_idx" ON "achat_boutique"("id_agent_achat");

-- CreateIndex
CREATE INDEX "achat_boutique_id_boutique_idx" ON "achat_boutique"("id_boutique");

-- CreateIndex
CREATE INDEX "ligne_commande_id_commande_idx" ON "ligne_commande"("id_commande");

-- CreateIndex
CREATE INDEX "ligne_commande_id_variante_idx" ON "ligne_commande"("id_variante");

-- CreateIndex
CREATE INDEX "ligne_commande_id_achat_boutique_idx" ON "ligne_commande"("id_achat_boutique");

-- CreateIndex
CREATE UNIQUE INDEX "agence_transport_nom_agence_key" ON "agence_transport"("nom_agence");

-- CreateIndex
CREATE UNIQUE INDEX "lot_expedition_reference_lot_key" ON "lot_expedition"("reference_lot");

-- CreateIndex
CREATE INDEX "lot_expedition_id_agence_transport_idx" ON "lot_expedition"("id_agence_transport");

-- CreateIndex
CREATE INDEX "colis_id_commande_idx" ON "colis"("id_commande");

-- CreateIndex
CREATE INDEX "colis_id_lot_expedition_idx" ON "colis"("id_lot_expedition");

-- CreateIndex
CREATE INDEX "colis_id_agent_remise_idx" ON "colis"("id_agent_remise");

-- CreateIndex
CREATE INDEX "contenu_colis_id_ligne_commande_idx" ON "contenu_colis"("id_ligne_commande");

-- CreateIndex
CREATE INDEX "photo_colis_id_colis_idx" ON "photo_colis"("id_colis");

-- CreateIndex
CREATE INDEX "paiement_id_commande_idx" ON "paiement"("id_commande");

-- CreateIndex
CREATE INDEX "paiement_id_agent_encaissement_idx" ON "paiement"("id_agent_encaissement");

-- CreateIndex
CREATE INDEX "operation_avoir_id_client_idx" ON "operation_avoir"("id_client");

-- CreateIndex
CREATE INDEX "operation_avoir_id_commande_idx" ON "operation_avoir"("id_commande");

-- CreateIndex
CREATE UNIQUE INDEX "etape_commande_libelle_etape_key" ON "etape_commande"("libelle_etape");

-- CreateIndex
CREATE UNIQUE INDEX "etape_commande_ordre_etape_key" ON "etape_commande"("ordre_etape");

-- CreateIndex
CREATE INDEX "historique_commande_id_etape_commande_idx" ON "historique_commande"("id_etape_commande");

-- CreateIndex
CREATE UNIQUE INDEX "avis_service_id_commande_key" ON "avis_service"("id_commande");

-- AddForeignKey
ALTER TABLE "gestion_boutique" ADD CONSTRAINT "gestion_boutique_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestion_boutique" ADD CONSTRAINT "gestion_boutique_id_boutique_fkey" FOREIGN KEY ("id_boutique") REFERENCES "boutique"("id_boutique") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristique_categorie" ADD CONSTRAINT "caracteristique_categorie_id_categorie_fkey" FOREIGN KEY ("id_categorie") REFERENCES "categorie"("id_categorie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristique_categorie" ADD CONSTRAINT "caracteristique_categorie_id_caracteristique_fkey" FOREIGN KEY ("id_caracteristique") REFERENCES "caracteristique"("id_caracteristique") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_id_categorie_fkey" FOREIGN KEY ("id_categorie") REFERENCES "categorie"("id_categorie") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_id_marque_fkey" FOREIGN KEY ("id_marque") REFERENCES "marque"("id_marque") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_id_boutique_origine_fkey" FOREIGN KEY ("id_boutique_origine") REFERENCES "boutique"("id_boutique") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_produit" ADD CONSTRAINT "photo_produit_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produit"("id_produit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristique_produit" ADD CONSTRAINT "caracteristique_produit_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produit"("id_produit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristique_produit" ADD CONSTRAINT "caracteristique_produit_id_caracteristique_fkey" FOREIGN KEY ("id_caracteristique") REFERENCES "caracteristique"("id_caracteristique") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante" ADD CONSTRAINT "variante_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produit"("id_produit") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "palier_prix" ADD CONSTRAINT "palier_prix_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristique_variante" ADD CONSTRAINT "caracteristique_variante_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracteristique_variante" ADD CONSTRAINT "caracteristique_variante_id_caracteristique_fkey" FOREIGN KEY ("id_caracteristique") REFERENCES "caracteristique"("id_caracteristique") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offre_boutique" ADD CONSTRAINT "offre_boutique_id_boutique_fkey" FOREIGN KEY ("id_boutique") REFERENCES "boutique"("id_boutique") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offre_boutique" ADD CONSTRAINT "offre_boutique_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commande" ADD CONSTRAINT "commande_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achat_boutique" ADD CONSTRAINT "achat_boutique_id_agent_achat_fkey" FOREIGN KEY ("id_agent_achat") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achat_boutique" ADD CONSTRAINT "achat_boutique_id_boutique_fkey" FOREIGN KEY ("id_boutique") REFERENCES "boutique"("id_boutique") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_commande" ADD CONSTRAINT "ligne_commande_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_commande" ADD CONSTRAINT "ligne_commande_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "variante"("id_variante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_commande" ADD CONSTRAINT "ligne_commande_id_achat_boutique_fkey" FOREIGN KEY ("id_achat_boutique") REFERENCES "achat_boutique"("id_achat_boutique") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_expedition" ADD CONSTRAINT "lot_expedition_id_agence_transport_fkey" FOREIGN KEY ("id_agence_transport") REFERENCES "agence_transport"("id_agence_transport") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colis" ADD CONSTRAINT "colis_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colis" ADD CONSTRAINT "colis_id_lot_expedition_fkey" FOREIGN KEY ("id_lot_expedition") REFERENCES "lot_expedition"("id_lot_expedition") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colis" ADD CONSTRAINT "colis_id_agent_remise_fkey" FOREIGN KEY ("id_agent_remise") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contenu_colis" ADD CONSTRAINT "contenu_colis_id_colis_fkey" FOREIGN KEY ("id_colis") REFERENCES "colis"("id_colis") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contenu_colis" ADD CONSTRAINT "contenu_colis_id_ligne_commande_fkey" FOREIGN KEY ("id_ligne_commande") REFERENCES "ligne_commande"("id_ligne_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_colis" ADD CONSTRAINT "photo_colis_id_colis_fkey" FOREIGN KEY ("id_colis") REFERENCES "colis"("id_colis") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_id_agent_encaissement_fkey" FOREIGN KEY ("id_agent_encaissement") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_avoir" ADD CONSTRAINT "operation_avoir_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_avoir" ADD CONSTRAINT "operation_avoir_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_commande" ADD CONSTRAINT "historique_commande_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_commande" ADD CONSTRAINT "historique_commande_id_etape_commande_fkey" FOREIGN KEY ("id_etape_commande") REFERENCES "etape_commande"("id_etape_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis_service" ADD CONSTRAINT "avis_service_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;
