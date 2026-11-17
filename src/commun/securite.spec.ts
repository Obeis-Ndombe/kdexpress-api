import { BadRequestException } from '@nestjs/common';
import { emailMasque } from './journal-securite.js';
import { ParseIdPipe } from './parse-id.pipe.js';
import { ProfondeurPipe } from './profondeur.pipe.js';

describe('identifiants dans l’adresse', () => {
  const pipe = new ParseIdPipe();
  const meta = { type: 'param' as const, data: 'id' };

  it('accepte un entier de 1 à 2 147 483 647', () => {
    expect(pipe.transform('1', meta)).toBe(1);
    expect(pipe.transform('2147483647', meta)).toBe(2147483647);
  });

  it('refuse tout le reste avec une 400 qui nomme le paramètre', () => {
    for (const v of [
      '0',
      '-1',
      '2147483648',
      '99999999999',
      '1.5',
      '0x10',
      '1e3',
      ' 1',
      '',
      'abc',
      ['1', '2'],
      undefined,
    ]) {
      expect(() => pipe.transform(v, meta)).toThrow(BadRequestException);
    }
    expect(() => pipe.transform('abc', meta)).toThrow(
      'id doit être un nombre entier positif',
    );
  });

  it('accepte aussi un nombre déjà converti par la validation globale', () => {
    expect(pipe.transform(42, meta)).toBe(42);
    for (const v of [0, -1, 1.5, 2147483648, Number.NaN]) {
      expect(() => pipe.transform(v, meta)).toThrow(BadRequestException);
    }
  });

  it('paramètre facultatif : absent, il vaut undefined', () => {
    const facultatif = new ParseIdPipe({ optional: true });
    expect(facultatif.transform(undefined, meta)).toBeUndefined();
    expect(() => facultatif.transform('0', meta)).toThrow(BadRequestException);
  });
});

describe('profondeur des corps de requête', () => {
  const pipe = new ProfondeurPipe();
  const imbrique = (n: number): unknown => {
    let v: unknown = 1;
    for (let i = 0; i < n; i++) v = [v];
    return v;
  };

  it('laisse passer un corps normal', () => {
    const corps = {
      lignes: [{ idVariante: 1, quantite: 2, options: [{ a: 1 }] }],
    };
    expect(pipe.transform(corps)).toBe(corps);
    expect(pipe.transform(imbrique(31))).toBeDefined();
  });

  it('refuse un corps imbriqué à l’excès, sans déborder la pile', () => {
    expect(() => pipe.transform(imbrique(33))).toThrow('trop imbriqué');
    expect(() => pipe.transform(imbrique(100_000))).toThrow('trop imbriqué');
  });
});

it('e-mail masqué dans le journal', () => {
  expect(emailMasque('marie.kabila@exemple.cd')).toBe('ma***@exemple.cd');
  expect(emailMasque('pas-un-email')).toBe('***');
});
