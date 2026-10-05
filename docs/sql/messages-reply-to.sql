-- Responder a uma mensagem específica (estilo WhatsApp).
-- Rodar no banco externo (blyx) via SQL Editor.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.messages (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_body text,
  ADD COLUMN IF NOT EXISTS reply_from text;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages (reply_to);

COMMENT ON COLUMN public.messages.reply_to IS 'ID da mensagem citada (resposta).';
COMMENT ON COLUMN public.messages.reply_body IS 'Snapshot do texto citado (sobrevive à exclusão da original).';
COMMENT ON COLUMN public.messages.reply_from IS 'Snapshot do nome do autor da mensagem citada.';
