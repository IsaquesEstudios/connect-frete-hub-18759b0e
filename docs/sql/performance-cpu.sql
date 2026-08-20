-- ============================================================================
-- SV Logística — Otimização de CPU do banco (rodar UMA VEZ no banco externo)
-- ----------------------------------------------------------------------------
-- Resolve os três apontamentos do Advisor:
--   1) Chaves estrangeiras sem índice
--   2) auth.uid() reavaliado linha a linha nas políticas RLS
--   3) Múltiplas políticas permissivas para a mesma ação/role
--
-- O script é idempotente: pode ser executado inteiro, mais de uma vez.
-- As permissões finais continuam EXATAMENTE as mesmas — muda só o custo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Índices nas chaves estrangeiras sinalizadas pelo Advisor
-- ----------------------------------------------------------------------------
-- Obs.: se preferir zero bloqueio de escrita, rode cada CREATE INDEX abaixo
-- fora de transação trocando por:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS <nome> ON ...;

CREATE INDEX IF NOT EXISTS broadcast_messages_tag_id_idx
  ON public.broadcast_messages (tag_id);

CREATE INDEX IF NOT EXISTS conversation_tags_tag_id_idx
  ON public.conversation_tags (tag_id);

CREATE INDEX IF NOT EXISTS messages_from_user_id_idx
  ON public.messages (from_user_id);

CREATE INDEX IF NOT EXISTS messages_to_user_id_idx
  ON public.messages (to_user_id);


-- ----------------------------------------------------------------------------
-- 2. Índices de apoio para as telas mais pesadas
-- ----------------------------------------------------------------------------

-- Filtro de etiquetas por conversa (painel admin)
CREATE INDEX IF NOT EXISTS conversation_tags_conversation_idx
  ON public.conversation_tags (conversation_id);

-- Tabela de usuários e métricas
CREATE INDEX IF NOT EXISTS profiles_type_idx
  ON public.profiles (type);

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx
  ON public.profiles (last_seen_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS profiles_created_at_idx
  ON public.profiles (created_at DESC);

-- Histórico de envios em massa (hoje dá timeout)
CREATE INDEX IF NOT EXISTS broadcast_messages_sent_at_idx
  ON public.broadcast_messages (sent_at DESC);

-- Não lidas por destinatário (badge de mensagens)
CREATE INDEX IF NOT EXISTS messages_unread_admin_idx
  ON public.messages (to_user_id, created_at DESC)
  WHERE read_by_admin = false;

CREATE INDEX IF NOT EXISTS messages_unread_user_idx
  ON public.messages (to_user_id, created_at DESC)
  WHERE read_by_user = false;


-- ============================================================================
-- 3 + 4. RLS: (select auth.uid()) + política única por ação/role
-- ----------------------------------------------------------------------------
-- private.is_staff(...) já é SECURITY DEFINER e STABLE; ao envolvê-la em um
-- subselect o planejador a executa uma vez por consulta (InitPlan) em vez de
-- uma vez por linha. Mesmo raciocínio para auth.uid().
-- ============================================================================

-- ------------------------------ profiles ------------------------------------
DROP POLICY IF EXISTS profiles_select_access ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_access ON public.profiles;
DROP POLICY IF EXISTS profiles_update_access ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_access ON public.profiles;

CREATE POLICY profiles_select_access ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR type = ANY (ARRAY['admin'::user_type, 'colaborador'::user_type])
    OR (select private.is_staff((select auth.uid())))
  );

CREATE POLICY profiles_insert_access ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  );

CREATE POLICY profiles_update_access ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  )
  WITH CHECK (
    id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  );

CREATE POLICY profiles_delete_access ON public.profiles
  FOR DELETE TO authenticated
  USING ((select private.is_staff((select auth.uid()))));


-- ------------------------------ messages ------------------------------------
DROP POLICY IF EXISTS messages_select_access ON public.messages;
DROP POLICY IF EXISTS messages_insert_access ON public.messages;
DROP POLICY IF EXISTS messages_update_access ON public.messages;
DROP POLICY IF EXISTS messages_delete_access ON public.messages;

CREATE POLICY messages_select_access ON public.messages
  FOR SELECT TO authenticated
  USING (
    from_user_id = (select auth.uid())
    OR to_user_id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  );

CREATE POLICY messages_insert_access ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  );

CREATE POLICY messages_update_access ON public.messages
  FOR UPDATE TO authenticated
  USING (
    from_user_id = (select auth.uid())
    OR to_user_id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  )
  WITH CHECK (
    from_user_id = (select auth.uid())
    OR to_user_id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  );

CREATE POLICY messages_delete_access ON public.messages
  FOR DELETE TO authenticated
  USING (
    from_user_id = (select auth.uid())
    OR to_user_id = (select auth.uid())
    OR (select private.is_staff((select auth.uid())))
  );


-- -------------------------------- tags --------------------------------------
-- Antes: tags_select_access (SELECT, using true) + tags_staff_manage (ALL)
-- => duas políticas permissivas avaliadas em todo SELECT. Agora: uma por ação.
DROP POLICY IF EXISTS tags_select_access ON public.tags;
DROP POLICY IF EXISTS tags_staff_manage ON public.tags;

CREATE POLICY tags_select_access ON public.tags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY tags_insert_staff ON public.tags
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_staff((select auth.uid()))));

CREATE POLICY tags_update_staff ON public.tags
  FOR UPDATE TO authenticated
  USING ((select private.is_staff((select auth.uid()))))
  WITH CHECK ((select private.is_staff((select auth.uid()))));

CREATE POLICY tags_delete_staff ON public.tags
  FOR DELETE TO authenticated
  USING ((select private.is_staff((select auth.uid()))));


-- --------------------------- conversation_tags ------------------------------
DROP POLICY IF EXISTS conversation_tags_staff_manage ON public.conversation_tags;
DROP POLICY IF EXISTS conversation_tags_select_staff ON public.conversation_tags;
DROP POLICY IF EXISTS conversation_tags_insert_staff ON public.conversation_tags;
DROP POLICY IF EXISTS conversation_tags_update_staff ON public.conversation_tags;
DROP POLICY IF EXISTS conversation_tags_delete_staff ON public.conversation_tags;

CREATE POLICY conversation_tags_select_staff ON public.conversation_tags
  FOR SELECT TO authenticated
  USING ((select private.is_staff((select auth.uid()))));

CREATE POLICY conversation_tags_insert_staff ON public.conversation_tags
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_staff((select auth.uid()))));

CREATE POLICY conversation_tags_update_staff ON public.conversation_tags
  FOR UPDATE TO authenticated
  USING ((select private.is_staff((select auth.uid()))))
  WITH CHECK ((select private.is_staff((select auth.uid()))));

CREATE POLICY conversation_tags_delete_staff ON public.conversation_tags
  FOR DELETE TO authenticated
  USING ((select private.is_staff((select auth.uid()))));


-- --------------------------- broadcast_messages -----------------------------
DROP POLICY IF EXISTS broadcast_messages_staff_manage ON public.broadcast_messages;
DROP POLICY IF EXISTS broadcast_messages_select_staff ON public.broadcast_messages;
DROP POLICY IF EXISTS broadcast_messages_insert_staff ON public.broadcast_messages;
DROP POLICY IF EXISTS broadcast_messages_update_staff ON public.broadcast_messages;
DROP POLICY IF EXISTS broadcast_messages_delete_staff ON public.broadcast_messages;

CREATE POLICY broadcast_messages_select_staff ON public.broadcast_messages
  FOR SELECT TO authenticated
  USING ((select private.is_staff((select auth.uid()))));

CREATE POLICY broadcast_messages_insert_staff ON public.broadcast_messages
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_staff((select auth.uid()))));

CREATE POLICY broadcast_messages_update_staff ON public.broadcast_messages
  FOR UPDATE TO authenticated
  USING ((select private.is_staff((select auth.uid()))))
  WITH CHECK ((select private.is_staff((select auth.uid()))));

CREATE POLICY broadcast_messages_delete_staff ON public.broadcast_messages
  FOR DELETE TO authenticated
  USING ((select private.is_staff((select auth.uid()))));


-- ----------------------------------------------------------------------------
-- 5. Fechamento: atualizar estatísticas do planejador
-- ----------------------------------------------------------------------------
ANALYZE public.profiles;
ANALYZE public.messages;
ANALYZE public.tags;
ANALYZE public.conversation_tags;
ANALYZE public.broadcast_messages;


-- ============================================================================
-- VERIFICAÇÃO (rodar separadamente, antes e depois, para comparar)
-- ============================================================================
-- Consultas mais caras:
--
-- SELECT calls,
--        round(total_exec_time::numeric, 2)  AS total_ms,
--        round(mean_exec_time::numeric, 2)   AS media_ms,
--        rows,
--        left(query, 200)                    AS consulta
-- FROM pg_stat_statements
-- ORDER BY total_exec_time DESC
-- LIMIT 15;
--
-- Zerar o acumulado para medir só o período pós-otimização:
-- SELECT pg_stat_statements_reset();
--
-- Conferir que sobrou UMA política permissiva por ação/role:
-- SELECT tablename, cmd, count(*)
-- FROM pg_policies
-- WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
-- GROUP BY 1, 2
-- HAVING count(*) > 1
-- ORDER BY 1, 2;
-- ============================================================================
