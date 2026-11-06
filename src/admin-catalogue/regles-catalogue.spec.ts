import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  margeVariante,
  montantPositif,
  prixAvecMarge,
  verifierPaliers,
} from './regles-catalogue.js';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('règles du catalogue', () => {
  describe('paliers', () => {
    const verifier =
      (paliers: { aPartirDe: number; prixAed: string }[]) => () =>
        verifierPaliers(D('280.00'), paliers);

    it('accepte des paliers de moins en moins chers, même envoyés dans le désordre', () => {
      expect(
        verifier([
          { aPartirDe: 12, prixAed: '240.00' },
          { aPartirDe: 6, prixAed: '260.00' },
        ]),
      ).not.toThrow();
      expect(verifier([])).not.toThrow();
    });

    it('refuse un palier plus cher que le précédent', () => {
      expect(
        verifier([
          { aPartirDe: 6, prixAed: '260.00' },
          { aPartirDe: 12, prixAed: '270.00' },
        ]),
      ).toThrow('« dès 12 »');
    });

    it('refuse un palier égal ou supérieur au prix catalogue', () => {
      expect(verifier([{ aPartirDe: 6, prixAed: '280.00' }])).toThrow(
        BadRequestException,
      );
      expect(verifier([{ aPartirDe: 6, prixAed: '300.00' }])).toThrow(
        BadRequestException,
      );
    });

    it('refuse deux paliers à la même quantité', () => {
      expect(
        verifier([
          { aPartirDe: 6, prixAed: '260.00' },
          { aPartirDe: 6, prixAed: '250.00' },
        ]),
      ).toThrow('Deux paliers commencent à 6 pièces');
    });

    it('refuse un palier à 0', () => {
      expect(verifier([{ aPartirDe: 6, prixAed: '0' }])).toThrow(
        BadRequestException,
      );
    });
  });

  it('montant positif', () => {
    expect(montantPositif('12.50', 'Le prix').toFixed(2)).toBe('12.50');
    expect(() => montantPositif('0', 'Le prix')).toThrow(
      'Le prix doit être supérieur à 0',
    );
  });

  describe('prix avec marge', () => {
    it('ajoute la marge et arrondit au dirham supérieur', () => {
      expect(prixAvecMarge(D('150'), D('20')).toFixed(2)).toBe('180.00');
      expect(prixAvecMarge(D('147'), D('20')).toFixed(2)).toBe('177.00'); // 176,40 → 177
      expect(prixAvecMarge(D('99.99'), D('20')).toFixed(2)).toBe('120.00'); // 119,988 → 120
    });

    it('marge de 0 % : le prix boutique arrondi', () => {
      expect(prixAvecMarge(D('150'), D('0')).toFixed(2)).toBe('150.00');
      expect(prixAvecMarge(D('150.10'), D('0')).toFixed(2)).toBe('151.00');
    });
  });

  describe('marge d’une variante', () => {
    const offre = (prix: string, disponible = true) => ({
      prixBoutiqueAed: D(prix),
      estDisponible: disponible,
    });

    it('calculée sur l’offre disponible la moins chère', () => {
      expect(
        margeVariante(D('180'), [
          offre('160'),
          offre('150'),
          offre('120', false),
        ]),
      ).toEqual({
        margePourcentage: '20.0',
        alerteMarge: false,
      });
    });

    it('alerte quand le client paie moins que la boutique', () => {
      expect(margeVariante(D('185'), [offre('190')])).toEqual({
        margePourcentage: '-2.6',
        alerteMarge: true,
      });
    });

    it('alerte aussi quand la marge est nulle', () => {
      expect(margeVariante(D('150'), [offre('150')]).alerteMarge).toBe(true);
    });

    it('sans offre disponible : pas de marge connue, pas d’alerte', () => {
      expect(margeVariante(D('180'), [offre('150', false)])).toEqual({
        margePourcentage: null,
        alerteMarge: false,
      });
    });
  });
});
