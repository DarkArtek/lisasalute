-- Popolamento iniziale della tabella drug_catalog
INSERT INTO public.drug_catalog (nome_commerciale, principio_attivo, categoria, classe_terapeutica)
VALUES
    -- ANTIPERTENSIVI
    ('Triatec', 'Ramipril', 'ACE-Inibitore', 'Antipertensivo'),
    ('Reaptane', 'Perindopril', 'ACE-Inibitore', 'Antipertensivo'),
    ('Norvasc', 'Amlodipina', 'Calcio-Antagonista', 'Antipertensivo'),
    ('Cardura', 'Doxazosin', 'Alfa-Bloccante', 'Antipertensivo'),
    ('Lortaan', 'Losartan', 'Sartano', 'Antipertensivo'),
    ('Tareg', 'Valsartan', 'Sartano', 'Antipertensivo'),
    ('Lasix', 'Furosemide', 'Diuretico', 'Antipertensivo'),

    -- CARDIOLOGICI
    ('Sequacor', 'Bisoprololo', 'Beta-Bloccante', 'Antiaritmico'),
    ('Lobivon', 'Nebivololo', 'Beta-Bloccante', 'Antiaritmico'),
    ('Tenormin', 'Atenololo', 'Beta-Bloccante', 'Antiaritmico'),
    ('Cardioaspirin', 'Acido Acetilsalicilico', 'Antiaggregante', 'Anticoagulante'),
    ('Coumadin', 'Warfarin', 'Anticoagulante', 'Anticoagulante'),
    ('Xarelto', 'Rivaroxaban', 'NAO', 'Anticoagulante'),
    ('Cordarone', 'Amiodarone', 'Antiaritmico', 'Antiaritmico'),
    ('Lansox', 'Lansoprazolo', 'Gastroprotettore', 'Altro'),

    -- DIABETOLOGICI
    ('Metforal', 'Metformina', 'Biguanide', 'Antidiabetico'),
    ('Glucophage', 'Metformina', 'Biguanide', 'Antidiabetico'),
    ('Lantus', 'Insulina Glargine', 'Insulina Basale', 'Antidiabetico'),
    ('Novorapid', 'Insulina Aspart', 'Insulina Rapida', 'Antidiabetico'),
    ('Jardiance', 'Empagliflozin', 'SGLT2-Inibitore', 'Antidiabetico');