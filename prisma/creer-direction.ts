// Crée (ou remet en état) le premier compte de la direction.
// Lancer avec : npx tsx prisma/creer-direction.ts <email> <mot de passe>
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const [email, motDePasse] = process.argv.slice(2);
  if (!email || !motDePasse || motDePasse.length < 8) {
    console.error(
      'Usage : npx tsx prisma/creer-direction.ts <email> <mot de passe de 8 caractères ou plus>',
    );
    process.exit(1);
  }

  const motDePasseHash = await hash(motDePasse, 10);

  // upsert = update si l'e-mail existe, insert sinon
  const direction = await prisma.utilisateur.upsert({
    where: { email: email.trim().toLowerCase() },
    update: {
      motDePasseHash,
      roleUtilisateur: 'direction',
      statutCompte: 'actif',
    },
    create: {
      nom: 'Direction',
      prenom: 'KDExpress',
      email: email.trim().toLowerCase(),
      motDePasseHash,
      roleUtilisateur: 'direction',
    },
  });

  console.log(
    `Compte direction prêt : ${direction.email} (id ${direction.idUtilisateur})`,
  );
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
