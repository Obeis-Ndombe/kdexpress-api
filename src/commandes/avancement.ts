import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Ajoute une étape à l'historique d'une commande, SI elle n'y est pas déjà.
// Toujours appelée dans la transaction de l'action qui fait avancer la commande.
// Rend le libellé de l'étape ajoutée, ou null si elle était déjà franchie.
export async function franchirEtape(
  tx: Prisma.TransactionClient,
  idCommande: number,
  ordreEtape: number,
  commentaire?: string,
): Promise<string | null> {
  const etape = await tx.etapeCommande.findFirst({ where: { ordreEtape } });
  if (!etape) {
    throw new InternalServerErrorException(
      `Étape n°${ordreEtape} absente de la table etape_commande`,
    );
  }

  const dejaFranchie = await tx.historiqueCommande.findUnique({
    where: {
      idCommande_idEtapeCommande: {
        idCommande,
        idEtapeCommande: etape.idEtapeCommande,
      },
    },
  });
  if (dejaFranchie) {
    return null;
  }

  await tx.historiqueCommande.create({
    data: {
      idCommande,
      idEtapeCommande: etape.idEtapeCommande,
      commentaireEtape: commentaire,
    },
  });
  return etape.libelleEtape;
}
