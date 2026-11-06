import { Prisma } from '@prisma/client';
import {
  articlesEnUsd,
  CommandeAChiffrer,
  montantsDus,
  remboursementLigne,
  resteAPayer,
} from './montants.js';

const D = (v: string | number) => new Prisma.Decimal(v);

// Une commande enregistrée : 2 × 280 AED + 1 × 180 AED au taux figé de 0,272294
// articles : 740 AED → 201,50 USD ; transport 5 % → 10,08 ; frais de service 10
const COMMANDE: CommandeAChiffrer = {
  tauxChangeAedUsd: D('0.272294'),
  fraisTransportUsd: D('10.08'),
  fraisServiceUsd: D('10.00'),
  lignes: [
    { prixUnitaireAed: D('280.00'), quantite: 2 },
    { prixUnitaireAed: D('180.00'), quantite: 1 },
  ],
};

const paiement = (
  objetPaiement: 'articles_transport' | 'solde_retrait',
  montant: string,
) => ({ objetPaiement, montantPayeUsd: D(montant) });

describe('montants', () => {
  it('articles en USD : total converti une fois, arrondi au centime', () => {
    expect(articlesEnUsd(COMMANDE).toFixed(2)).toBe('201.50'); // 740 × 0,272294 = 201,4976
  });

  it('montants dus : articles + transport à la commande, frais de service au retrait', () => {
    const dus = montantsDus(COMMANDE);
    expect(dus.articles_transport.toFixed(2)).toBe('211.58');
    expect(dus.solde_retrait.toFixed(2)).toBe('10.00');
    expect(dus.frais_stockage.toFixed(2)).toBe('0.00');
  });

  describe('reste à payer', () => {
    it('rien payé : tout reste dû', () => {
      const r = resteAPayer(COMMANDE, []);
      expect(r.articlesTransport.toFixed(2)).toBe('211.58');
      expect(r.soldeRetrait.toFixed(2)).toBe('10.00');
      expect(r.total.toFixed(2)).toBe('221.58');
    });

    it('paiements partiels additionnés, par objet', () => {
      const r = resteAPayer(COMMANDE, [
        paiement('articles_transport', '100.00'),
        paiement('articles_transport', '11.58'),
        paiement('solde_retrait', '4.00'),
      ]);
      expect(r.articlesTransport.toFixed(2)).toBe('100.00');
      expect(r.soldeRetrait.toFixed(2)).toBe('6.00');
      expect(r.total.toFixed(2)).toBe('106.00');
    });

    it('un paiement d’un objet ne réduit pas l’autre', () => {
      const r = resteAPayer(COMMANDE, [paiement('solde_retrait', '10.00')]);
      expect(r.articlesTransport.toFixed(2)).toBe('211.58');
      expect(r.soldeRetrait.toFixed(2)).toBe('0.00');
    });

    it('jamais négatif, même si trop payé', () => {
      const r = resteAPayer(COMMANDE, [
        paiement('articles_transport', '500.00'),
      ]);
      expect(r.articlesTransport.toFixed(2)).toBe('0.00');
      expect(r.total.toFixed(2)).toBe('10.00');
    });
  });

  describe('remboursement d’une ligne introuvable', () => {
    it('article au taux figé + part du transport au prorata', () => {
      // 180 AED → 49,01 USD ; part du transport : 10,08 × 49,01 / 201,50 = 2,4517... → 2,45
      const r = remboursementLigne(COMMANDE, COMMANDE.lignes[1]);
      expect(r.articleUsd.toFixed(2)).toBe('49.01');
      expect(r.transportUsd.toFixed(2)).toBe('2.45');
      expect(r.totalUsd.toFixed(2)).toBe('51.46');
    });

    it('toutes les lignes remboursées : jamais plus que ce qui a été payé', () => {
      const parts = COMMANDE.lignes.map((l) => remboursementLigne(COMMANDE, l));
      const transport = parts.reduce((t, p) => t.add(p.transportUsd), D(0));
      const total = parts.reduce((t, p) => t.add(p.totalUsd), D(0));
      expect(transport.lte(COMMANDE.fraisTransportUsd)).toBe(true);
      expect(total.lte(montantsDus(COMMANDE).articles_transport)).toBe(true);
    });

    it('une commande à une seule ligne : tout le transport est rendu', () => {
      const seule: CommandeAChiffrer = {
        ...COMMANDE,
        fraisTransportUsd: D('3.81'),
        lignes: [{ prixUnitaireAed: D('280.00'), quantite: 1 }],
      };
      const r = remboursementLigne(seule, seule.lignes[0]);
      expect(r.transportUsd.toFixed(2)).toBe('3.81');
      expect(r.totalUsd.toFixed(2)).toBe(
        montantsDus(seule).articles_transport.toFixed(2),
      );
    });
  });
});
