-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "date_mot_de_passe" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "historique_commande" ADD COLUMN     "date_notification" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "reinitialisation_mot_de_passe" (
    "id_reinitialisation" SERIAL NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "date_demande" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_expiration" TIMESTAMPTZ(6) NOT NULL,
    "tentatives" SMALLINT NOT NULL DEFAULT 0,
    "date_utilisation" TIMESTAMPTZ(6),
    "id_utilisateur" INTEGER NOT NULL,

    CONSTRAINT "reinitialisation_mot_de_passe_pkey" PRIMARY KEY ("id_reinitialisation")
);

-- CreateIndex
CREATE INDEX "reinitialisation_mot_de_passe_id_utilisateur_idx" ON "reinitialisation_mot_de_passe"("id_utilisateur");

-- AddForeignKey
ALTER TABLE "reinitialisation_mot_de_passe" ADD CONSTRAINT "reinitialisation_mot_de_passe_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les étapes déjà franchies avant cette mise à jour ne déclenchent aucun e-mail
UPDATE "historique_commande" SET "date_notification" = CURRENT_TIMESTAMP;

-- CreateIndex : les étapes pas encore notifiées se cherchent vite
CREATE INDEX "historique_commande_date_notification_idx" ON "historique_commande"("date_notification");
