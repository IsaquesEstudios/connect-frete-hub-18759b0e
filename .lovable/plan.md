## Problema

Toda navegação/retorno à aba dispara `SupabaseRepository.bootstrap()`, que baixa **usuários, tags, tags de conversa, mensagens e broadcasts** antes de renderizar qualquer tela. Como `_app` usa `ssr: false` e o gate espera `repo.isBootstrapped()`, o usuário vê o loading fullscreen a cada visita.

O TanStack Query já está configurado no projeto (`QueryClientProvider` no root, `queryClient` no contexto do router), mas o repo em memória não é integrado a ele — nada é cacheado entre navegações.

## Objetivo

Tornar a navegação instantânea usando cache do TanStack Query, mantendo o chat sempre atualizado via realtime (comportamento atual preservado).

## Estratégia

Envolver as leituras do repositório em queries do TanStack Query com `staleTime` alto para dados frios (usuários, tags, broadcasts, links da landing) e `staleTime: 0` para o chat (mensagens/presença), sem reescrever o repositório.

### 1. Bootstrap incremental (mudança pequena e cirúrgica em `supabaseRepository.ts`)

- Separar `bootstrap()` em `bootstrapCore()` (só sessão + realtime, muito rápido) e loaders individuais idempotentes (`ensureUsers`, `ensureTags`, `ensureConvTags`, `ensureMessages`, `ensureBroadcasts`) que retornam promessas cacheadas — se já carregou, resolvem imediatamente.
- `isBootstrapped()` passa a refletir apenas o core (sessão + realtime pronto), não os dados. Assim `_app/route.tsx` não trava mais na tela cheia esperando datasets.
- Manter `subscribe()` intacto para realtime continuar invalidando.

### 2. Camada de queries (novo arquivo `src/lib/data/queries.ts`)

Expor `queryOptions` para cada dataset, chamando os `ensure*` do repo:

```
usersQuery       -> staleTime 5min, gcTime 30min
tagsQuery        -> staleTime 5min
convTagsQuery    -> staleTime 5min
broadcastsQuery  -> staleTime 5min
appSettingsQuery -> staleTime 10min (landing)
messagesQuery(conversationId) -> staleTime 0 (chat sempre fresco)
```

Um pequeno hook `useRepoInvalidator()` assina `repo.subscribe()` uma vez no root e chama `queryClient.invalidateQueries()` nos keys afetados quando o realtime dispara — mantendo o fluxo atual de atualização automática, mas agora o React Query decide o refetch e serve cache instantâneo enquanto isso.

### 3. Consumo nas telas (mínimo invasivo)

- `_app/route.tsx`: remover o gate de `repo.isBootstrapped()` para dados; manter só o gate de auth. A UI aparece imediatamente com dados cacheados; loaders locais (skeleton) cobrem o primeiro fetch.
- `UserChatPanel`, `admin.tsx`, `usuarios.tsx`, `metricas.tsx`, landing: trocar `useRepoVersion()` por `useSuspenseQuery(usersQuery)` / `useQuery(...)` conforme o dado.
- `ChatWindow` continua usando `useRepoVersion` + realtime (mensagens são realtime puro, cache não ajuda aqui — mas o histórico inicial da conversa passa por `messagesQuery` para reidratar entre navegações).

### 4. Cache entre sessões (opcional, ligado por padrão)

Adicionar `persistQueryClient` do `@tanstack/react-query-persist-client` com `localStorage` (chave versionada com `APP_VERSION` do cache-buster existente). Assim, ao voltar depois de horas, a UI aparece com o snapshot anterior enquanto revalida em background — comportamento tipo WhatsApp Web.

## Fora de escopo

- Não altero a lógica de envio de mensagem, realtime, RLS, nem o `AdminEditUserDialog`.
- Não mudo endpoints server-side nem o schema do banco.
- Não mexo em `client.ts` (auto-gerado).

## Arquivos afetados

- `src/lib/data/supabaseRepository.ts` (refactor bootstrap → ensure\*)
- `src/lib/data/queries.ts` (novo)
- `src/lib/hooks/useRepo.ts` (adiciona `useRepoInvalidator`)
- `src/routes/__root.tsx` (montar invalidator + persister)
- `src/routes/_app/route.tsx` (remover gate de dados)
- `src/components/chat/UserChatPanel.tsx`, `src/routes/_app/admin.tsx`, `usuarios.tsx`, `metricas.tsx`, `src/routes/index.tsx` (trocar `useRepoVersion` por queries onde faz sentido)
- `package.json`: adicionar `@tanstack/react-query-persist-client` se aprovar a etapa 4

## Resultado esperado

- Primeira visita: igual à atual.
- Navegação entre telas: **instantânea** (cache).
- Voltar à aba depois de minutos: UI aparece na hora, com revalidação silenciosa.
- Chat: mensagens continuam chegando em tempo real (sem regressão).
