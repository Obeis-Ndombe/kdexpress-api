import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Les groupes de la documentation, d'après le début de l'adresse de chaque route
const GROUPES: [RegExp, string][] = [
  [/^\/$/, 'Santé'],
  [/^\/auth/, 'Compte'],
  [/^\/catalogue/, 'Catalogue (public)'],
  [/^\/commandes\/[^/]+\/paiements/, 'Paiements et avoirs'],
  [/^\/commandes\/[^/]+\/avis|^\/avis/, 'Avis'],
  [/^\/commandes/, 'Commandes'],
  [/^\/avoirs/, 'Paiements et avoirs'],
  [/^\/boutiques/, 'Boutiques (agents)'],
  [/^\/achats/, 'Achats à Dubaï'],
  [
    /^\/colis\/[^/]+\/etiquette|^\/lots\/[^/]+\/etiquettes|^\/colis\/pointage-scan/,
    'Étiquettes QR',
  ],
  [/^\/expedition|^\/colis|^\/lots|^\/agences/, 'Expédition'],
  [/^\/retraits/, 'Retraits'],
  [/^\/fournisseur/, 'Espace fournisseur'],
  [/^\/admin\/tableau-de-bord/, 'Direction : tableau de bord'],
  [/^\/admin\/parametres/, 'Direction : réglages'],
  [/^\/admin\/boutiques/, 'Direction : boutiques partenaires'],
  [/^\/admin/, 'Direction : catalogue'],
  [/^\/utilisateurs/, 'Direction : utilisateurs'],
];

// La page /docs : toutes les routes, leurs champs, et un bouton pour les essayer.
// Les champs sont lus dans les DTO par le plugin Swagger (voir nest-cli.json).
export function installerDocumentation(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('KDExpress API')
    .setDescription(
      [
        'Commandes de produits de Dubaï, retirées au bureau de Kinshasa.',
        '',
        '**Se connecter** : `POST /auth/connexion`, copier `jetonAcces`, cliquer sur **Authorize** et le coller.',
        'Les routes publiques marchent aussi sans jeton.',
        '',
        'Les montants et les poids sont envoyés en texte (`"874.88"`) pour rester exacts.',
        'Les photos s’envoient en `multipart/form-data`, dans le champ `photo`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // chaque route rangée dans son groupe, sans avoir à annoter chaque controller
  const groupes = new Set<string>();
  for (const [chemin, operations] of Object.entries(document.paths)) {
    const groupe =
      GROUPES.find(([motif]) => motif.test(chemin))?.[1] ?? 'Autres';
    groupes.add(groupe);
    for (const operation of Object.values(operations)) {
      if (
        operation &&
        typeof operation === 'object' &&
        'responses' in operation
      ) {
        operation.tags = [groupe];
      }
    }
  }
  const ordre = [...new Set([...GROUPES.map(([, g]) => g), 'Autres'])];
  document.tags = ordre.filter((g) => groupes.has(g)).map((name) => ({ name }));

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'KDExpress API',
    jsonDocumentUrl: 'docs/openapi.json', // pour générer le code des applis
    swaggerOptions: {
      persistAuthorization: true, // le jeton reste après un rechargement de la page
      docExpansion: 'none',
      tagsSorter: undefined,
    },
  });
}
