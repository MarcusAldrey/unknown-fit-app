# Frontend IA Contexto (ECG)

Este arquivo orienta agentes de IA a trabalhar no app mobile React Native/Expo deste repositório.

## Escopo

O frontend está em `apps/mobile` e atende dois perfis principais: `PERSONAL` e `ALUNO`.
A API consumida é a do backend FastAPI em `/api/v1`.

## Stack e padrões

- React Native com Expo
- TypeScript
- React Query para cache e fetch
- React Navigation (stack + tabs)
- Axios com interceptors de token e refresh
- SecureStore para tokens
- `AuthContext` (`src/contexts/AuthContext.tsx`) controla sessão e navegação por role (`PERSONAL`/`ALUNO`)

## Regras práticas para IA

- Respeitar os tipos de `apps/mobile/src/types/index.ts`.
- Se alterar contratos de API, alinhar com `packages/types/src/index.ts` e backend.
- Não mascarar falhas de API como lista vazia: exibir estado de erro quando a query falhar.
- Evitar hardcode de host da API quando o host do Expo estiver disponível.
- Manter UI consistente com o tema já usado nas telas (fundo escuro, cartões, tipografia atual).

## Pontos críticos

A base URL da API fica em `apps/mobile/src/api/client.ts`.
A prioridade de resolução é:

1. `EXPO_PUBLIC_API_URL`
2. Em dev (`__DEV__`): host detectado pelo Expo (`expoConfig.hostUri`) → fallback `extra.apiHost` → `127.0.0.1`
3. Em build de produção sem env: fallback fixo `https://api.ecg.com/api/v1`

Endpoints `/admin/` recebem o header `X-Admin-Key` automaticamente quando
`EXPO_PUBLIC_ADMIN_API_KEY` (ou `extra.adminApiKey`) está definido.
O refresh de token em 401 não é tentado para endpoints admin.

## Checklist de mudança no frontend

- Atualizou tipos locais em `apps/mobile/src/types/index.ts` quando necessário.
- Se contrato compartilhado mudou, atualizou também `packages/types/src/index.ts`.
- Verificou telas afetadas por erro/loading/empty state.
- Validou manualmente login e fluxo com dados seed (`personal@ecg.com`, `aluno@ecg.com`).

## Comandos úteis

Na raiz:

```bash
pnpm dev:mobile
```

Dentro de `apps/mobile`:

```bash
pnpm start
pnpm android
pnpm ios
```
