# ECG (Elite Training Gym) — Guide de Implementação MVP

## 1. Objetivo do MVP

Este documento define o MVP de uma solução cross-platform (iOS/Android) para academia com um único aplicativo React Native (com experiência por perfil Personal e Aluno via tipo de conta no login) e um backend em FastAPI no monorepo.

O objetivo do MVP é validar o ciclo principal de treino:

1. O personal cadastra e organiza treinos para seus alunos.
2. O aluno executa o treino ativo na academia e registra suas séries.

## 2. Arquitetura do Monorepo

Estrutura inicial recomendada:

- apps/mobile: aplicativo React Native único (fluxos de personal e aluno).
- apps/api: backend FastAPI.
- packages/types: contratos e tipos compartilhados (DTOs e enums).
- packages/ui: componentes de UI reutilizáveis (quando aplicável).
- packages/config: configurações compartilhadas (lint, tsconfig, etc.).
- docs: documentação adicional.

Stack recomendada para MVP:

- Mobile: React Native com Expo.
- Backend: FastAPI + SQLAlchemy + Alembic.
- Banco: PostgreSQL.
- Auth: JWT (access + refresh).
- Monorepo: pnpm workspaces + Turborepo (build, lint, type-check e cache).

## 3. Escopo funcional do MVP (app único)

### 3.1 Fluxo Personal no app

Funcionalidades mínimas:

1. Login.
2. Visualizar lista de alunos associados.
3. Abrir ficha técnica do aluno com: nome, idade, peso e altura.
4. Criar conjunto de treino para o aluno.
5. Definir conjunto de treino ativo do aluno.
6. Criar e editar treinos do conjunto (A/B/C/D/E).
7. Criar e editar exercícios de cada treino com parâmetros técnicos.
8. Visualizar estrutura completa montada para conferência.

### 3.2 Fluxo Aluno no app

Funcionalidades mínimas:

1. Login.
2. Visualizar conjunto de treino atualmente ativo (definido pelo personal).
3. Iniciar um treino do conjunto (por exemplo, treino A).
4. Marcar progresso dos exercícios durante a sessão.
5. Registrar por série: peso utilizado e repetições realizadas.
6. Se estiver offline, continuar registrando a sessão e sincronizar automaticamente ao recuperar conexão.

## 4. Modelo de domínio (MVP)

Entidades principais:

1. Usuario

- id
- nome
- email
- senha_hash
- role: PERSONAL | ALUNO
- ativo

2. Personal

- id
- usuario_id

3. Aluno

- id
- usuario_id
- idade
- peso
- altura

4. VinculoPersonalAluno (histórico de vínculo)

- id
- aluno_id
- personal_id
- inicio_em
- fim_em (nulo enquanto vínculo ativo)
- ativo

5. ConjuntoTreino

- id
- aluno_id
- nome (ex.: “Ciclo Hipertrofia 1”)
- ativo (somente um ativo por aluno no MVP)
- data_inicio
- data_fim

6. Treino

- id
- conjunto_treino_id
- codigo (A, B, C, D, E)
- nome
- ordem

7. ExercicioTreino

- id
- treino_id
- nome_exercicio
- ordem
- prescricao (texto opcional)
- repeticao_ou_tempo (texto, ex.: “12 reps” ou “45s”)
- rer_rm_valor (numérico ou percentual em texto: “2”, “30%”)
- descanso_segundos
- tecnica: enum {PADRAO, ISOMETRIA, INSTABILIDADE}
- observacoes (texto simples)

8. ExercicioBase (biblioteca inicial)

- id
- nome
- grupo_muscular
- implemento_execucao: enum {BARRA, ELASTICO, HALTERE, KETTLEBELL, CABO, MAQUINA, PESO_CORPO, OUTRO}
- pode_ser_feito_em_casa (boolean)
- ativo
- criado_por_sistema

9. SessaoTreino

- id
- aluno_id
- treino_id
- iniciado_em
- finalizado_em
- status: EM_ANDAMENTO | FINALIZADO

10. SerieExecutada

- id
- sessao_treino_id
- exercicio_treino_id
- numero_serie
- peso_utilizado
- repeticoes_realizadas
- concluida

Regras mínimas:

1. Cada aluno deve ter exatamente 1 personal ativo por vez.
2. Um aluno pode trocar de personal ao longo do tempo, mantendo histórico de vínculos.
3. Um aluno possui no máximo um conjunto de treino ativo.
4. Um treino pertence a exatamente um conjunto.
5. A ordem de treinos e exercícios deve ser persistida.
6. O aluno só pode iniciar treino pertencente ao seu conjunto ativo.
7. Restrição técnica de banco: deve existir no máximo 1 registro ativo (fim_em nulo) em VinculoPersonalAluno por aluno_id.

## 5. Fluxos principais

### 5.1 Fluxo Personal

1. Personal autentica.
2. Backend retorna alunos associados.
3. Personal seleciona aluno e consulta ficha técnica.
4. Personal cria um novo conjunto de treino para o aluno.
5. Personal cadastra/edita treinos do conjunto (A-E).
6. Personal cadastra/edita exercícios de cada treino com prescrição.
7. Personal define o conjunto como ativo.
8. Personal revisa estrutura final do plano de treino.

### 5.2 Fluxo Aluno

1. Aluno autentica.
2. Backend retorna conjunto ativo.
3. Aluno escolhe treino (ex.: A) e inicia sessão.
4. Para cada exercício, aluno registra séries (peso + repetições).
5. Aluno finaliza sessão.

## 6. API FastAPI inicial (MVP)

Base path: /api/v1

Auth:

- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

Admin (header X-Admin-Key):

- GET /admin/personais
- POST /admin/personais
- PATCH /admin/personais/{personal_id}
- DELETE /admin/personais/{personal_id}
- GET /admin/alunos
- POST /admin/alunos
- PATCH /admin/alunos/{aluno_id}
- DELETE /admin/alunos/{aluno_id}

Personal:

- GET /personal/alunos
- GET /personal/alunos/{aluno_id}
- POST /personal/alunos/{aluno_id}/conjuntos
- GET /personal/alunos/{aluno_id}/conjuntos
- PATCH /personal/alunos/{aluno_id}/conjuntos/{conjunto_id}/ativar
- POST /personal/conjuntos/{conjunto_id}/treinos
- GET /personal/conjuntos/{conjunto_id}/treinos
- PATCH /personal/treinos/{treino_id}
- POST /personal/treinos/{treino_id}/exercicios
- GET /personal/treinos/{treino_id}/exercicios
- PATCH /personal/exercicios/{exercicio_id}
- GET /catalogo/exercicios-base

Aluno:

- GET /aluno/me/conjunto-ativo
- GET /aluno/me/conjunto-ativo/treinos
- POST /aluno/sessoes (iniciar sessão de treino)
- GET /aluno/sessoes/{sessao_id}
- POST /aluno/sessoes/{sessao_id}/series (registrar série)
- PATCH /aluno/sessoes/{sessao_id}/finalizar

Dados iniciais:

- Seed de exercícios-base no backend (migração + script idempotente) para catálogo inicial.

## 7. Autenticação e autorização

Estratégia MVP:

1. Login por email/senha.
2. Access token JWT curto + refresh token.
3. Role no token: PERSONAL ou ALUNO (definida no backend).
4. Após login, o app direciona automaticamente para a navegação do perfil conforme a role da conta.
5. Proteção de rotas e recursos por role no backend e no app.
6. Regras de ownership:
   - Personal só acessa alunos associados.
   - Aluno só acessa seus próprios dados e sessões.

## 8. Decisões técnicas mobile (MVP)

Recomendação mínima:

- Navegação: React Navigation.
- Estado remoto: TanStack Query.
- Formulários: React Hook Form.
- Cliente HTTP: Axios.
- Persistência local leve: AsyncStorage (token e cache simples).
- Offline-first para sessão de treino: TanStack Query com PersistQueryClient + fila local de mutações.
- Política de conflito offline (MVP): última escrita válida por série (timestamp do cliente); conflitos não reconciliáveis retornam 409 para reenvio guiado.

Princípios:

1. Compartilhar tipos de API via packages/types.
2. Manter UI simples e focada em usabilidade de treino.
3. Garantir continuidade do treino sem internet e sincronização eventual.
4. Evitar features não essenciais no MVP (chat, notificações complexas, wearables).

## 9. Critérios de pronto do MVP

O MVP será considerado pronto quando:

1. Personal conseguir criar e ativar conjunto de treino, além de cadastrar/editar treinos e exercícios do aluno.
2. Aluno conseguir iniciar treino do conjunto ativo e registrar séries com peso e repetições.
3. API possuir autenticação funcional e autorização por papel.
4. Fluxos críticos funcionarem em iOS e Android.
5. Registro de sessão funcionar offline com sincronização automática ao voltar conexão.
6. Logs de erro mínimos e validações básicas estiverem implementados.

## 10. Fora do escopo (pós-MVP)

Itens adiados:

1. Editor avançado de treinos (duplicação de ciclos, templates e operações em lote).
2. Métricas avançadas e relatórios.
3. Notificações push e agenda.
4. Conteúdo multimídia de exercícios.
5. Integrações com wearables.

---

Versão: 0.1 (MVP inicial)
Data: 21/02/2026
