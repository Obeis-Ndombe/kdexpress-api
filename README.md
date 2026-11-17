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
| Gestion du catalogue et boutiques partenaires  | Fait |
| Tests automatiques                             | Fait |
| Envoi des photos                               | Fait |
| Étiquettes QR des colis                        | Fait |
| Protections pour la mise en ligne              | Fait |
| Réglages par la direction                      | Fait |
| Compte et e-mails                              | Fait |
| Tableau de bord de la direction                | Fait |

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
DOSSIER_FICHIERS="fichiers"
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
| GET     | `/boutiques/:id/offres`                    | agent_dubai, direction                                  | Prix connus d'une boutique                                                                 |
| PUT     | `/boutiques/:id/offres/:idVariante`        | agent_dubai, direction                                  | Noter le prix vu dans une boutique (sauf boutique vérifiée, qui tient ses prix)            |
| GET     | `/achats/a-faire`                          | agent_dubai, direction                                  | Liste d'achats : lignes des commandes payées, regroupées par article, alerte après N jours |
| POST    | `/achats`                                  | agent_dubai                                             | Enregistrer un achat en boutique (prix réel unitaire)                                      |
| POST    | `/achats/lignes/:id/introuvable`           | agent_dubai                                             | Signaler un article introuvable                                                            |
| POST    | `/achats/lignes/:id/rembourser`            | direction                                               | Rembourser un article introuvable par avoir (article + part du transport)                  |
| GET     | `/agences`, POST `/agences`                | agent_dubai, direction                                  | Agences de transport                                                                       |
| GET     | `/expedition/a-emballer`                   | agent_dubai, direction                                  | Commandes achetées avec des articles à emballer                                            |
| POST    | `/colis`                                   | agent_dubai                                             | Créer un colis pour une commande (contenu, poids)                                          |
| PATCH   | `/colis/:id`                               | agent_dubai                                             | Peser un colis avant son départ                                                            |
| POST    | `/colis/:id/photos`                        | agent_dubai                                             | Envoyer une photo du colis emballé (voir _Photos_)                                         |
| GET     | `/colis/:id/photos/:idPhoto`               | personnel, client du colis                              | Afficher une photo de colis (privée)                                                       |
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
- Le détail d'une commande montre ses colis et les adresses de leurs photos.

## Gestion du catalogue (direction)

Toutes ces routes sont réservées à la direction. Le catalogue public (`/catalogue`) ne montre que les produits `publie`.

| Méthode | Route                                                            | Rôle                                                                           |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GET     | `/admin/categories`, `/admin/marques`, `/admin/caracteristiques` | Les listes de base                                                             |
| POST    | `/admin/categories`, `/admin/marques`, `/admin/caracteristiques` | Créer un élément (409 si le nom existe déjà)                                   |
| PATCH   | `/admin/categories/:id`                                          | Changer le nom ou le poids par défaut                                          |
| PUT     | `/admin/categories/:id/caracteristiques`                         | Caractéristiques prévues pour la catégorie (`description` ou `choix_variante`) |
| GET     | `/admin/produits?statut=propose&categorie=1&marque=2`            | Tous les produits, quel que soit leur statut                                   |
| GET     | `/admin/produits/:id`                                            | Détail complet, avec les offres des boutiques et la marge de chaque variante   |
| POST    | `/admin/produits`                                                | Créer un produit complet (variantes, options, paliers)                         |
| PATCH   | `/admin/produits/:id`                                            | Changer le nom, la description ou la marque                                    |
| POST    | `/admin/produits/:id/publier`, `/refuser`, `/retirer`            | Changer le statut                                                              |
| POST    | `/admin/produits/:id/variantes`                                  | Ajouter une variante                                                           |
| POST    | `/admin/produits/:id/photos`                                     | Envoyer une photo (voir _Photos_)                                              |
| DELETE  | `/admin/photos/:id`                                              | Supprimer une photo (en base et sur le disque)                                 |
| PATCH   | `/admin/variantes/:id`                                           | Changer le prix, le poids, le libellé, ou mettre en vente / retirer            |
| PUT     | `/admin/variantes/:id/paliers`                                   | Remplacer tous les paliers de prix d'une variante                              |

- Un produit se crée en une seule requête, dans une seule transaction : si une règle est violée, rien n'est créé.
- Les caractéristiques d'un produit doivent être prévues en `description` pour sa catégorie, celles d'une variante en `choix_variante`.
- Un palier commence à 2 pièces au moins, et chaque palier coûte moins que le précédent et que le prix catalogue.
- Statuts : `propose` → `publie` ou `refuse` ; `publie` → `retire` ; `retire` → `publie`. Publier demande une variante en vente.
- Un changement de prix ne touche que les futures commandes : les commandes passées gardent leur prix figé.
- Rien ne se supprime : une variante ou un produit se retire.

## Boutiques partenaires

Une boutique de Dubaï peut avoir un compte chez KDExpress : elle propose ses produits et tient ses prix à jour.

Il y a deux prix :

| Prix               | Fixé par       | Rôle                                             |
| ------------------ | -------------- | ------------------------------------------------ |
| **Prix boutique**  | le fournisseur | Ce que KDExpress paie à Dubaï (`offre_boutique`) |
| **Prix catalogue** | la direction   | Ce que le client paie (`variante`)               |

La **marge** est ce que gagne KDExpress : `prix catalogue − prix boutique`, exprimée en % du prix boutique.

| Méthode | Route                                               | Accès       | Rôle                                                          |
| ------- | --------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| GET     | `/admin/boutiques/:id`                              | direction   | Détail d'une boutique et de ses gestionnaires                 |
| POST    | `/admin/boutiques/:id/gestionnaires`                | direction   | Rattacher un compte `fournisseur` (`proprietaire`, `vendeur`) |
| DELETE  | `/admin/boutiques/:id/gestionnaires/:idUtilisateur` | direction   | Détacher un compte                                            |
| POST    | `/admin/boutiques/:id/verifier`, `/refuser`         | direction   | Vérifier ou refuser une boutique                              |
| GET     | `/fournisseur/boutiques`                            | fournisseur | Mes boutiques                                                 |
| GET     | `/fournisseur/boutiques/:id/produits`               | fournisseur | Mes propositions et leur statut                               |
| POST    | `/fournisseur/boutiques/:id/produits`               | fournisseur | Proposer un produit avec mes prix boutique                    |
| PATCH   | `/fournisseur/boutiques/:id/produits/:idProduit`    | fournisseur | Corriger une proposition encore en attente                    |
| GET     | `/fournisseur/boutiques/:id/offres`                 | fournisseur | Mes offres                                                    |
| PUT     | `/fournisseur/boutiques/:id/offres/:idVariante`     | fournisseur | Créer ou modifier une offre (prix, disponibilité)             |

- Statuts d'une boutique : `non_inscrite` (sans compte) → `en_attente` (un compte rattaché) → `verifiee` ou `refusee`. Seule une boutique vérifiée peut proposer des produits et faire des offres.
- À la proposition, le prix client est calculé : prix boutique + marge (`marge_catalogue_pourcentage`, 20 %), arrondi au dirham supérieur. Le produit reste `propose` : la direction contrôle le prix, puis publie.
- Une fois publié, le produit appartient au catalogue de la direction ; la boutique ne gère plus que ses offres.
- Un changement de prix boutique ne change jamais le prix client. Si la marge devient nulle ou négative, `alerteMarge` le signale à la direction.
- Un fournisseur ne voit que ses boutiques (404 pour celle d'un autre).
- La liste d'achats de l'agent affiche les offres disponibles, la moins chère d'abord.

## Photos

Les photos sont envoyées en `multipart/form-data`, le fichier dans le champ **`photo`** :

```bash
curl -X POST http://localhost:3000/admin/produits/1/photos \
  -H "Authorization: Bearer <jeton>" -F "photo=@parfum.jpg"
```

| Route                                                        | Accès       | Rôle                                      |
| ------------------------------------------------------------ | ----------- | ----------------------------------------- |
| POST `/admin/produits/:id/photos`                            | direction   | Photo de produit                          |
| POST `/fournisseur/boutiques/:id/produits/:idProduit/photos` | fournisseur | Photo d'une proposition encore en attente |
| POST `/colis/:id/photos`                                     | agent_dubai | Photo du colis emballé                    |

- Formats acceptés : JPEG, PNG, WebP, 8 Mo au plus. Le contenu est vérifié, pas seulement l'extension.
- Chaque photo est redressée, réduite à 1600 px, convertie en WebP et débarrassée de ses métadonnées (dont la position GPS).
- Elle est rangée sous un nom tiré au hasard dans le dossier `DOSSIER_FICHIERS` (exclu de Git).
- 10 photos au plus par produit et par colis. Des envois simultanés passent l'un après l'autre.
- Les photos de produits sont publiques : `/fichiers/produits/<nom>.webp`. Les photos de colis sont privées : `/colis/:id/photos/:idPhoto`, pour le personnel et le client du colis (404 pour un autre client).

## Étiquettes QR des colis

À Dubaï, l'agent imprime une étiquette par colis (PDF, 10 × 15 cm) et la colle dessus. À Kinshasa, l'agent du bureau scanne le QR pour pointer le colis.

| Méthode | Route                  | Accès                  | Rôle                                                         |
| ------- | ---------------------- | ---------------------- | ------------------------------------------------------------ |
| GET     | `/colis/:id/etiquette` | agent_dubai, direction | Étiquette d'un colis (PDF)                                   |
| GET     | `/lots/:id/etiquettes` | agent_dubai, direction | Toutes les étiquettes d'un lot, une par page                 |
| POST    | `/colis/pointage-scan` | agent_bureau           | Pointer le colis du QR scanné : `{ "code": "KDX-C-123-7Q" }` |

- Le QR contient `KDX-C-<numéro du colis>-<clé de contrôle>`. Un code abîmé, modifié ou étranger est refusé (400).
- L'étiquette montre le numéro de commande, le rang du colis (« 2 / 3 »), le poids, le lot et l'agence de transport.
- Le client y figure en abrégé (« Marie K. •••• 4521 »). **Le code de retrait n'y figure jamais.**
- Le pointage par scan suit les mêmes règles que `POST /colis/:id/pointage`.

## Compte et e-mails

| Méthode | Route                             | Accès    | Rôle                                                     |
| ------- | --------------------------------- | -------- | -------------------------------------------------------- |
| PATCH   | `/auth/moi`                       | connecté | Modifier son nom, son prénom, son téléphone              |
| POST    | `/auth/mot-de-passe`              | connecté | Changer son mot de passe (il faut connaître l'actuel)    |
| POST    | `/auth/mot-de-passe-oublie`       | public   | Recevoir un code à 6 chiffres par e-mail : `{ "email" }` |
| POST    | `/auth/mot-de-passe-reinitialise` | public   | `{ "email", "code", "nouveauMotDePasse" }`               |

- Après un changement de mot de passe, tous les anciens jetons sont refusés. L'appareil qui a fait le changement reçoit un jeton neuf.
- Le code est valable 15 minutes, ne sert qu'une fois, et accepte 5 essais. Un compte reçoit au plus 1 code par minute et 5 par jour. Seule l'empreinte du code est gardée en base.
- « Mot de passe oublié » répond toujours la même chose, que le compte existe ou non.
- L'e-mail et le rôle ne se modifient pas par `/auth/moi`.

**Notifications.** Le client reçoit un e-mail quand sa commande est enregistrée, payée, expédiée, prête au retrait, récupérée ou annulée. L'API repasse toutes les 30 secondes sur les étapes pas encore notifiées : un e-mail qui échoue est retenté (pendant 24 h), et une panne du service d'envoi ne bloque jamais une commande. Le code de retrait n'est jamais écrit dans un e-mail.

```env
SMTP_URL="smtps://identifiant:motdepasse@smtp.exemple.com:465"
EMAIL_EXPEDITEUR="KDExpress <contact@kdexpress.cd>"
```

Sans `SMTP_URL`, les e-mails sont écrits dans le journal de l'API au lieu d'être envoyés. En production, les deux variables sont obligatoires.

## Tableau de bord (direction)

`GET /admin/tableau-de-bord?du=2026-11-01&au=2026-11-30` : les deux jours sont compris. Sans dates : les 30 derniers jours. Période de 366 jours au plus. Les journées sont celles de Kinshasa.

| Bloc               | Contenu                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `commandes`        | Commandes créées, payées, expédiées, récupérées, annulées pendant la période                                                                     |
| `encaissements`    | Argent reçu, par moyen et par objet. Les paiements par avoir sont comptés à part                                                                 |
| `ventes`           | Valeur des commandes passées (articles, transport, frais de service), hors commandes annulées                                                    |
| `marge`            | Articles achetés à Dubaï : prix payé par le client, prix payé à la boutique, marge                                                               |
| `avoirs`           | Avoirs crédités et utilisés, et total dû aux clients aujourd'hui                                                                                 |
| `meilleuresVentes` | Les 5 produits les plus commandés                                                                                                                |
| `parJour`          | Une ligne par jour (commandes, argent reçu), pour tracer une courbe                                                                              |
| `enCours`          | Maintenant : commandes par étape, articles à acheter, colis à expédier et en route, retraits en retard, produits à valider, boutiques à vérifier |

## Réglages (direction)

Le taux de change, le transport, les frais de service, la marge et les délais se règlent sans toucher à la base.

| Méthode | Route               | Rôle                                                       |
| ------- | ------------------- | ---------------------------------------------------------- |
| GET     | `/admin/parametres` | Tous les réglages, avec leur valeur et ce qu'ils acceptent |
| PATCH   | `/admin/parametres` | Modifier un ou plusieurs réglages ensemble                 |

```json
{ "modifications": [{ "code": "taux_change_aed_usd", "valeur": "0.2725" }] }
```

- Chaque réglage a sa règle (bornes, décimales, choix possibles) : un taux de change de `27` est refusé.
- Les modifications d'une requête passent toutes, ou aucune.
- Les réglages doivent rester cohérents : passer le transport au `poids` exige un prix du kilo, à donner dans la même requête.
- Un changement ne touche que les futures commandes ; les commandes passées gardent leurs montants figés.
- Chaque changement est écrit dans le journal du serveur (ancienne valeur, nouvelle valeur, auteur).

## Protections

| Protection                   | Ce qu'elle fait                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Limites d'essais             | 120 requêtes par minute (par utilisateur connecté, sinon par adresse). Au-delà : 429                 |
| Connexion                    | 5 essais par minute pour un même email depuis une même adresse, 20 par adresse tous emails confondus |
| Inscription                  | 10 par minute et par adresse                                                                         |
| Codes de retrait             | 20 par minute et par agent                                                                           |
| En-têtes de sécurité         | Ajoutés à chaque réponse (`helmet`)                                                                  |
| Sites autorisés (CORS)       | Seuls les sites de `ORIGINES_AUTORISEES` peuvent appeler l'API depuis un navigateur                  |
| Contrôle de la configuration | Au démarrage : `DATABASE_URL`, `JWT_SECRET` (32 caractères au moins)… L'API refuse de démarrer sinon |
| Erreurs imprévues            | Le client reçoit « Erreur interne » et une référence ; le détail reste dans le journal du serveur    |
| Santé                        | `GET /` vérifie aussi la base de données (503 si elle ne répond pas)                                 |

Variables pour la mise en ligne :

```env
NODE_ENV=production
ORIGINES_AUTORISEES="https://app.kdexpress.cd,https://admin.kdexpress.cd"
PROXYS_DE_CONFIANCE=1
```

- `ORIGINES_AUTORISEES` est obligatoire en production. Sans elle, en développement, tous les sites sont acceptés.
- `PROXYS_DE_CONFIANCE` : le nombre de proxys de l'hébergeur devant l'API. Sans ce réglage, tous les clients sembleraient venir de la même adresse et se bloqueraient entre eux.
- Les compteurs sont gardés en mémoire : c'est valable pour un seul serveur.

## Structure

```
prisma/
  schema.prisma       description des 28 tables
  migrations/         historique de la base (init, contraintes, marge du catalogue, compte et notifications)
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
  boutiques/          boutiques de Dubaï, gestionnaires, vérification, offres
  fournisseur/        espace des boutiques partenaires : propositions et offres
  achats/             liste d'achats, achats en boutique, introuvables et remboursements
  agences/            agences de transport
  expedition/         colis, lots, départ, arrivée, pointage
  retraits/           remise des colis au client
  avis/               avis sur le service
  emails/             envoi des e-mails, modèles, notifications de commande
  tableau-de-bord/    chiffres de la direction
  parametres/         réglages de la direction et leurs règles
  etiquettes/         étiquettes PDF avec QR, pointage par scan
  fichiers/           réception, vérification, compression et rangement des photos
  commun/             outils partagés : transactions, rôles, limites d'essais, contrôle du .env, filtre d'erreurs
```

## Commandes utiles

| Commande                                          | Rôle                                       |
| ------------------------------------------------- | ------------------------------------------ |
| `npm run start:dev`                               | Lancer l'API en mode développement         |
| `npx prisma migrate dev --name <nom>`             | Appliquer un changement de `schema.prisma` |
| `npx prisma studio`                               | Voir les tables dans le navigateur         |
| `npx tsx prisma/seed.ts`                          | Remettre les données d'essai               |
| `npx tsx prisma/creer-direction.ts <email> <mdp>` | Créer ou réinitialiser un compte direction |

## Tests

| Commande           | Rôle                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `npm test`         | Tests unitaires des calculs (paliers, montants, remboursements, marge…) |
| `npm run test:e2e` | Démarre l'API complète sur la base du `.env` et vérifie quelques routes |
| `npm run lint`     | Vérifie le code                                                         |

Les tests unitaires n'ont pas besoin de base de données : Prisma y est remplacé par une doublure.
Sur GitHub, chaque push lance le lint, la compilation et les deux séries de tests (`.github/workflows/tests.yml`).

## Organisation du code

- `main` contient toujours une version qui fonctionne.
- Chaque étape est développée sur une branche `feature/<nom>`, puis fusionnée dans `main`.
- Messages de commit : `feat`, `fix`, `chore`, `refactor`, `docs`.
