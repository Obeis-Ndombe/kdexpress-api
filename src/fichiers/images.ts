import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const TAILLE_MAX_PHOTO = 8 * 1024 * 1024; // 8 Mo
export const PHOTOS_MAX = 10; // par produit ou par colis

const COTE_MAX_PX = 1600;
// garde-fou contre les « bombes » : une petite image qui se décompresse en milliards de pixels
const PIXELS_MAX = 50_000_000;
const FORMATS_ACCEPTES = ['jpeg', 'png', 'webp'];

// Le fichier tel que l'envoi multipart le livre (seuls les champs utiles)
export interface PhotoRecue {
  buffer: Buffer;
  size: number;
  originalname: string;
}

// Vérifie que c'est une vraie image (on lit son contenu, pas son extension),
// puis la prépare pour le web : redressée, 1600 px au plus, WebP, sans métadonnées.
// sharp n'écrit aucune métadonnée par défaut : la position GPS (EXIF) disparaît.
export async function preparerPhoto(photo: PhotoRecue | undefined) {
  if (!photo || photo.size === 0) {
    throw new BadRequestException(
      'Aucune photo reçue : envoyez le fichier dans le champ « photo » (multipart/form-data)',
    );
  }

  let format: string | undefined;
  try {
    format = (
      await sharp(photo.buffer, { limitInputPixels: PIXELS_MAX }).metadata()
    ).format;
  } catch {
    format = undefined;
  }
  if (format === 'heif') {
    throw new BadRequestException(
      'Les photos HEIC (iPhone) ne sont pas acceptées : envoyez-la en JPEG',
    );
  }
  if (!format || !FORMATS_ACCEPTES.includes(format)) {
    throw new BadRequestException(
      "Le fichier n'est pas une image JPEG, PNG ou WebP",
    );
  }

  try {
    return await sharp(photo.buffer, { limitInputPixels: PIXELS_MAX })
      .rotate() // applique l'orientation du téléphone avant d'effacer les métadonnées
      .resize({
        width: COTE_MAX_PX,
        height: COTE_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new BadRequestException("L'image est abîmée ou illisible");
  }
}
