import {
  genererCodeRetrait,
  numeroCommande,
  numeroProvisoire,
} from './codes.js';

describe('codes', () => {
  it('code de retrait : 6 caractères lisibles, sans 0, O, 1, I ni L', () => {
    for (let i = 0; i < 1000; i++) {
      expect(genererCodeRetrait()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    }
  });

  it('code de retrait : imprévisible (1 000 tirages presque tous différents)', () => {
    const codes = new Set(
      Array.from({ length: 1000 }, () => genererCodeRetrait()),
    );
    expect(codes.size).toBeGreaterThan(995);
  });

  it('numéro de commande lisible', () => {
    expect(numeroCommande(2026, 42)).toBe('KD-2026-000042');
    expect(numeroCommande(2027, 1234567)).toBe('KD-2027-1234567');
  });

  it('numéro provisoire : 20 caractères, unique', () => {
    const a = numeroProvisoire();
    expect(a).toHaveLength(20);
    expect(a.startsWith('TMP-')).toBe(true);
    expect(numeroProvisoire()).not.toBe(a);
  });
});
