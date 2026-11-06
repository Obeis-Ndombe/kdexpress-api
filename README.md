# KDExpress API

**Kinshasa Dubaï Express** : l'API qui permet aux clients de Kinshasa de commander des produits de Dubaï (parfums, montres, chaussures, sacs).

Le client commande dans l'application. Un agent KDExpress achète les articles dans les boutiques de Dubaï, les expédie, et le client les retire au bureau de Kinshasa.

## Statut

En développement.

| Étape                                          | État |
| ---------------------------------------------- | ---- |
| Base de données (28 tables, contraintes, vues) | Fait |
| Catalogue en lecture                           | Fait |
| Authentification et rôles                      | Fait |
| Panier et commandes                            | Fait |
| Paiements et avoirs                            | Fait |
| Achats à Dubaï, expédition, retrait            | Fait |

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

| Méthode | Route                                      | Accès                                                   | Rôle                                                                                       |
| ------- | ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GET     | `/catalogue/categories`                    | public                                                  | Liste des catégories                                                                       |
| GET     | `/catalogue/produits?categorie=1&marque=2` | public                                                  | Produits publiés, filtres facultatifs                                                      |
| GET     | `/catalogue/produits/:id`                  | public                                                  | Détail d'un produit : variantes, options, paliers de prix                                  |
| POST    | `/auth/inscription`                        | public                                                  | Créer un compte client                                                                     |
| POST    | `/auth/connexion`                          | public                                                  | Se connecter, reçoit un jeton JWT                                                          |
| GET     | `/auth/moi`                                | connecté                                                | Profil de l'utilisateur connecté                                                           |
| GET     | `/utilisateurs?role=agent_dubai`           | direction                                               | Liste des comptes, filtre facultatif                                                       |
| POST    | `/utilisateurs`                            | direction                                               | Créer un compte avec un rôle                                                               |
| PATCH   | `/utilisateurs/:id/statut`                 | direction                                               | Activer, mettre en attente ou suspendre un compte                                          |
| POST    | `/commandes/devis`                         | public                                                  | Chiffrer un panier (paliers, transport, frais), sans rien enregistrer                      |
| POST    | `/commandes`                               | client, revendeur                                       | Créer une commande aux prix figés, avec numéro et code de retrait                          |
| GET     | `/commandes?page=1&client=12`              | client, revendeur, agents, direction                    | Liste : ses commandes pour un client, toutes pour le personnel                             |
| GET     | `/commandes/:id`                           | propriétaire ou personnel                               | Détail : lignes, montants, étape actuelle, historique                                      |
| POST    | `/commandes/:id/paiements`                 | agent_bureau, direction ; client et revendeur par avoir | Enregistrer un paiement (espèces, mobile money, carte, avoir)                              |
| GET     | `/avoirs/moi`                              | client, revendeur                                       | Mon solde d'avoir et mon carnet                                                            |
| GET     | `/avoirs?client=12`                        | agent_bureau, direction                                 | Solde et carnet d'un client                                                                |
| POST    | `/avoirs`                                  | direction                                               | Créditer un client                                                                         |
| POST    | `/commandes/:id/annuler`                   | direction ; client pour sa commande non payée           | Annuler une commande (remboursement en avoir si besoin)                                    |
| GET     | `/boutiques`, POST `/boutiques`            | agent_dubai, direction                                  | Boutiques de Dubaï                                                                         |
| GET     | `/achats/a-faire`                          | agent_dubai, direction                                  | Liste d'achats : lignes des commandes payées, regroupées par article, alerte après N jours |
| POST    | `/achats`                                  | agent_dubai                                             | Enregistrer un achat en boutique (prix réel unitaire)                                      |
| POST    | `/achats/lignes/:id/introuvable`           | agent_dubai                                             | Signaler un article introuvable                                                            |
| POST    | `/achats/lignes/:id/rembourser`            | direction                                               | Rembourser un article introuvable par avoir (article + part du transport)                  |
| GET     | `/agences`, POST `/agences`                | agent_dubai, direction                                  | Agences de transport                                                                       |
| GET     | `/expedition/a-emballer`                   | agent_dubai, direction                                  | Commandes achetées avec des articles à emballer                                            |
| POST    | `/colis`                                   | agent_dubai                                             | Créer un colis pour une commande (contenu, poids)                                          |
| PATCH   | `/colis/:id`                               | agent_dubai                                             | Peser un colis avant son départ                                                            |
| POST    | `/colis/:id/photos`                        | agent_dubai                                             | Ajouter une photo (nom du fichier)                                                         |
| POST    | `/colis/:id/pointage`                      | agent_bureau                                            | Pointer un colis reçu au bureau de Kinshasa                                                |
| GET     | `/lots`, `/lots/:id`                       | agents, direction                                       | Lots d'expédition et leurs colis                                                           |
| POST    | `/lots`                                    | agent_dubai                                             | Créer un lot pour une agence, avec ses colis                                               |
| POST    | `/lots/:id/colis`                          | agent_dubai                                             | Ajouter des colis à un lot pas encore parti                                                |
| POST    | `/lots/:id/depart`                         | agent_dubai                                             | Départ du lot (date, poids et coût facturés)                                               |
| POST    | `/lots/:id/arrivee`                        | agent_bureau, direction                                 | Arrivée du lot à Kinshasa                                                                  |
| GET     | `/retraits/:code`                          | agent_bureau, direction                                 | Vérifier une commande à partir du code de retrait                                          |
| POST    | `/retraits`                                | agent_bureau                                            | Remettre les colis au client (tout doit être payé)                                         |
| POST    | `/commandes/:id/avis`                      | client, revendeur                                       | Noter le service (1 à 5) après la récupération                                             |
| GET     | `/avis`                                    | direction                                               | Tous les avis et la note moyenne                                                           |

Les prix sont donnés en dirhams (AED) et en dollars (USD). Le taux de change, le transport (5 % du montant des articles) et les frais de service (10 $, payés au retrait) viennent de la table `parametre`.

Le panier n'est pas enregistré dans la base : il vit dans l'application jusqu'à la commande.

## Paiements et avoirs

- Une commande se paie en deux temps : **articles + transport** (`articles_transport`), puis **frais de service** au retrait (`solde_retrait`). Le paiement en plusieurs fois est permis, jamais au-delà du reste à payer.
- Quand les articles et le transport sont entièrement payés, la commande passe automatiquement à l'étape « Payée ».
- Les paiements en espèces, mobile money et carte sont enregistrés par le bureau (référence obligatoire pour mobile money et carte). Le paiement automatique M-Pesa sera branché plus tard.
- Un **avoir** est un crédit du client : + crédit, − utilisation, le solde est la somme. Le client peut payer lui-même ses commandes par avoir.
- Les paiements se font dans une transaction sérialisable : deux paiements simultanés ne peuvent pas dépasser le reste à payer ni le solde d'avoir.

## Achats, expédition et retrait

Le suivi d'une commande avance tout seul, étape par étape, chaque étape une seule fois :

| Étape                  | Quand                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| En attente de paiement | La commande est créée                                                   |
| Payée                  | Les articles et le transport sont entièrement payés                     |
| Achat en cours         | Le premier article est acheté à Dubaï                                   |
| Achetée                | Toutes les lignes sont traitées (achetées, introuvables ou remboursées) |
| Expédiée               | Tout est emballé et tous les colis sont partis                          |
| Arrivée à Kinshasa     | Tous les lots de la commande sont arrivés                               |
| Prête au retrait       | Tous les colis sont pointés au bureau                                   |
| Récupérée              | Le client a présenté son code et tout était payé                        |
| Annulée                | Pas encore payée, ou aucun article trouvé à Dubaï                       |

- Un article introuvable est signalé par l'agent ; la direction le rembourse en avoir (article + part du transport payé). Le client n'a aucun choix à faire.
- Une commande peut avoir plusieurs colis ; un colis n'appartient qu'à une commande ; un lot regroupe des colis de plusieurs commandes.
- Les photos des colis sont enregistrées par leur nom de fichier ; l'envoi réel de fichiers viendra plus tard.

## Gestion du catalogue (direction)

Toutes ces routes sont réservées à la direction. Le catalogue public (`/catalogue`) ne montre que les produits `publie`.

| Méthode | Route                                                            | Rôle                                                                           |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GET     | `/admin/categories`, `/admin/marques`, `/admin/caracteristiques` | Les listes de base                                                             |
| POST    | `/admin/categories`, `/admin/marques`, `/admin/caracteristiques` | Créer un élément (409 si le nom existe déjà)                                   |
| PATCH   | `/admin/categories/:id`                                          | Changer le nom ou le poids par défaut                                          |
| PUT     | `/admin/categories/:id/caracteristiques`                         | Caractéristiques prévues pour la catégorie (`description` ou `choix_variante`) |
| GET     | `/admin/produits?statut=propose&categorie=1&marque=2`            | Tous les produits, quel que soit leur statut                                   |
| GET     | `/admin/produits/:id`                                            | Détail complet, y compris les variantes retirées de la vente                   |
| POST    | `/admin/produits`                                                | Créer un produit complet (variantes, options, paliers, photos)                 |
| PATCH   | `/admin/produits/:id`                                            | Changer le nom, la description ou la marque                                    |
| POST    | `/admin/produits/:id/publier`, `/refuser`, `/retirer`            | Changer le statut                                                              |
| POST    | `/admin/produits/:id/variantes`                                  | Ajouter une variante                                                           |
| POST    | `/admin/produits/:id/photos`                                     | Ajouter une photo (nom de fichier)                                             |
| PATCH   | `/admin/variantes/:id`                                           | Changer le prix, le poids, le libellé, ou mettre en vente / retirer            |
| PUT     | `/admin/variantes/:id/paliers`                                   | Remplacer tous les paliers de prix d'une variante                              |

- Un produit se crée en une seule requête, dans une seule transaction : si une règle est violée, rien n'est créé.
- Les caractéristiques d'un produit doivent être prévues en `description` pour sa catégorie, celles d'une variante en `choix_variante`.
- Un palier commence à 2 pièces au moins, et chaque palier coûte moins que le précédent et que le prix catalogue.
- Statuts : `propose` → `publie` ou `refuse` ; `publie` → `retire` ; `retire` → `publie`. Publier demande une variante en vente.
- Un changement de prix ne touche que les futures commandes : les commandes passées gardent leur prix figé.
- Rien ne se supprime : une variante ou un produit se retire.

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
  admin-catalogue/    référentiel, produits, variantes, paliers et statuts (direction)
  commandes/          devis, création, suivi et annulation des commandes, calculs des montants, étapes
  paiements/          enregistrement des paiements
  avoirs/             solde, carnet et crédit des avoirs
  boutiques/          boutiques de Dubaï
  achats/             liste d'achats, achats en boutique, introuvables et remboursements
  agences/            agences de transport
  expedition/         colis, lots, départ, arrivée, pointage
  retraits/           remise des colis au client
  avis/               avis sur le service
  commun/             outils partagés (transactions et essais automatiques)
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
