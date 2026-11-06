import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { avecEssais, estConflit } from './transaction.js';

// Les deux formes sous lesquelles un conflit de transaction sérialisable peut arriver
const conflitPrisma = () =>
  new Prisma.PrismaClientKnownRequestError('conflit', {
    code: 'P2034',
    clientVersion: 'essai',
  });
const conflitBrut = () =>
  Object.assign(new Error('conflit'), { cause: { originalCode: '40001' } });

describe('transactions', () => {
  it('reconnaît un conflit, sous ses deux formes', () => {
    expect(estConflit(conflitPrisma())).toBe(true);
    expect(estConflit(conflitBrut())).toBe(true);
    expect(estConflit(new Error('autre'))).toBe(false);
    expect(
      estConflit(
        new Prisma.PrismaClientKnownRequestError('doublon', {
          code: 'P2002',
          clientVersion: 'essai',
        }),
      ),
    ).toBe(false);
  });

  it('relance après un conflit, et réussit', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(conflitPrisma())
      .mockRejectedValueOnce(conflitBrut())
      .mockResolvedValue('payé');
    await expect(avecEssais(action, 'conflit')).resolves.toBe('payé');
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('après 3 conflits de suite : 409 avec le message donné', async () => {
    const action = vi.fn().mockRejectedValue(conflitPrisma());
    await expect(avecEssais(action, 'Réessayez')).rejects.toThrow(
      ConflictException,
    );
    await expect(avecEssais(action, 'Réessayez')).rejects.toThrow('Réessayez');
    expect(action).toHaveBeenCalledTimes(6); // 3 essais par appel
  });

  it('ne relance jamais une autre erreur', async () => {
    const action = vi.fn().mockRejectedValue(new Error('Solde insuffisant'));
    await expect(avecEssais(action, 'conflit')).rejects.toThrow(
      'Solde insuffisant',
    );
    expect(action).toHaveBeenCalledTimes(1);
  });
});
