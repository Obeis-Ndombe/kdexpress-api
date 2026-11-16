import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

// Le texte du QR collé sur un colis : « KDX-C-123-7Q »
//   123 : le numéro du colis ; 7Q : une clé de contrôle calculée à partir du numéro.
// La clé ne protège pas d'un fraudeur (le pointage exige déjà un agent connecté) :
// elle évite de pointer le mauvais colis avec un QR abîmé, mal lu, ou qui n'est pas de KDExpress.

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // sans 0/O, 1/I/L
const FORMAT = /^KDX-C-([1-9]\d{0,9})-([2-9A-HJKMNP-Z]{2})$/;

function cle(idColis: number): string {
  const empreinte = createHash('sha256')
    .update(`kdx-colis-${idColis}`)
    .digest();
  return (
    ALPHABET[empreinte[0] % ALPHABET.length] +
    ALPHABET[empreinte[1] % ALPHABET.length]
  );
}

export function codeColis(idColis: number): string {
  return `KDX-C-${idColis}-${cle(idColis)}`;
}

// Le numéro du colis d'un code scanné, ou 400 si le code n'est pas bon
export function lireCodeColis(code: string): number {
  const trouve = FORMAT.exec(code.trim().toUpperCase());
  const idColis = trouve ? Number(trouve[1]) : NaN;
  if (!trouve || !Number.isSafeInteger(idColis) || cle(idColis) !== trouve[2]) {
    throw new BadRequestException(
      "Ce code n'est pas une étiquette de colis KDExpress valide",
    );
  }
  return idColis;
}
