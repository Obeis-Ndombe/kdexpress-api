import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// PostgreSQL a refusé une transaction sérialisable (code SQL 40001) : une autre s'est croisée avec elle.
// Prisma la signale par P2034 ; selon le moment du refus, l'erreur peut aussi arriver brute.
export function estConflit(erreur: unknown): boolean {
  if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
    return erreur.code === 'P2034';
  }
  const cause = (erreur as { cause?: { originalCode?: string } } | null)?.cause;
  return cause?.originalCode === '40001';
}

// Lance l'action ; en cas de conflit, la relance (jusqu'à 3 fois) : au nouvel essai,
// elle relit les données À JOUR. Après 3 conflits de suite : 409 avec ce message.
export async function avecEssais<T>(
  action: () => Promise<T>,
  messageConflit: string,
  essais = 3,
): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await action();
    } catch (erreur) {
      if (!estConflit(erreur)) {
        throw erreur;
      }
      if (essai >= essais) {
        throw new ConflictException(messageConflit);
      }
    }
  }
}

// Les options d'une transaction « comme si chacun passait l'un après l'autre »
export const SERIALISABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};
