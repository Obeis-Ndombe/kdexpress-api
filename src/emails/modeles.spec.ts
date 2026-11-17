import { ORDRE_ETAPE } from '../commandes/etapes.js';
import {
  emailCodeReinitialisation,
  emailEtape,
  type CommandeNotifiee,
} from './modeles.js';

const COMMANDE: CommandeNotifiee = {
  numeroCommande: 'KD-2026-000042',
  prenom: 'Marie',
  email: 'marie@exemple.cd',
  aPayerALaCommandeUsd: '211.58',
  resteAuRetraitUsd: '10.00',
  commentaire: null,
};

describe('modèles d’e-mails', () => {
  it('le code de réinitialisation : code, durée, mise en garde', () => {
    const e = emailCodeReinitialisation(
      'marie@exemple.cd',
      'Marie',
      '048213',
      15,
    );
    expect(e.a).toBe('marie@exemple.cd');
    expect(e.texte).toContain('048213');
    expect(e.texte).toContain('15 minutes');
    expect(e.texte).toContain('Ne donnez ce code à personne');
  });

  it('commande enregistrée : le montant à payer', () => {
    const e = emailEtape(ORDRE_ETAPE.EN_ATTENTE_PAIEMENT, COMMANDE)!;
    expect(e.sujet).toBe('Commande KD-2026-000042 enregistrée');
    expect(e.texte).toContain('Bonjour Marie');
    expect(e.texte).toContain('211.58 $');
  });

  it('prête au retrait : le reste à payer, sans jamais le code de retrait', () => {
    const e = emailEtape(ORDRE_ETAPE.PRETE_AU_RETRAIT, COMMANDE)!;
    expect(e.texte).toContain('10.00 $');
    expect(e.texte).toContain('code de retrait, visible dans le détail');
  });

  it('annulée : le motif quand il y en a un', () => {
    const e = emailEtape(ORDRE_ETAPE.ANNULEE, {
      ...COMMANDE,
      commentaire: 'Article introuvable',
    })!;
    expect(e.texte).toContain('Motif : Article introuvable');
    expect(emailEtape(ORDRE_ETAPE.ANNULEE, COMMANDE)!.texte).not.toContain(
      'Motif',
    );
  });

  it('les étapes internes ne préviennent pas le client', () => {
    for (const ordre of [
      ORDRE_ETAPE.ACHAT_EN_COURS,
      ORDRE_ETAPE.ACHETEE,
      ORDRE_ETAPE.ARRIVEE_KINSHASA,
    ]) {
      expect(emailEtape(ordre, COMMANDE)).toBeNull();
    }
  });

  it('les six étapes annoncées ont chacune leur e-mail', () => {
    for (const ordre of [
      ORDRE_ETAPE.EN_ATTENTE_PAIEMENT,
      ORDRE_ETAPE.PAYEE,
      ORDRE_ETAPE.EXPEDIEE,
      ORDRE_ETAPE.PRETE_AU_RETRAIT,
      ORDRE_ETAPE.RECUPEREE,
      ORDRE_ETAPE.ANNULEE,
    ]) {
      expect(emailEtape(ordre, COMMANDE)?.sujet).toContain('KD-2026-000042');
    }
  });
});
