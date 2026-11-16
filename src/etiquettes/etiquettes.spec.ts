import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { codeColis, lireCodeColis } from './code-colis.js';
import { etiquette } from './etiquettes.service.js';

describe('code des colis', () => {
  it('un code se relit en son numéro de colis', () => {
    for (const id of [1, 7, 42, 123, 99999, 2147483647]) {
      expect(codeColis(id)).toMatch(/^KDX-C-\d+-[2-9A-HJKMNP-Z]{2}$/);
      expect(lireCodeColis(codeColis(id))).toBe(id);
    }
  });

  it('accepte les minuscules et les espaces autour', () => {
    expect(lireCodeColis(`  ${codeColis(123).toLowerCase()} `)).toBe(123);
  });

  it('refuse un numéro modifié : la clé ne correspond plus', () => {
    const [, , , cle] = codeColis(123).split('-');
    expect(() => lireCodeColis(`KDX-C-124-${cle}`)).toThrow(
      BadRequestException,
    );
    expect(() => lireCodeColis(`KDX-C-1230-${cle}`)).toThrow(
      BadRequestException,
    );
  });

  it('refuse presque toutes les clés fausses', () => {
    // sur 1 000 colis, une clé prise au colis voisin ne passe (presque) jamais
    let acceptes = 0;
    for (let id = 1; id <= 1000; id++) {
      const cleVoisine = codeColis(id + 1).split('-')[3];
      try {
        lireCodeColis(`KDX-C-${id}-${cleVoisine}`);
        acceptes++;
      } catch {
        // refusé : c'est le cas normal
      }
    }
    expect(acceptes).toBeLessThan(10);
  });

  it('refuse ce qui n’est pas une étiquette KDExpress', () => {
    for (const code of [
      '',
      '123',
      'KDX-C-123',
      'KDX-C-0-AA',
      'KDX-C--5-AA',
      'https://exemple.com/produit/123',
      'KDX-C-123-7Q-EXTRA',
    ]) {
      expect(() => lireCodeColis(code)).toThrow(BadRequestException);
    }
  });
});

describe('contenu d’une étiquette', () => {
  const colis = (extra: object = {}) =>
    ({
      idColis: 12,
      poidsReelKg: new Prisma.Decimal('1.25'),
      commande: {
        numeroCommande: 'KD-2026-000042',
        client: {
          nom: 'kabila',
          prenom: 'Marie',
          telephone: '+243 81 234 4521',
        },
        colis: [{ idColis: 11 }, { idColis: 12 }, { idColis: 15 }],
      },
      lotExpedition: {
        referenceLot: 'LOT-2026-007',
        agence: { nomAgence: 'Congo Airways Cargo' },
      },
      ...extra,
    }) as unknown as Parameters<typeof etiquette>[0];

  it('abrège le client et masque son téléphone', () => {
    const e = etiquette(colis());
    expect(e.client).toBe('Marie K.');
    expect(e.telephone).toBe('•••• 4521');
  });

  it('donne le rang du colis dans sa commande, le poids, le lot', () => {
    const e = etiquette(colis());
    expect(e.rang).toBe('2 / 3');
    expect(e.poids).toBe('1,250 kg');
    expect(e.lot).toBe('LOT-2026-007');
    expect(e.transport).toBe('Congo Airways Cargo');
    expect(e.code).toBe(codeColis(12));
  });

  it('ne contient jamais le code de retrait', () => {
    const e = etiquette(
      colis({
        commande: {
          numeroCommande: 'KD-2026-000042',
          codeRetrait: 'SECRET9',
          client: { nom: 'Kabila', prenom: 'Marie', telephone: null },
          colis: [{ idColis: 12 }],
        },
      }),
    );
    expect(JSON.stringify(e)).not.toContain('SECRET9');
    expect(e.telephone).toBeNull();
  });

  it('colis pas encore pesé ni mis dans un lot', () => {
    const e = etiquette(colis({ poidsReelKg: null, lotExpedition: null }));
    expect(e.poids).toBeNull();
    expect(e.lot).toBeNull();
  });
});
