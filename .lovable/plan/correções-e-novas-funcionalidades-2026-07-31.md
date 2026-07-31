# Correções e novas funcionalidades

Agrupei os pedidos em 4 blocos. O bloco 1 é o mais crítico (conversas misturadas).

## 1. Chat: privacidade, entrega e leitura

**Conversas misturadas (crítico).** Hoje o painel de staff agrupa deliberadamente as conversas: quando um usuário fala com o admin, o sistema junta as mensagens de *todos* os admins/colaboradores numa mesma thread. Por isso "FETR x SV" aparece misturado com o admin.

Correção: cada conversa passa a ser estritamente o par (pessoa A, pessoa B). Removo o agrupamento por "caixa de staff":
- `conversationLookupIds` e `staffInboxConversationIds` deixam de expandir para outros staff — a thread só lê o próprio `conversation_id` do par.
- A lista lateral do painel de staff passa a listar uma linha por par real, não por usuário.
- Leitura/exclusão/contagem passam a usar o mesmo par.

**Bolinha verde com contador.** Restaurar o badge de não lidas por conversa na lista lateral (staff e usuário), alimentado pelo contador por par.

**"Visualizado" antes de ler.** Hoje a conversa é marcada como lida ao ser montada/selecionada. Passa a marcar como lida só quando a janela está em foco e a conversa está aberta e visível (com pequeno atraso), não ao apenas carregar a lista.

**Demora na entrega.** Reduzir a latência: enviar pelo canal direto e aplicar a mensagem recebida via Realtime imediatamente na thread aberta (sem esperar o próximo ciclo de sincronização), com refetch de segurança curto.

## 2. Colaboradores

- Ao criar colaborador: escolher CPF ou CNPJ, com máscara e validação, salvo no perfil.
- Bloquear/desbloquear: um único aviso (toast com id fixo, sem duplicar) e bloqueio do botão por 10 segundos após a ação.

## 3. Usuários / filtros / exportação

- Filtro de etiquetas na página de Usuários passa a ler a lista completa de etiquetas do banco (hoje só enxerga as usadas no cache carregado), incluindo etiquetas novas.
- Exportar (CSV / Excel / Word) passa a exportar exatamente as linhas visíveis: filtros ativos + ordenação atual.

## 4. Perfil, site e nova página

- **Peso do motorista**: rótulo vira "Peso suportado (em kg)" nos formulários, perfil, edição do admin e relatórios.
- **Rodapé do site**: bloco de redes sociais na landing page (links configuráveis nas Configurações do admin).
- **Cargas na página inicial**: seção com os três links externos — Cargas ativas, Cargas inativas e Buscar fretes (freteemtemporeal.com.br).
- **Nova página "Disponibilidade"**: lista pública/interna com dois tipos de registro que o admin cadastra, edita e remove:
  - *Motorista disponível*: várias origens (cidade/UF) + destino em texto livre.
  - *Frete disponível*: rota (UF x UF), peso, tipo de carroceria, eixos e observações.
  - Publicação com data, status ativo/inativo e ordenação por mais recente.

## Detalhes técnicos

- Banco: nova tabela `disponibilidades` (tipo, payload dos campos, ativo, created_at) com RLS — leitura para autenticados, escrita apenas para staff; GRANTs incluídos.
- Links de redes sociais reaproveitam `app_settings` (mesmo mecanismo dos links de WhatsApp).
- A mudança de identidade de conversa não altera dados existentes: as linhas de `messages` já guardam o par correto em `conversation_id`; apenas a leitura deixa de agregar.
