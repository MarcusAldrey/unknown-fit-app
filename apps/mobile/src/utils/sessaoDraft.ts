import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_PREFIX = "@kine/sessao-draft/";

function draftKey(sessaoId: string) {
  return `${DRAFT_PREFIX}${sessaoId}`;
}

export async function carregarRascunhoSessao<T>(
  sessaoId: string,
): Promise<T | null> {
  const value = await AsyncStorage.getItem(draftKey(sessaoId));
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    await AsyncStorage.removeItem(draftKey(sessaoId));
    return null;
  }
}

export async function salvarRascunhoSessao<T>(
  sessaoId: string,
  value: T,
): Promise<void> {
  await AsyncStorage.setItem(draftKey(sessaoId), JSON.stringify(value));
}

export async function limparRascunhoSessao(sessaoId: string): Promise<void> {
  await AsyncStorage.removeItem(draftKey(sessaoId));
}
