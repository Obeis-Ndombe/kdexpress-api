import { NotFoundException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ProduitsService } from '../src/admin-catalogue/produits.service.js';
import { AppService } from '../src/app.service.js';
import { NotificationsService } from '../src/emails/notifications.service.js';
import { PhotosColisService } from '../src/expedition/photos-colis.service.js';
import { ParametresService } from '../src/parametres/parametres.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TableauDeBordService } from '../src/tableau-de-bord/tableau-de-bord.service.js';

// Les requêtes écrites en SQL (verrous, tableau de bord, santé) ne sont pas vérifiées par TypeScript.
// Ces tests les exécutent sur une vraie base : une colonne renommée dans schema.prisma les ferait échouer.
//
// Toutes les données de test sont datées de janvier 2000 (aucune vraie donnée ce mois-là)
// et supprimées à la fin. Base utilisée : celle du fichier .env (sur GitHub : une base jetable).

const D = (v: string | number) => new Prisma.Decimal(v);
const S = `${Date.now()}`; // rend les noms uniques
const JANVIER_2000 = ['2000-01-01', '2000-01-31'] as const;

let module: TestingModule;
let prisma: PrismaService;
let dossierPhotos: string;
const ids = {
  utilisateurs: [] as number[],
  commandes: [] as number[],
  categorie: 0,
  produit: 0,
  variante: 0,
  boutique: 0,
  achat: 0,
  colis: 0,
  client: 0,
  autreClient: 0,
};

async function utilisateur(role: 'client' | 'agent_dubai' | 'direction') {
  const u = await prisma.utilisateur.create({
    data: {
      nom: 'Test',
      prenom: role,
      email: `sql-${role}-${S}-${ids.utilisateurs.length}@test.kdx`,
      motDePasseHash: 'pas-un-vrai-hash',
      roleUtilisateur: role,
    },
  });
  ids.utilisateurs.push(u.idUtilisateur);
  return u.idUtilisateur;
}

// une commande avec ses lignes et les étapes franchies (ordre de l'étape, date)
async function commande(o: {
  date: string;
  lignes: {
    quantite: number;
    statut?: 'a_acheter' | 'achetee';
    prixAchat?: string;
  }[];
  etapes: [number, string][];
}) {
  const etapes = await prisma.etapeCommande.findMany();
  const c = await prisma.commande.create({
    data: {
      numeroCommande: `T${S.slice(-9)}${ids.commandes.length}`,
      dateCommande: new Date(o.date),
      tauxChangeAedUsd: D('0.25'),
      fraisTransportUsd: D('2.50'),
      fraisServiceUsd: D('10.00'),
      codeRetrait: `T${S.slice(-8)}${ids.commandes.length}`,
      idClient: ids.client,
      lignes: {
        create: o.lignes.map((l) => ({
          quantite: l.quantite,
          prixUnitaireAed: D('100.00'),
          poidsUnitaireKg: D('0.400'),
          idVariante: ids.variante,
          statutLigneCommande: l.statut ?? 'a_acheter',
          prixAchatReelAed: l.prixAchat ? D(l.prixAchat) : null,
          idAchatBoutique: l.statut === 'achetee' ? ids.achat : null,
        })),
      },
      historique: {
        create: o.etapes.map(([ordre, date]) => ({
          idEtapeCommande: etapes.find((e) => e.ordreEtape === ordre)!
            .idEtapeCommande,
          dateFranchissement: new Date(date),
        })),
      },
    },
  });
  ids.commandes.push(c.idCommande);
  return c.idCommande;
}

const image = () =>
  sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 30, g: 90, b: 200 },
    },
  })
    .jpeg()
    .toBuffer()
    .then((buffer) => ({
      buffer,
      size: buffer.length,
      originalname: 'test.jpg',
    }));

beforeAll(async () => {
  dossierPhotos = await mkdtemp(join(tmpdir(), 'kdx-sql-'));
  process.env.DOSSIER_FICHIERS = dossierPhotos;
  process.env.NOTIFICATIONS_INTERVALLE_SECONDES = '0'; // le test lance les passages lui-même
  // import après les variables : le .env est lu et contrôlé à l'import du module principal
  const { AppModule } = await import('../src/app.module.js');
  module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  await module.init();
  prisma = module.get(PrismaService);
}, 30_000);

afterAll(async () => {
  if (prisma) {
    const commandes = { idCommande: { in: ids.commandes } };
    await prisma.photoColis.deleteMany({ where: { colis: commandes } });
    await prisma.colis.deleteMany({ where: commandes });
    await prisma.paiement.deleteMany({ where: commandes });
    await prisma.operationAvoir.deleteMany({
      where: { idClient: { in: ids.utilisateurs } },
    });
    await prisma.historiqueCommande.deleteMany({ where: commandes });
    await prisma.ligneCommande.deleteMany({ where: commandes });
    await prisma.commande.deleteMany({ where: commandes });
    await prisma.achatBoutique.deleteMany({
      where: { idAchatBoutique: ids.achat },
    });
    await prisma.photoProduit.deleteMany({ where: { idProduit: ids.produit } });
    await prisma.variante.deleteMany({ where: { idProduit: ids.produit } });
    await prisma.produit.deleteMany({ where: { idProduit: ids.produit } });
    await prisma.categorie.deleteMany({
      where: { idCategorie: ids.categorie },
    });
    await prisma.boutique.deleteMany({ where: { idBoutique: ids.boutique } });
    await prisma.utilisateur.deleteMany({
      where: { idUtilisateur: { in: ids.utilisateurs } },
    });
  }
  await module?.close();
  await rm(dossierPhotos, { recursive: true, force: true });
}, 30_000);

describe('requêtes SQL sur une vraie base', () => {
  let avant: Awaited<ReturnType<TableauDeBordService['tableau']>>;
  let tableau: TableauDeBordService;

  beforeAll(async () => {
    tableau = module.get(TableauDeBordService);
    avant = await tableau.tableau(...JANVIER_2000); // « en cours » avant nos données

    ids.client = await utilisateur('client');
    ids.autreClient = await utilisateur('client');
    const agent = await utilisateur('agent_dubai');
    ids.categorie = (
      await prisma.categorie.create({
        data: { nomCategorie: `Test SQL ${S}`, poidsParDefautKg: D('0.400') },
      })
    ).idCategorie;
    const produit = await prisma.produit.create({
      data: {
        nomProduit: `Parfum test ${S}`,
        statutProduit: 'publie',
        idCategorie: ids.categorie,
        variantes: {
          create: { prixCatalogueAed: D('100.00'), poidsEstimeKg: D('0.400') },
        },
      },
      include: { variantes: true },
    });
    ids.produit = produit.idProduit;
    ids.variante = produit.variantes[0].idVariante;
    ids.boutique = (
      await prisma.boutique.create({
        data: { nomBoutique: `Boutique test ${S}` },
      })
    ).idBoutique;
    ids.achat = (
      await prisma.achatBoutique.create({
        data: {
          dateAchat: new Date('2000-01-11T09:00:00Z'),
          idAgentAchat: agent,
          idBoutique: ids.boutique,
        },
      })
    ).idAchatBoutique;

    // A : payée, 2 articles achetés 80 AED au lieu de 100
    const a = await commande({
      date: '2000-01-10T12:00:00Z',
      lignes: [{ quantite: 2, statut: 'achetee', prixAchat: '80.00' }],
      etapes: [
        [1, '2000-01-10T12:00:00Z'],
        [2, '2000-01-10T12:05:00Z'],
      ],
    });
    // B : annulée
    const b = await commande({
      date: '2000-01-12T12:00:00Z',
      lignes: [{ quantite: 1 }],
      etapes: [
        [1, '2000-01-12T12:00:00Z'],
        [9, '2000-01-12T13:00:00Z'],
      ],
    });
    // C : payée hors période, un article encore à acheter, un colis à expédier
    const c = await commande({
      date: '1999-12-20T12:00:00Z',
      lignes: [{ quantite: 1 }],
      etapes: [
        [1, '1999-12-20T12:00:00Z'],
        [2, '1999-12-20T12:05:00Z'],
      ],
    });
    ids.colis = (
      await prisma.colis.create({ data: { idCommande: c } })
    ).idColis;
    // D : prête au retrait depuis plus longtemps que le délai
    await commande({
      date: '1999-12-01T12:00:00Z',
      lignes: [{ quantite: 1 }],
      etapes: [
        [1, '1999-12-01T12:00:00Z'],
        [7, '2000-01-01T10:00:00Z'],
      ],
    });

    await prisma.paiement.createMany({
      data: [
        // 52,50 $ en espèces : 200 AED × 0,25 + 2,50 de transport
        {
          idCommande: a,
          montantPayeUsd: D('52.50'),
          moyenPaiement: 'especes',
          objetPaiement: 'articles_transport',
          datePaiement: new Date('2000-01-10T12:05:00Z'),
          idAgentEncaissement: agent,
        },
        // le 14 à 23 h 30 UTC : déjà le 15 à Kinshasa
        {
          idCommande: a,
          montantPayeUsd: D('10.00'),
          moyenPaiement: 'mobile_money',
          objetPaiement: 'solde_retrait',
          referencePaiement: 'TEST',
          datePaiement: new Date('2000-01-14T23:30:00Z'),
        },
        // payé par avoir : pas de l'argent frais
        {
          idCommande: a,
          montantPayeUsd: D('5.00'),
          moyenPaiement: 'avoir',
          objetPaiement: 'articles_transport',
          datePaiement: new Date('2000-01-13T10:00:00Z'),
        },
      ],
    });
    await prisma.operationAvoir.createMany({
      data: [
        {
          idClient: ids.client,
          idCommande: b,
          montantUsd: D('20.00'),
          motifOperation: 'test',
          dateOperation: new Date('2000-01-12T13:00:00Z'),
        },
        {
          idClient: ids.client,
          idCommande: a,
          montantUsd: D('-5.00'),
          motifOperation: 'test',
          dateOperation: new Date('2000-01-13T10:00:00Z'),
        },
      ],
    });
  }, 30_000);

  it('santé : la base répond', async () => {
    const app = module.get(AppService);
    expect(await app.sante()).toEqual({
      nom: 'KDExpress API',
      statut: 'ok',
      base: 'ok',
    });
  });

  describe('tableau de bord', () => {
    let t: Awaited<ReturnType<TableauDeBordService['tableau']>>;
    beforeAll(async () => {
      t = await tableau.tableau(...JANVIER_2000);
    });

    it('commandes de la période, par étape franchie', () => {
      expect(t.commandes).toEqual({
        creees: 2,
        payees: 1,
        expediees: 0,
        recuperees: 0,
        annulees: 1,
      });
    });

    it('encaissements : argent reçu, avoirs à part', () => {
      expect(t.encaissements).toEqual({
        argentRecuUsd: '62.50',
        payeParAvoirUsd: '5.00',
        parMoyen: { especes: '52.50', mobile_money: '10.00', carte: '0.00' },
        parObjet: {
          articles_transport: '57.50',
          solde_retrait: '10.00',
          frais_stockage: '0.00',
        },
      });
    });

    it('ventes : la commande annulée ne compte pas', () => {
      expect(t.ventes).toEqual({
        commandes: 1,
        articlesAed: '200.00',
        articlesUsd: '50.00',
        transportUsd: '2.50',
        serviceUsd: '10.00',
      });
    });

    it('marge : prix client − prix boutique', () => {
      expect(t.marge).toEqual({
        articlesAchetes: 2,
        venduAed: '200.00',
        acheteAed: '160.00',
        margeAed: '40.00',
        margeUsd: '10.00',
        margePourcentage: '25.0',
      });
    });

    it('avoirs crédités et utilisés', () => {
      expect(t.avoirs.creditesUsd).toBe('20.00');
      expect(t.avoirs.utilisesUsd).toBe('5.00');
      expect(
        D(t.avoirs.totalDuAuxClientsUsd)
          .minus(D(avant.avoirs.totalDuAuxClientsUsd))
          .toFixed(2),
      ).toBe('15.00');
    });

    it('meilleures ventes, sans la commande annulée', () => {
      expect(t.meilleuresVentes).toEqual([
        {
          idProduit: ids.produit,
          produit: `Parfum test ${S}`,
          quantite: 2,
          montantAed: '200.00',
        },
      ]);
    });

    it('une ligne par jour, journées de Kinshasa', () => {
      expect(t.parJour).toHaveLength(31);
      const jour = (j: string) => t.parJour.find((l) => l.jour === j);
      expect(jour('2000-01-10')).toEqual({
        jour: '2000-01-10',
        commandes: 1,
        argentRecuUsd: '52.50',
      });
      expect(jour('2000-01-12')).toEqual({
        jour: '2000-01-12',
        commandes: 1,
        argentRecuUsd: '0.00',
      });
      expect(jour('2000-01-13')?.argentRecuUsd).toBe('0.00'); // payé par avoir
      expect(jour('2000-01-14')?.argentRecuUsd).toBe('0.00');
      expect(jour('2000-01-15')?.argentRecuUsd).toBe('10.00');
      // les jours additionnés redonnent le total de la période
      const total = t.parJour.reduce((x, l) => x.add(l.argentRecuUsd), D(0));
      expect(total.toFixed(2)).toBe(t.encaissements.argentRecuUsd);
    });

    it('une journée seule, à la frontière de minuit', async () => {
      const le14 = await tableau.tableau('2000-01-14', '2000-01-14');
      const le15 = await tableau.tableau('2000-01-15', '2000-01-15');
      expect(le14.encaissements.argentRecuUsd).toBe('0.00');
      expect(le15.encaissements.argentRecuUsd).toBe('10.00');
    });

    it('en cours : ce qui attend maintenant', () => {
      const ecart = (cle: keyof typeof t.enCours) =>
        (t.enCours[cle] as number) - (avant.enCours[cle] as number);
      const etape = (x: typeof t, nom: string) =>
        x.enCours.commandesParEtape.find((e) => e.etape === nom)!.nombre;
      expect(t.enCours.commandesParEtape).toHaveLength(9);
      expect(etape(t, 'Payée') - etape(avant, 'Payée')).toBe(2); // A et C
      expect(etape(t, 'Annulée') - etape(avant, 'Annulée')).toBe(1);
      expect(
        etape(t, 'Prête au retrait') - etape(avant, 'Prête au retrait'),
      ).toBe(1);
      expect(ecart('articlesAAcheter')).toBe(1); // C (B est annulée, A est achetée)
      expect(ecart('colisAExpedier')).toBe(1);
      expect(ecart('retraitsEnRetard')).toBe(1);
    });
  });

  it('notifications : les étapes sont prises et cochées', async () => {
    const notifications = module.get(NotificationsService);
    // plusieurs passages si d'autres étapes attendaient déjà dans la base
    for (let i = 0; i < 20; i++) {
      const restant = await prisma.historiqueCommande.count({
        where: { idCommande: { in: ids.commandes }, dateNotification: null },
      });
      if (restant === 0) break;
      await notifications.passer();
    }
    expect(
      await prisma.historiqueCommande.count({
        where: { idCommande: { in: ids.commandes }, dateNotification: null },
      }),
    ).toBe(0);
  }, 30_000);

  it('réglages : le verrou laisse passer deux modifications simultanées', async () => {
    const parametres = module.get(ParametresService);
    const code = 'delai_alerte_achat_jours';
    const initial = (
      await prisma.parametre.findUniqueOrThrow({
        where: { codeParametre: code },
      })
    ).valeurParametre;
    const direction = { idUtilisateur: ids.client, role: 'direction' as const };
    try {
      await Promise.all(
        ['7', '8'].map((valeur) =>
          parametres.modifier({ modifications: [{ code, valeur }] }, direction),
        ),
      );
      const final = await prisma.parametre.findUniqueOrThrow({
        where: { codeParametre: code },
      });
      expect(['7', '8']).toContain(final.valeurParametre);
    } finally {
      await prisma.parametre.update({
        where: { codeParametre: code },
        data: { valeurParametre: initial },
      });
    }
  });

  it('photos de produit : 5 envois simultanés sont numérotés de 1 à 5', async () => {
    const produits = module.get(ProduitsService);
    await Promise.all(
      Array.from({ length: 5 }, async () =>
        produits.ajouterPhoto(ids.produit, await image()),
      ),
    );
    const photos = await prisma.photoProduit.findMany({
      where: { idProduit: ids.produit },
      orderBy: { ordreAffichage: 'asc' },
    });
    expect(photos.map((p) => p.ordreAffichage)).toEqual([1, 2, 3, 4, 5]);
  }, 30_000);

  it('photos de colis : envois simultanés, lecture réservée au client du colis', async () => {
    const photos = module.get(PhotosColisService);
    const envoyees = await Promise.all(
      Array.from({ length: 3 }, async () =>
        photos.ajouter(ids.colis, await image()),
      ),
    );
    expect(
      await prisma.photoColis.count({ where: { idColis: ids.colis } }),
    ).toBe(3);
    const id = envoyees[0].idPhotoColis;
    await expect(
      photos.lire(ids.colis, id, { idUtilisateur: ids.client, role: 'client' }),
    ).resolves.toBeDefined();
    await expect(
      photos.lire(ids.colis, id, {
        idUtilisateur: ids.autreClient,
        role: 'client',
      }),
    ).rejects.toThrow(NotFoundException);
  }, 30_000);
});
