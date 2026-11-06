# KDExpress API

**Kinshasa Dubaï Express** : l'API qui permet aux clients de Kinshasa de commander des produits de Dubaï (parfums, montres, chaussures, sacs).

Le client commande dans l'application. Un agent KDExpress achète les articles dans les boutiques de Dubaï, les expédie, et le client les retire au bureau de Kinshasa.

## Statut

En développement.

| Étape                                          | État    |
| ---------------------------------------------- | ------- |
| Base de données (28 tables, contraintes, vues) | Fait    |
| Catalogue en lecture                           | Fait    |
| Authentification et rôles                      | Fait    |
| Panier et commandes                            | Fait    |
| Paiements et avoirs                            | Fait    |
| Achats à Dubaï, expédition, retrait            | À faire |

## Technologies

- [NestJS 12](https://nestjs.com) (TypeScript, modules ESM)
- [Prisma 6](https://www.prisma.io) (ORM)
- [PostgreSQL 16](https://www.postgresql.org)
- JWT pour l'authentification, bcrypt pour les mots de passe
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
JWT_SECRET="<un secret aléatoire de 64 caractères>"
JWT_DUREE_SECONDES=86400
```

Pour générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Crée les tables, ajoute les données d'essai, puis le premier compte de la direction :

```bash
npx prisma migrate dev
npx tsx prisma/seed.ts
npx tsx prisma/creer-direction.ts <email> <mot de passe>
```

Lance l'API :

```bash
npm run start:dev
```

L'API répond sur http://localhost:3000.

## Authentification

Toutes les routes sont fermées par défaut, sauf celles marquées « public » ci-dessous.
Après `POST /auth/connexion`, envoyer le jeton reçu dans l'en-tête de chaque requête :

```
Authorization: Bearer <jetonAcces>
```

Rôles : `client`, `revendeur`, `fournisseur`, `agent_dubai`, `agent_bureau`, `direction`.
Une inscription crée toujours un `client` ; les autres comptes sont créés par la direction.

## Routes disponibles

| Méthode | Route                                      | Accès                                                   | Rôle                                                                  |
| ------- | ------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| GET     | `/catalogue/categories`                    | public                                                  | Liste des catégories                                                  |
| GET     | `/catalogue/produits?categorie=1&marque=2` | public                                                  | Produits publiés, filtres facultatifs                                 |
| GET     | `/catalogue/produits/:id`                  | public                                                  | Détail d'un produit : variantes, options, paliers de prix             |
| POST    | `/auth/inscription`                        | public                                                  | Créer un compte client                                                |
| POST    | `/auth/connexion`                          | public                                                  | Se connecter, reçoit un jeton JWT                                     |
| GET     | `/auth/moi`                                | connecté                                                | Profil de l'utilisateur connecté                                      |
| GET     | `/utilisateurs?role=agent_dubai`           | direction                                               | Liste des comptes, filtre facultatif                                  |
| POST    | `/utilisateurs`                            | direction                                               | Créer un compte avec un rôle                                          |
| PATCH   | `/utilisateurs/:id/statut`                 | direction                                               | Activer, mettre en attente ou suspendre un compte                     |
| POST    | `/commandes/devis`                         | public                                                  | Chiffrer un panier (paliers, transport, frais), sans rien enregistrer |
| POST    | `/commandes`                               | client, revendeur                                       | Créer une commande aux prix figés, avec numéro et code de retrait     |
| GET     | `/commandes?page=1&client=12`              | client, revendeur, agents, direction                    | Liste : ses commandes pour un client, toutes pour le personnel        |
| GET     | `/commandes/:id`                           | propriétaire ou personnel                               | Détail : lignes, montants, étape actuelle, historique                 |
| POST    | `/commandes/:id/paiements`                 | agent_bureau, direction ; client et revendeur par avoir | Enregistrer un paiement (espèces, mobile money, carte, avoir)         |
| GET     | `/avoirs/moi`                              | client, revendeur                                       | Mon solde d'avoir et mon carnet                                       |
| GET     | `/avoirs?client=12`                        | agent_bureau, direction                                 | Solde et carnet d'un client                                           |
| POST    | `/avoirs`                                  | direction                                               | Créditer un client                                                    |

Les prix sont donnés en dirhams (AED) et en dollars (USD). Le taux de change, le transport (5 % du montant des articles) et les frais de service (10 $, payés au retrait) viennent de la table `parametre`.

Le panier n'est pas enregistré dans la base : il vit dans l'application jusqu'à la commande.

## Paiements et avoirs

- Une commande se paie en deux temps : **articles + transport** (`articles_transport`), puis **frais de service** au retrait (`solde_retrait`). Le paiement en plusieurs fois est permis, jamais au-delà du reste à payer.
- Quand les articles et le transport sont entièrement payés, la commande passe automatiquement à l'étape « Payée ».
- Les paiements en espèces, mobile money et carte sont enregistrés par le bureau (référence obligatoire pour mobile money et carte). Le paiement automatique M-Pesa sera branché plus tard.
- Un **avoir** est un crédit du client : + crédit, − utilisation, le solde est la somme. Le client peut payer lui-même ses commandes par avoir.
- Les paiements se font dans une transaction sérialisable : deux paiements simultanés ne peuvent pas dépasser le reste à payer ni le solde d'avoir.

## Structure

```
prisma/
  schema.prisma       description des 28 tables
  migrations/         historique de la base (init + contraintes)
  seed.ts             données d'essai
  creer-direction.ts  création du premier compte de la direction
src/
  main.ts             démarrage du serveur, validation globale des données reçues
  app.module.ts       module racine
  prisma/             connexion à la base (module global)
  auth/               inscription, connexion, gardes JWT et rôles, décorateurs
  utilisateurs/       gestion des comptes par la direction
  catalogue/          routes du catalogue
  commandes/          devis, création et suivi des commandes, calcul des prix et du reste à payer
  paiements/          enregistrement des paiements
  avoirs/             solde, carnet et crédit des avoirs
```

## Commandes utiles

| Commande                                          | Rôle                                       |
| ------------------------------------------------- | ------------------------------------------ |
| `npm run start:dev`                               | Lancer l'API en mode développement         |
| `npx prisma migrate dev --name <nom>`             | Appliquer un changement de `schema.prisma` |
| `npx prisma studio`                               | Voir les tables dans le navigateur         |
| `npx tsx prisma/seed.ts`                          | Remettre les données d'essai               |
| `npx tsx prisma/creer-direction.ts <email> <mdp>` | Créer ou réinitialiser un compte direction |

## Organisation du code

- `main` contient toujours une version qui fonctionne.
- Chaque étape est développée sur une branche `feature/<nom>`, puis fusionnée dans `main`.
- Messages de commit : `feat`, `fix`, `chore`, `refactor`, `docs`.
