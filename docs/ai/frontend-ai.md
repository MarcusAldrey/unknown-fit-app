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

## Regras práticas para IA

- Respeitar os tipos de `apps/mobile/src/types/index.ts`.
- Se alterar contratos de API, alinhar com `packages/types/src/index.ts` e backend.
- Não mascarar falhas de API como lista vazia: exibir estado de erro quando a query falhar.
- Evitar hardcode de host da API quando o host do Expo estiver disponível.
- Manter UI consistente com o tema já usado nas telas (fundo escuro, cartões, tipografia atual).

## Pontos críticos

A base URL da API fica em `apps/mobile/src/api/client.ts`.
Em dev, a prioridade esperada é:

1. `EXPO_PUBLIC_API_URL`
2. host detectado pelo Expo (`expoConfig.hostUri`)
3. fallback de `extra.apiHost`
4. `127.0.0.1`

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
