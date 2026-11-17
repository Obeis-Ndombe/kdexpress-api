import { incoherence, verifierParametre } from './regles-parametres.js';

const accepte = (code: string, valeur: string) => {
  const r = verifierParametre(code, valeur);
  return 'valeur' in r ? r.valeur : `REFUS: ${r.erreur}`;
};
const refuse = (code: string, valeur: string) =>
  'erreur' in verifierParametre(code, valeur);

describe('règles des réglages', () => {
  it('taux de change : un nombre plausible, nettoyé', () => {
    expect(accepte('taux_change_aed_usd', ' 0.272500 ')).toBe('0.2725');
    for (const v of ['0', '-1', '27', 'abc', '', '0,27', '0.2722941', '1e3']) {
      expect(refuse('taux_change_aed_usd', v)).toBe(true);
    }
  });

  it('pourcentages bornés', () => {
    expect(accepte('transport_pourcentage', '5')).toBe('5');
    expect(accepte('transport_pourcentage', '0')).toBe('0');
    expect(refuse('transport_pourcentage', '101')).toBe(true);
    expect(accepte('marge_catalogue_pourcentage', '22.5')).toBe('22.5');
    expect(refuse('marge_catalogue_pourcentage', '501')).toBe(true);
  });

  it('choix fermés', () => {
    expect(accepte('transport_mode', 'poids')).toBe('poids');
    expect(refuse('transport_mode', 'avion')).toBe(true);
    expect(refuse('frais_service_mode', 'pourcentage')).toBe(true); // pas encore géré par les devis
  });

  it('délais : entiers seulement', () => {
    expect(accepte('delai_retrait_jours', '30')).toBe('30');
    expect(refuse('delai_retrait_jours', '2.5')).toBe(true);
    expect(refuse('delai_retrait_jours', '0')).toBe(true);
  });

  it('réglages facultatifs : vide accepté, 0 refusé pour le prix du kilo', () => {
    expect(accepte('transport_prix_kg_usd', '')).toBe('');
    expect(accepte('transport_prix_kg_usd', '8.50')).toBe('8.5');
    expect(refuse('transport_prix_kg_usd', '0')).toBe(true);
  });

  it('réglage inconnu', () => {
    expect(refuse('jwt_secret', 'x')).toBe(true);
  });

  it('cohérence : le transport au poids exige un prix du kilo', () => {
    const base = new Map([
      ['taux_change_aed_usd', '0.2723'],
      ['transport_mode', 'pourcentage'],
      ['transport_pourcentage', '5'],
      ['transport_prix_kg_usd', ''],
      ['frais_service_usd', '10'],
    ]);
    expect(incoherence(base)).toBeNull();
    expect(incoherence(new Map(base).set('transport_mode', 'poids'))).toContain(
      'prix du kilo',
    );
    expect(
      incoherence(
        new Map(base)
          .set('transport_mode', 'poids')
          .set('transport_prix_kg_usd', '8'),
      ),
    ).toBeNull();
  });
});
