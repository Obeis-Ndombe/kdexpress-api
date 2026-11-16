import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { codeColis } from './code-colis.js';

// Une étiquette 10 × 15 cm (format des imprimantes thermiques), en points PDF (1 mm = 2,835 pt)
const MM = 72 / 25.4;
const LARGEUR = 100 * MM;
const HAUTEUR = 150 * MM;
const MARGE = 6 * MM;
const ETIQUETTES_MAX = 500; // par PDF

const INCLUSION = {
  commande: {
    select: {
      numeroCommande: true,
      client: { select: { nom: true, prenom: true, telephone: true } },
      // tous les colis de la commande, pour écrire « Colis 2 / 3 »
      colis: { select: { idColis: true }, orderBy: { idColis: 'asc' } },
    },
  },
  lotExpedition: {
    select: { referenceLot: true, agence: { select: { nomAgence: true } } },
  },
} satisfies Prisma.ColisInclude;

type ColisAEtiqueter = Prisma.ColisGetPayload<{ include: typeof INCLUSION }>;

// Ce qui est imprimé. Jamais le code de retrait : le colis passe entre trop de mains.
export interface Etiquette {
  code: string;
  numeroCommande: string;
  rang: string; // « 2 / 3 »
  lot: string | null;
  transport: string | null;
  poids: string | null;
  client: string; // « Marie K. »
  telephone: string | null; // « •••• 4521 »
}

@Injectable()
export class EtiquettesService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /colis/:id/etiquette
  async pourColis(idColis: number) {
    const colis = await this.prisma.colis.findUnique({
      where: { idColis },
      include: INCLUSION,
    });
    if (!colis) {
      throw new NotFoundException(`Colis ${idColis} introuvable`);
    }
    return this.pdf([colis], `etiquette-colis-${idColis}.pdf`);
  }

  // GET /lots/:id/etiquettes : toutes les étiquettes du lot, une par page
  async pourLot(idLot: number) {
    const lot = await this.prisma.lotExpedition.findUnique({
      where: { idLotExpedition: idLot },
      include: {
        colis: {
          include: INCLUSION,
          orderBy: { idColis: 'asc' },
          take: ETIQUETTES_MAX,
        },
      },
    });
    if (!lot) {
      throw new NotFoundException(`Lot ${idLot} introuvable`);
    }
    if (lot.colis.length === 0) {
      throw new BadRequestException(`Le lot ${idLot} ne contient aucun colis`);
    }
    return this.pdf(lot.colis, `etiquettes-${lot.referenceLot}.pdf`);
  }

  // ------- outils internes -------

  private async pdf(colis: ColisAEtiqueter[], nomFichier: string) {
    const doc = new PDFDocument({
      size: [LARGEUR, HAUTEUR],
      margin: MARGE,
      autoFirstPage: false,
      info: { Title: 'Étiquettes de colis KDExpress' },
    });
    const morceaux: Buffer[] = [];
    doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
    const termine = new Promise<void>((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });

    for (const c of colis) {
      doc.addPage();
      await dessiner(doc, etiquette(c));
    }
    doc.end();
    await termine;

    return new StreamableFile(Buffer.concat(morceaux), {
      type: 'application/pdf',
      disposition: `inline; filename="${nomFichier}"`,
    });
  }
}

// Les données d'une étiquette. Le client est abrégé : assez pour le bureau, pas pour un inconnu.
export function etiquette(c: ColisAEtiqueter): Etiquette {
  const rang = c.commande.colis.findIndex((x) => x.idColis === c.idColis) + 1;
  const { nom, prenom, telephone } = c.commande.client;
  const chiffres = telephone?.replace(/\D/g, '') ?? '';
  return {
    code: codeColis(c.idColis),
    numeroCommande: c.commande.numeroCommande,
    rang: `${rang} / ${c.commande.colis.length}`,
    lot: c.lotExpedition?.referenceLot ?? null,
    transport: c.lotExpedition?.agence.nomAgence ?? null,
    poids: c.poidsReelKg
      ? `${c.poidsReelKg.toFixed(3).replace('.', ',')} kg`
      : null,
    client: `${prenom} ${nom.charAt(0).toUpperCase()}.`,
    telephone: chiffres.length >= 4 ? `•••• ${chiffres.slice(-4)}` : null,
  };
}

async function dessiner(doc: PDFKit.PDFDocument, e: Etiquette) {
  const utile = LARGEUR - 2 * MARGE;

  // Bandeau
  doc.rect(0, 0, LARGEUR, 20 * MM).fill('#000000');
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('KDExpress', MARGE, 5 * MM, { width: utile, lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(10)
    .text('Dubaï - Kinshasa', MARGE, 13 * MM, {
      width: utile,
      lineBreak: false,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Colis ${e.rang}`, MARGE, 8 * MM, { width: utile, align: 'right' });

  // Le QR, grand : c'est lui qui est scanné à Kinshasa
  const coteQr = 62 * MM;
  const qr = await QRCode.toBuffer(e.code, {
    errorCorrectionLevel: 'Q', // lisible même si un quart du QR est abîmé
    margin: 2,
    width: 600,
  });
  doc.image(qr, (LARGEUR - coteQr) / 2, 24 * MM, { width: coteQr });
  doc
    .fillColor('#000000')
    .font('Courier-Bold')
    .fontSize(13)
    .text(e.code, MARGE, 88 * MM, { width: utile, align: 'center' });

  // Les informations
  doc
    .moveTo(MARGE, 96 * MM)
    .lineTo(LARGEUR - MARGE, 96 * MM)
    .lineWidth(0.8)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(19)
    .text(e.numeroCommande, MARGE, 100 * MM, { width: utile, align: 'center' });

  const lignes: [string, string][] = [
    ['Client', e.telephone ? `${e.client}   ${e.telephone}` : e.client],
    ['Poids', e.poids ?? 'à peser'],
    ['Lot', e.lot ?? 'pas encore dans un lot'],
    ['Transport', e.transport ?? '-'],
  ];
  let y = 112 * MM;
  for (const [libelle, valeur] of lignes) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(libelle, MARGE, y + 1, { width: 22 * MM, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(valeur, MARGE + 22 * MM, y, {
        width: utile - 22 * MM,
        lineBreak: false,
        ellipsis: true,
      });
    y += 8 * MM;
  }
}
