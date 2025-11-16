-- 1. Crea la tabella "profiles"
CREATE TABLE public.profiles (
                                 id UUID NOT NULL PRIMARY KEY,
                                 updated_at TIMESTAMPTZ,
                                 nome TEXT,
                                 sesso TEXT,
                                 data_di_nascita DATE,
                                 tipo_misuratore TEXT DEFAULT 'automatico',
                                 farmaci_pressione BOOLEAN DEFAULT FALSE,
                                 farmaci_cuore BOOLEAN DEFAULT FALSE,
                                 anticoagulanti BOOLEAN DEFAULT FALSE,

    -- Collega l'ID di questa tabella all'ID utente in auth.users
                                 CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
                                     REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 2. Attiva la Row Level Security (RLS) sulla tabella
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crea la policy di sicurezza (FONDAMENTALE)
-- Gli utenti possono vedere e aggiornare SOLO IL LORO profilo.
CREATE POLICY "Utenti possono gestire il loro profilo."
  ON public.profiles
  FOR ALL -- (SELECT, UPDATE, INSERT)
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. (Opzionale) Funzione per creare un profilo vuoto quando un utente si registra
-- Questa è una best practice
CREATE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
BEGIN
INSERT INTO public.profiles (id)
VALUES (new.id);
RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. (Opzionale) Trigger che chiama la funzione dopo una nuova registrazione
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
