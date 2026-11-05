# KDExpress API

**Kinshasa Dubaï Express** : l'API qui permet aux clients de Kinshasa de commander des produits de Dubaï (parfums, montres, chaussures, sacs).

Le client commande dans l'application. Un agent KDExpress achète les articles dans les boutiques de Dubaï, les expédie, et le client les retire au bureau de Kinshasa.

## Statut

En développement.

| Étape                                          | État     |
| ---------------------------------------------- | -------- |
| Base de données (28 tables, contraintes, vues) | Fait     |
| Catalogue en lecture                           | Fait     |
| Authentification et rôles                      | En cours |
| Panier et commandes                            | À faire  |
| Achats à Dubaï, expédition, retrait            | À faire  |
| Paiements et avoirs                            | À faire  |

## Technologies

- [NestJS 11](https://nestjs.com) (TypeScript, modules ESM)
- [Prisma 6](https://www.prisma.io) (ORM)
- [PostgreSQL 16](https://www.postgresql.org)
- Node.js 24

## Installation

Prérequis : Node.js 24 et PostgreSQL 16 installés, et une base vide nommée `kdexpress`.

```bash
git clone https://github.com/<ton-compte>/kdexpress-api.git
cd kdexpress-api
npm install
```

Crée un fichier `.env` à la racine (voir `.env.example`) :

```env
DATABASE_URL="postgresql://postgres:<mot_de_passe>@localhost:5432/kdexpress"
```

Crée les tables, puis ajoute les données d'essai :

```bash
npx prisma migrate dev
npx tsx prisma/seed.ts
```

Lance l'API :

```bash
npm run start:dev
```

L'API répond sur http://localhost:3000.

## Routes disponibles

| Méthode | Route                                      | Rôle                                                      |
| ------- | ------------------------------------------ | --------------------------------------------------------- |
| GET     | `/etapes`                                  | Étapes de suivi d'une commande                            |
| GET     | `/catalogue/categories`                    | Liste des catégories                                      |
| GET     | `/catalogue/produits?categorie=1&marque=2` | Produits publiés, filtres facultatifs                     |
| GET     | `/catalogue/produits/:id`                  | Détail d'un produit : variantes, options, paliers de prix |

Les prix sont donnés en dirhams (AED) et en dollars (USD). Le taux de change vient de la table `parametre`.

## Structure

```
prisma/
  schema.prisma     description des 28 tables
  migrations/       historique de la base (init + contraintes)
  seed.ts           données d'essai
src/
  main.ts           démarrage du serveur
  app.module.ts     module racine
  prisma/           connexion à la base (module global)
  catalogue/        routes du catalogue
```

## Commandes utiles

| Commande                              | Rôle                                       |
| ------------------------------------- | ------------------------------------------ |
| `npm run start:dev`                   | Lancer l'API en mode développement         |
| `npx prisma migrate dev --name <nom>` | Appliquer un changement de `schema.prisma` |
| `npx prisma studio`                   | Voir les tables dans le navigateur         |
| `npx tsx prisma/seed.ts`              | Remettre les données d'essai               |

## Organisation du code

- `main` contient toujours une version qui fonctionne.
- Chaque étape est développée sur une branche `feature/<nom>`, puis fusionnée dans `main`.
- Messages de commit : `feat`, `fix`, `chore`, `refactor`, `docs`.
