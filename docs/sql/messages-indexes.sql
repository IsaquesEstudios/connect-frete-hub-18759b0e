-- Rodar UMA VEZ no banco externo (blyx) para eliminar o timeout 57014
-- na listagem de mensagens. Cria índices que a tabela public.messages
-- precisa para responder rápido nas queries por remetente/destinatário
-- e no ordenamento por data.

CREATE INDEX IF NOT EXISTS messages_from_user_created_idx
  ON public.messages (from_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_to_user_created_idx
  ON public.messages (to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_created_at_idx
  ON public.messages (created_at DESC);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at DESC);

ANALYZE public.messages;
