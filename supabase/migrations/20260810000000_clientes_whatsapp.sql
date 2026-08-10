-- Campo WhatsApp no cadastro do cliente
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS whatsapp TEXT;

NOTIFY pgrst, 'reload schema';
