import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TarificationService } from './tarification.service.js';

const D = (v: string | number) => new Prisma.Decimal(v);

// ------- la doublure de Prisma -------
// Elle joue le rôle de la base : elle renvoie les variantes et les paramètres écrits ici.

interface VarianteEssai {
  idVariante: number;
  libelleVariante: string;
  prixCatalogueAed: Prisma.Decimal;
  poidsEstimeKg: Prisma.Decimal;
  estEnVente: boolean;
  produit: { nomProduit: string; statutProduit: string };
  paliers: { quantiteMinimum: number; prixPalierAed: Prisma.Decimal }[];
}

const OUD_100: VarianteEssai = {
  idVariante: 1,
  libelleVariante: '100 ml',
  prixCatalogueAed: D('280.00'),
  poidsEstimeKg: D('0.450'),
  estEnVente: true,
  produit: { nomProduit: 'Oud Royal', statutProduit: 'publie' },
  paliers: [
    { quantiteMinimum: 6, prixPalierAed: D('260.00') },
    { quantiteMinimum: 12, prixPalierAed: D('240.00') },
  ],
};

const MONTRE: VarianteEssai = {
  idVariante: 2,
  libelleVariante: 'Standard',
  prixCatalogueAed: D('99.99'),
  poidsEstimeKg: D('0.300'),
  estEnVente: true,
  produit: { nomProduit: 'Casio', statutProduit: 'publie' },
  paliers: [],
};

const PARAMETRES_DE_BASE: Record<string, string> = {
  taux_change_aed_usd: '0.272294',
  transport_mode: 'pourcentage',
  transport_pourcentage: '5',
  transport_prix_kg_usd: '',
  transport_minimum_kg: '1',
  frais_service_mode: 'fixe',
  frais_service_usd: '10',
};

function service(
  variantes: VarianteEssai[] = [OUD_100, MONTRE],
  parametres: Record<string, string> = PARAMETRES_DE_BASE,
) {
  const prisma = {
    variante: {
      findMany: ({ where }: { where: { idVariante: { in: number[] } } }) =>
        Promise.resolve(
          variantes
            .filter((v) => where.idVariante.in.includes(v.idVariante))
            // comme la vraie requête : paliers du plus grand au plus petit
            .map((v) => ({
              ...v,
              paliers: [...v.paliers].sort(
                (a, b) => b.quantiteMinimum - a.quantiteMinimum,
              ),
            })),
        ),
    },
    parametre: {
      findMany: () =>
        Promise.resolve(
          Object.entries(parametres).map(
            ([codeParametre, valeurParametre]) => ({
              codeParametre,
              valeurParametre,
            }),
          ),
        ),
    },
  };
  return new TarificationService(prisma as unknown as PrismaService);
}

const prixUnitaire = async (quantite: number) => {
  const c = await service().chiffrer([{ idVariante: 1, quantite }]);
  return c.lignes[0].prixUnitaireAed.toFixed(2);
};

// ------- les tests -------

describe('TarificationService', () => {
  describe('paliers de prix', () => {
    it('sous le premier palier : prix catalogue', async () => {
      expect(await prixUnitaire(1)).toBe('280.00');
      expect(await prixUnitaire(5)).toBe('280.00');
    });

    it('à partir de 6 : palier « dès 6 »', async () => {
      expect(await prixUnitaire(6)).toBe('260.00');
      expect(await prixUnitaire(11)).toBe('260.00');
    });

    it('à partir de 12 : palier « dès 12 »', async () => {
      expect(await prixUnitaire(12)).toBe('240.00');
      expect(await prixUnitaire(100)).toBe('240.00');
    });

    it('la même variante demandée deux fois compte pour une seule quantité', async () => {
      const c = await service().chiffrer([
        { idVariante: 1, quantite: 4 },
        { idVariante: 1, quantite: 2 },
      ]);
      expect(c.lignes).toHaveLength(1);
      expect(c.lignes[0].quantite).toBe(6);
      expect(c.lignes[0].prixUnitaireAed.toFixed(2)).toBe('260.00'); // 4 + 2 = 6 : le palier joue
      expect(c.lignes[0].sousTotalAed.toFixed(2)).toBe('1560.00');
    });
  });

  describe('totaux', () => {
    it('convertit le total en USD une seule fois, puis arrondit', async () => {
      // 3 × 99,99 = 299,97 AED × 0,272294 = 81,6800... → 81,68
      // (convertir chaque montre puis additionner donnerait 3 × 27,23 = 81,69)
      const c = await service().chiffrer([{ idVariante: 2, quantite: 3 }]);
      expect(c.articlesAed.toFixed(2)).toBe('299.97');
      expect(c.articlesUsd.toFixed(2)).toBe('81.68');
    });

    it('additionne plusieurs articles et leurs poids', async () => {
      const c = await service().chiffrer([
        { idVariante: 1, quantite: 2 },
        { idVariante: 2, quantite: 1 },
      ]);
      expect(c.articlesAed.toFixed(2)).toBe('659.99'); // 2 × 280 + 99,99
      expect(c.poidsTotalKg.toFixed(3)).toBe('1.200'); // 2 × 0,450 + 0,300
    });

    it('transport au pourcentage : 5 % des articles en USD', async () => {
      const c = await service().chiffrer([{ idVariante: 1, quantite: 1 }]);
      expect(c.articlesUsd.toFixed(2)).toBe('76.24'); // 280 × 0,272294
      expect(c.fraisTransportUsd.toFixed(2)).toBe('3.81'); // 5 % de 76,24
    });

    it('frais de service : montant fixe', async () => {
      const c = await service().chiffrer([{ idVariante: 1, quantite: 1 }]);
      expect(c.fraisServiceUsd.toFixed(2)).toBe('10.00');
    });

    it('transport au poids : prix du kilo, avec un minimum facturé', async () => {
      const auPoids = {
        ...PARAMETRES_DE_BASE,
        transport_mode: 'poids',
        transport_prix_kg_usd: '8',
      };
      const leger = await service(undefined, auPoids).chiffrer([
        { idVariante: 2, quantite: 1 }, // 0,3 kg → 1 kg facturé
      ]);
      expect(leger.fraisTransportUsd.toFixed(2)).toBe('8.00');
      const lourd = await service(undefined, auPoids).chiffrer([
        { idVariante: 1, quantite: 5 }, // 2,25 kg
      ]);
      expect(lourd.fraisTransportUsd.toFixed(2)).toBe('18.00');
    });
  });

  describe('refus', () => {
    it('article inconnu', async () => {
      await expect(
        service().chiffrer([{ idVariante: 999, quantite: 1 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('variante retirée de la vente', async () => {
      const horsVente = { ...MONTRE, estEnVente: false };
      await expect(
        service([horsVente]).chiffrer([{ idVariante: 2, quantite: 1 }]),
      ).rejects.toThrow("L'article 2 n'est pas disponible");
    });

    it('produit non publié (proposé ou retiré)', async () => {
      for (const statut of ['propose', 'retire', 'refuse']) {
        const v = {
          ...MONTRE,
          produit: { ...MONTRE.produit, statutProduit: statut },
        };
        await expect(
          service([v]).chiffrer([{ idVariante: 2, quantite: 1 }]),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('paramètre obligatoire manquant', async () => {
      const sansTaux = { ...PARAMETRES_DE_BASE, taux_change_aed_usd: '' };
      await expect(
        service(undefined, sansTaux).chiffrer([{ idVariante: 1, quantite: 1 }]),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('transport au poids sans prix du kilo', async () => {
      const incomplet = { ...PARAMETRES_DE_BASE, transport_mode: 'poids' };
      await expect(
        service(undefined, incomplet).chiffrer([
          { idVariante: 1, quantite: 1 },
        ]),
      ).rejects.toThrow('transport_prix_kg_usd');
    });
  });
});
