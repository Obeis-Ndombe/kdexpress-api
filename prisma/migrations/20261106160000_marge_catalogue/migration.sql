-- Marge appliquée au prix boutique pour calculer le prix client proposé
-- (la direction peut toujours corriger le prix avant de publier)
INSERT INTO parametre (code_parametre, valeur_parametre, libelle_parametre) VALUES
    ('marge_catalogue_pourcentage', '20', 'Marge ajoutée au prix boutique pour proposer le prix client, en %')
ON CONFLICT (code_parametre) DO NOTHING;
