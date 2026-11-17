// Le contrôle du fichier .env, fait une fois au démarrage.
// Mieux vaut une API qui refuse de démarrer qu'une API qui tourne avec un secret oublié.

export const EN_PRODUCTION = () => process.env.NODE_ENV === 'production';

export function verifierConfiguration(env: Record<string, unknown>) {
  const erreurs: string[] = [];
  const texte = (nom: string) =>
    typeof env[nom] === 'string' ? env[nom].trim() : '';
  const entier = (nom: string, minimum: number) => {
    const valeur = texte(nom);
    if (valeur && !(/^\d+$/.test(valeur) && Number(valeur) >= minimum)) {
      erreurs.push(`${nom} doit être un nombre entier d'au moins ${minimum}`);
    }
  };

  if (!/^postgres(ql)?:\/\//.test(texte('DATABASE_URL'))) {
    erreurs.push(
      'DATABASE_URL est absent ou ne commence pas par postgresql://',
    );
  }
  if (texte('JWT_SECRET').length < 32) {
    erreurs.push(
      'JWT_SECRET est absent ou trop court : il faut au moins 32 caractères',
    );
  }
  entier('JWT_DUREE_SECONDES', 60);
  entier('PORT', 1);
  entier('PROXYS_DE_CONFIANCE', 0);

  const origines = originesAutorisees(env);
  for (const origine of origines) {
    if (!/^https?:\/\/[^/\s]+$/.test(origine)) {
      erreurs.push(
        `ORIGINES_AUTORISEES : « ${origine} » n'est pas une origine (ex. https://app.kdexpress.cd, sans / à la fin)`,
      );
    }
  }
  entier('NOTIFICATIONS_INTERVALLE_SECONDES', 0);
  const smtp = texte('SMTP_URL');
  if (smtp && !/^smtps?:\/\/\S+$/.test(smtp)) {
    erreurs.push(
      'SMTP_URL doit ressembler à smtps://identifiant:motdepasse@serveur:465',
    );
  }
  if (env.NODE_ENV === 'production' && (!smtp || !texte('EMAIL_EXPEDITEUR'))) {
    erreurs.push(
      'SMTP_URL et EMAIL_EXPEDITEUR sont obligatoires en production (sans eux, aucun e-mail ne part : ni code de mot de passe oublié, ni notification)',
    );
  }
  if (env.NODE_ENV === 'production' && origines.length === 0) {
    erreurs.push(
      'ORIGINES_AUTORISEES est obligatoire en production (les sites web qui ont le droit d’appeler l’API)',
    );
  }

  if (erreurs.length > 0) {
    throw new Error(
      `Configuration invalide (fichier .env) :\n- ${erreurs.join('\n- ')}`,
    );
  }
  return env;
}

// « https://a.cd, https://b.cd » -> ['https://a.cd', 'https://b.cd']
export function originesAutorisees(env: Record<string, unknown>): string[] {
  const valeur = env.ORIGINES_AUTORISEES;
  return typeof valeur === 'string'
    ? valeur
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o !== '')
    : [];
}
