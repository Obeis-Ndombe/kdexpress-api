// Données d'essai pour le catalogue.
// Lancer avec : npx tsx prisma/seed.ts
// Le script vide d'abord le catalogue, on peut donc le relancer sans créer de doublons.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Vider le catalogue (de l'enfant vers le parent, à cause des clés étrangères)
  await prisma.$transaction([
    prisma.offreBoutique.deleteMany(),
    prisma.palierPrix.deleteMany(),
    prisma.caracteristiqueVariante.deleteMany(),
    prisma.variante.deleteMany(),
    prisma.caracteristiqueProduit.deleteMany(),
    prisma.photoProduit.deleteMany(),
    prisma.produit.deleteMany(),
    prisma.caracteristiqueCategorie.deleteMany(),
    prisma.caracteristique.deleteMany(),
    prisma.marque.deleteMany(),
    prisma.categorie.deleteMany(),
  ]);

  // 2. Catégories, marques, caractéristiques
  const parfum = await prisma.categorie.create({ data: { nomCategorie: 'Parfum', poidsParDefautKg: 0.4 } });
  const montre = await prisma.categorie.create({ data: { nomCategorie: 'Montre', poidsParDefautKg: 0.5 } });
  const chaussures = await prisma.categorie.create({ data: { nomCategorie: 'Chaussures', poidsParDefautKg: 1.5 } });
  const sac = await prisma.categorie.create({ data: { nomCategorie: 'Sac', poidsParDefautKg: 1 } });

  const lattafa = await prisma.marque.create({ data: { nomMarque: 'Lattafa' } });
  const casio = await prisma.marque.create({ data: { nomMarque: 'Casio' } });
  const nike = await prisma.marque.create({ data: { nomMarque: 'Nike' } });

  const contenance = await prisma.caracteristique.create({ data: { nomCaracteristique: 'Contenance', uniteMesure: 'ml' } });
  const concentration = await prisma.caracteristique.create({ data: { nomCaracteristique: 'Concentration' } });
  const couleur = await prisma.caracteristique.create({ data: { nomCaracteristique: 'Couleur' } });
  const pointure = await prisma.caracteristique.create({ data: { nomCaracteristique: 'Pointure' } });
  const mouvement = await prisma.caracteristique.create({ data: { nomCaracteristique: 'Mouvement' } });

  // 3. Quelles caractéristiques pour quelle catégorie (association Prévoir)
  await prisma.caracteristiqueCategorie.createMany({
    data: [
      { idCategorie: parfum.idCategorie, idCaracteristique: contenance.idCaracteristique, usageCaracteristique: 'choix_variante' },
      { idCategorie: parfum.idCategorie, idCaracteristique: concentration.idCaracteristique, usageCaracteristique: 'description' },
      { idCategorie: montre.idCategorie, idCaracteristique: mouvement.idCaracteristique, usageCaracteristique: 'description' },
      { idCategorie: montre.idCategorie, idCaracteristique: couleur.idCaracteristique, usageCaracteristique: 'choix_variante' },
      { idCategorie: chaussures.idCategorie, idCaracteristique: pointure.idCaracteristique, usageCaracteristique: 'choix_variante' },
      { idCategorie: chaussures.idCategorie, idCaracteristique: couleur.idCaracteristique, usageCaracteristique: 'choix_variante' },
    ],
  });

  // 4. Produits, avec leurs photos, caractéristiques, variantes et paliers
  await prisma.produit.create({
    data: {
      nomProduit: 'Oud Royal',
      descriptionProduit: "Parfum oriental boisé, notes d'oud et d'ambre.",
      statutProduit: 'publie',
      categorie: { connect: { idCategorie: parfum.idCategorie } },
      marque: { connect: { idMarque: lattafa.idMarque } },
      photos: { create: [{ fichierPhotoProduit: 'oud-royal-1.jpg', ordreAffichage: 1 }] },
      caracteristiques: {
        create: [{ valeur: 'Eau de parfum', caracteristique: { connect: { idCaracteristique: concentration.idCaracteristique } } }],
      },
      variantes: {
        create: [
          {
            libelleVariante: '50 ml',
            prixCatalogueAed: 180,
            poidsEstimeKg: 0.3,
            caracteristiques: { create: [{ valeur: '50', caracteristique: { connect: { idCaracteristique: contenance.idCaracteristique } } }] },
          },
          {
            libelleVariante: '100 ml',
            prixCatalogueAed: 280,
            poidsEstimeKg: 0.45,
            caracteristiques: { create: [{ valeur: '100', caracteristique: { connect: { idCaracteristique: contenance.idCaracteristique } } }] },
            paliers: {
              create: [
                { quantiteMinimum: 6, prixPalierAed: 260 },
                { quantiteMinimum: 12, prixPalierAed: 240 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.produit.create({
    data: {
      nomProduit: 'Montre G-Shock GA-2100',
      descriptionProduit: 'Montre résistante aux chocs, étanche à 200 mètres.',
      statutProduit: 'publie',
      categorie: { connect: { idCategorie: montre.idCategorie } },
      marque: { connect: { idMarque: casio.idMarque } },
      photos: { create: [{ fichierPhotoProduit: 'gshock-1.jpg', ordreAffichage: 1 }] },
      caracteristiques: {
        create: [{ valeur: 'Quartz', caracteristique: { connect: { idCaracteristique: mouvement.idCaracteristique } } }],
      },
      variantes: {
        create: [
          {
            libelleVariante: 'Noir',
            prixCatalogueAed: 450,
            poidsEstimeKg: 0.5,
            caracteristiques: { create: [{ valeur: 'Noir', caracteristique: { connect: { idCaracteristique: couleur.idCaracteristique } } }] },
          },
          {
            libelleVariante: 'Bleu',
            prixCatalogueAed: 470,
            poidsEstimeKg: 0.5,
            caracteristiques: { create: [{ valeur: 'Bleu', caracteristique: { connect: { idCaracteristique: couleur.idCaracteristique } } }] },
          },
        ],
      },
    },
  });

  await prisma.produit.create({
    data: {
      nomProduit: 'Baskets Air Zoom',
      descriptionProduit: 'Baskets de course légères.',
      statutProduit: 'publie',
      categorie: { connect: { idCategorie: chaussures.idCategorie } },
      marque: { connect: { idMarque: nike.idMarque } },
      variantes: {
        create: [
          {
            libelleVariante: '42 · Noir',
            prixCatalogueAed: 520,
            poidsEstimeKg: 1.5,
            caracteristiques: {
              create: [
                { valeur: '42', caracteristique: { connect: { idCaracteristique: pointure.idCaracteristique } } },
                { valeur: 'Noir', caracteristique: { connect: { idCaracteristique: couleur.idCaracteristique } } },
              ],
            },
          },
          {
            libelleVariante: '43 · Noir',
            prixCatalogueAed: 520,
            poidsEstimeKg: 1.5,
            caracteristiques: {
              create: [
                { valeur: '43', caracteristique: { connect: { idCaracteristique: pointure.idCaracteristique } } },
                { valeur: 'Noir', caracteristique: { connect: { idCaracteristique: couleur.idCaracteristique } } },
              ],
            },
          },
        ],
      },
    },
  });

  // Un produit proposé par une boutique, pas encore validé : il ne doit PAS apparaître dans le catalogue
  await prisma.produit.create({
    data: {
      nomProduit: 'Sac en cuir',
      statutProduit: 'propose',
      categorie: { connect: { idCategorie: sac.idCategorie } },
      variantes: { create: [{ prixCatalogueAed: 350, poidsEstimeKg: 1 }] },
    },
  });

  console.log("Catalogue d'essai créé : 4 catégories, 3 marques, 4 produits (dont 1 non publié).");
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());