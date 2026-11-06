import { BadRequestException } from '@nestjs/common';
import { Prisma, UsageCaracteristique } from '@prisma/client';

// Les règles du catalogue, partagées par la création d'un produit,
// l'ajout d'une variante, le changement d'un prix et le remplacement des paliers.

export interface PalierSaisi {
  aPartirDe: number;
  prixAed: string;
}

export interface ValeurSaisie {
  idCaracteristique: number;
  valeur: string;
}

// Une erreur Prisma connue, avec son code (P2002 doublon, P2025 introuvable...)
export function estErreurPrisma(erreur: unknown, code: string): boolean {
  return (
    erreur instanceof Prisma.PrismaClientKnownRequestError &&
    erreur.code === code
  );
}

// un montant reçu en texte, qui doit être strictement positif
export function montantPositif(texte: string, nom: string): Prisma.Decimal {
  const montant = new Prisma.Decimal(texte);
  if (montant.lte(0)) {
    throw new BadRequestException(`${nom} doit être supérieur à 0`);
  }
  return montant;
}

// Chaque palier doit être moins cher que le précédent, le premier moins cher que le prix catalogue :
// « 180 ; dès 6 : 170 ; dès 12 : 160 » est accepté, « dès 12 : 175 » après « dès 6 : 170 » ne l'est pas.
export function verifierPaliers(
  prixCatalogue: Prisma.Decimal,
  paliers: PalierSaisi[],
): void {
  const tries = [...paliers].sort((a, b) => a.aPartirDe - b.aPartirDe);
  let precedent = prixCatalogue;
  let quantitePrecedente: number | null = null;
  for (const palier of tries) {
    if (palier.aPartirDe === quantitePrecedente) {
      throw new BadRequestException(
        `Deux paliers commencent à ${palier.aPartirDe} pièces`,
      );
    }
    const prix = montantPositif(palier.prixAed, 'Le prix d’un palier');
    if (prix.gte(precedent)) {
      throw new BadRequestException(
        `Le palier « dès ${palier.aPartirDe} » (${prix.toFixed(2)}) doit coûter moins que ${precedent.toFixed(2)}`,
      );
    }
    precedent = prix;
    quantitePrecedente = palier.aPartirDe;
  }
}

// Les caractéristiques d'un produit (usage « description ») ou d'une variante (usage « choix_variante »)
// doivent être prévues pour la catégorie avec cet usage : pas de pointure pour un parfum.
export async function verifierCaracteristiques(
  client: Prisma.TransactionClient,
  idCategorie: number,
  valeurs: ValeurSaisie[],
  usage: UsageCaracteristique,
): Promise<void> {
  const ids = valeurs.map((v) => v.idCaracteristique);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(
      'Une même caractéristique est donnée plusieurs fois',
    );
  }
  if (ids.length === 0) {
    return;
  }
  const prevues = await client.caracteristiqueCategorie.findMany({
    where: {
      idCategorie,
      idCaracteristique: { in: ids },
      usageCaracteristique: usage,
    },
    select: { idCaracteristique: true },
  });
  const permises = new Set(prevues.map((p) => p.idCaracteristique));
  const refusees = ids.filter((id) => !permises.has(id));
  if (refusees.length > 0) {
    const role = usage === 'description' ? 'description' : 'choix de variante';
    throw new BadRequestException(
      `Caractéristique(s) ${refusees.join(', ')} non prévue(s) en « ${role} » pour cette catégorie`,
    );
  }
}
