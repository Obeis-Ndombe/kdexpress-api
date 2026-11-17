import { BadRequestException } from '@nestjs/common';
import { aujourdhui, periode } from './periode.js';

describe('période du tableau de bord', () => {
  // 17 novembre 2026, 23 h 30 UTC : il est déjà le 18 à Kinshasa (UTC+1)
  const tard = new Date('2026-11-17T23:30:00Z');

  it('le jour est celui de Kinshasa', () => {
    expect(aujourdhui(tard)).toBe('2026-11-18');
    expect(aujourdhui(new Date('2026-11-17T12:00:00Z'))).toBe('2026-11-17');
  });

  it('par défaut : les 30 derniers jours, aujourd’hui compris', () => {
    expect(periode(undefined, undefined, tard)).toEqual({
      du: '2026-10-20',
      au: '2026-11-18',
    });
  });

  it('avec une seule borne', () => {
    expect(periode('2026-11-01', undefined, tard)).toEqual({
      du: '2026-11-01',
      au: '2026-11-18',
    });
    expect(periode(undefined, '2026-03-31', tard)).toEqual({
      du: '2026-03-02',
      au: '2026-03-31',
    });
  });

  it('un seul jour est une période valable', () => {
    expect(periode('2026-11-05', '2026-11-05')).toEqual({
      du: '2026-11-05',
      au: '2026-11-05',
    });
  });

  it('refuse une date qui n’existe pas, une période à l’envers ou trop longue', () => {
    expect(() => periode('2026-02-31', '2026-03-05')).toThrow(
      "n'est pas une date du calendrier",
    );
    expect(() => periode('2026-11-10', '2026-11-01')).toThrow(
      BadRequestException,
    );
    expect(() => periode('2025-01-01', '2026-11-01')).toThrow('366 jours');
    expect(() => periode('2025-11-02', '2026-11-02')).not.toThrow(); // 366 jours
  });
});
