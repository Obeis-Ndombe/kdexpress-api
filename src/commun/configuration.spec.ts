import { originesAutorisees, verifierConfiguration } from './configuration.js';

const BON = {
  DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/kdexpress',
  JWT_SECRET: 'a'.repeat(64),
};

describe('contrôle de la configuration', () => {
  it('accepte une configuration complète', () => {
    expect(() => verifierConfiguration(BON)).not.toThrow();
    expect(() =>
      verifierConfiguration({
        ...BON,
        JWT_DUREE_SECONDES: '86400',
        PORT: '3000',
        NODE_ENV: 'production',
        ORIGINES_AUTORISEES:
          'https://app.kdexpress.cd, https://admin.kdexpress.cd',
      }),
    ).not.toThrow();
  });

  it('refuse un secret absent ou trop court', () => {
    expect(() =>
      verifierConfiguration({ ...BON, JWT_SECRET: undefined }),
    ).toThrow('JWT_SECRET');
    expect(() =>
      verifierConfiguration({ ...BON, JWT_SECRET: 'court' }),
    ).toThrow('au moins 32 caractères');
  });

  it('refuse une base absente', () => {
    expect(() => verifierConfiguration({ JWT_SECRET: BON.JWT_SECRET })).toThrow(
      'DATABASE_URL',
    );
  });

  it('liste toutes les erreurs en une fois', () => {
    expect(() => verifierConfiguration({ PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*PORT/,
    );
  });

  it('en production, exige la liste des sites autorisés', () => {
    expect(() =>
      verifierConfiguration({ ...BON, NODE_ENV: 'production' }),
    ).toThrow('ORIGINES_AUTORISEES est obligatoire en production');
    expect(() =>
      verifierConfiguration({ ...BON, NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('refuse une origine mal écrite', () => {
    for (const origine of [
      'app.kdexpress.cd',
      'https://app.kdexpress.cd/',
      '*',
    ]) {
      expect(() =>
        verifierConfiguration({ ...BON, ORIGINES_AUTORISEES: origine }),
      ).toThrow('ORIGINES_AUTORISEES');
    }
  });

  it('lit la liste des origines', () => {
    expect(
      originesAutorisees({
        ORIGINES_AUTORISEES: ' https://a.cd ,https://b.cd,',
      }),
    ).toEqual(['https://a.cd', 'https://b.cd']);
    expect(originesAutorisees({})).toEqual([]);
  });
});
