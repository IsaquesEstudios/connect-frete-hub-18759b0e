# ConnectHub Admin

Crie um aplicativo de mensagens em tempo real chamado "ConectaFrete" com arquitetura de 3 tipos de usuários: EMPRESA, MOTORISTA e ADMIN.

## REGRAS DE NEGÓCIO PRINCIPAIS

1. Empresas e Motoristas NUNCA se comunicam diretamente entre si.

2. Toda comunicação passa obrigatoriamente pelo ADMIN (modelo hub-and-spoke).

3. Cada usuário é identificado por um "número de usuário" único (ex: EMP-0001, MOT-0001), que serve como login/identificador de acesso e canal de chat.

4. O ADMIN visualiza todas as conversas e atua como intermediário manual entre empresas e motoristas.

## AUTENTICAÇÃO

- Login simples usando "Número de Usuário" + senha (por enquanto pode ser mock/fake, sem backend real de auth).

- Cadastro (fake) definindo tipo de usuário: Empresa, Motorista ou Admin.

- Ao logar, redirecionar para o painel correspondente ao tipo de usuário.

## TELAS E FUNCIONALIDADES

### 1. Painel da Empresa

- Lista de conversas (sempre com o Admin, nunca com motoristas).

- Chat em tempo real com o Admin (mock de tempo real, usando estado local/simulação de socket por enquanto).

- Histórico de mensagens.

- Indicador de status (online/offline do admin), "digitando...", horário das mensagens.

- Perfil da empresa (nome, número de usuário, dados fake).

### 2. Painel do Motorista

- Mesma estrutura do painel da empresa: chat único com o Admin.

- Perfil do motorista (nome, número de usuário, veículo, dados fake).

### 3. Painel do Admin (o mais completo)

- **Lista de todos os chats** (empresas e motoristas), separados em abas ou filtros: "Empresas" / "Motoristas" / "Todos".

- Ao abrir um chat, o admin conversa diretamente com aquele usuário específico.

- **Sistema de Tags por conversa:**

  - Admin pode adicionar/remover tags em cada chat (ex: "Urgente", "SP", "Frota Própria", "Novo Cliente", "VIP", "Problema").

  - Tags com cores customizáveis.

  - Filtro de conversas por uma ou mais tags.

  - Combinação de filtros: tipo de usuário (empresa/motorista) + tags.

- **Envio de Mensagens em Massa (Broadcast):**

  - Botão "Nova Mensagem em Massa".

  - Opções de destinatário:

    - Todos os usuários

    - Somente Empresas

    - Somente Motoristas

    - Grupo filtrado por tag específica (ex: todos com tag "SP")

  - Campo de mensagem + preview de quantos usuários receberão.

  - Histórico de mensagens em massa enviadas.

- Dashboard resumido: total de empresas, total de motoristas, conversas ativas, mensagens não lidas.

## DADOS FAKE (MOCK)

Como o backend real será um banco externo, use dados fake/mock por enquanto para simular:

- 5 empresas fake (nome, número de usuário tipo EMP-0001 a EMP-0005, CNPJ fake)

- 5 motoristas fake (nome, número de usuário tipo MOT-0001 a MOT-0005, placa do veículo fake)

- 1 admin (ADM-0001)

- Histórico de mensagens fake entre cada empresa/motorista e o admin

- 5 a 6 tags fake pré-cadastradas com cores diferentes

- Algumas conversas já com tags aplicadas

## BANCO DE DADOS

Utilize Supabase como estrutura de dados por enquanto (tabelas: users, messages, tags, conversation_tags, broadcast_messages), mesmo sabendo que futuramente será substituído por um banco externo. Estruture o código de forma desacoplada (camada de serviço/repository) para facilitar a troca de fonte de dados no futuro sem reescrever toda a lógica de UI.

## TEMPO REAL

- Simule/implemente atualização em tempo real das mensagens (via Supabase Realtime ou polling), com novas mensagens aparecendo automaticamente sem precisar recarregar a página.

## DESIGN

- Interface limpa, estilo app de mensagens moderno (referência: WhatsApp Web / Telegram Web).

- Sidebar de conversas à esquerda, chat ativo à direita.

- Cores diferenciadas para identificar tipo de usuário (ex: azul para empresas, verde para motoristas) na lista de conversas do admin.

- Tags exibidas como badges coloridos ao lado do nome da conversa.

- Responsivo (funcionar bem em mobile também).

Comece implementando a estrutura de autenticação, os 3 painéis principais e o mock de dados. Depois adicione o sistema de tags e por último o broadcast de mensagens em massa.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://connect-frete-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/665e8163-8821-4fca-a03b-cc57d00c5b88).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
