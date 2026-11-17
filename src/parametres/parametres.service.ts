import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ModifierParametresDto } from './dto/modifier-parametres.dto.js';
import { incoherence, REGLES, verifierParametre } from './regles-parametres.js';

// Les réglages de la direction : taux de change, transport, frais de service, marge, délais.
// Un changement ne touche que les FUTURES commandes : les commandes passées gardent leurs montants figés.
@Injectable()
export class ParametresService {
  private readonly journal = new Logger('Réglages');

  constructor(private readonly prisma: PrismaService) {}

  // GET /admin/parametres
  async lister() {
    const lignes = await this.prisma.parametre.findMany({
      orderBy: { codeParametre: 'asc' },
    });
    return lignes.map((l) => ({
      code: l.codeParametre,
      valeur: l.valeurParametre,
      libelle: l.libelleParametre,
      aide: REGLES[l.codeParametre]?.aide ?? null,
    }));
  }

  // PATCH /admin/parametres : toutes les modifications passent, ou aucune
  async modifier(dto: ModifierParametresDto, auteur: UtilisateurConnecte) {
    // 1. chaque valeur respecte la règle de son réglage
    const nouvelles = new Map<string, string>();
    const erreurs: string[] = [];
    for (const m of dto.modifications) {
      if (nouvelles.has(m.code)) {
        erreurs.push(`${m.code} est modifié deux fois`);
        continue;
      }
      const resultat = verifierParametre(m.code, m.valeur);
      if ('erreur' in resultat) {
        erreurs.push(resultat.erreur);
      } else {
        nouvelles.set(m.code, resultat.valeur);
      }
    }
    if (erreurs.length > 0) {
      throw new BadRequestException(erreurs);
    }

    // 2. l'ensemble reste cohérent, vérifié et écrit dans la même transaction
    const changements = await this.prisma.$transaction(async (tx) => {
      // verrou : deux directeurs qui règlent en même temps passent l'un après l'autre
      await tx.$queryRaw`SELECT 1 FROM parametre ORDER BY code_parametre FOR UPDATE`;
      const actuels = await tx.parametre.findMany();
      const valeurs = new Map(
        actuels.map((p) => [p.codeParametre, p.valeurParametre]),
      );
      const faits: { code: string; avant: string; apres: string }[] = [];
      for (const [code, apres] of nouvelles) {
        const avant = valeurs.get(code);
        if (avant === undefined) {
          throw new BadRequestException(`Réglage inconnu : ${code}`);
        }
        if (avant !== apres) {
          faits.push({ code, avant, apres });
          valeurs.set(code, apres);
        }
      }
      const probleme = incoherence(valeurs);
      if (probleme) {
        throw new BadRequestException(probleme);
      }
      for (const f of faits) {
        await tx.parametre.update({
          where: { codeParametre: f.code },
          data: { valeurParametre: f.apres },
        });
      }
      return faits;
    });

    // 3. la trace : qui a changé quoi (le taux de change décide de tous les prix)
    for (const c of changements) {
      this.journal.log(
        `${c.code} : « ${c.avant} » -> « ${c.apres} » par l'utilisateur ${auteur.idUtilisateur}`,
      );
    }
    return { modifies: changements, parametres: await this.lister() };
  }
}
