import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";

import { keys } from "../../api/queryKeys";
import { alunoService } from "../../api/services/aluno";
import type {
  ConjuntoTreino,
  Treino,
  SessaoAtiva,
  SessaoResumo,
} from "@ecg/types";
import type { AlunoTreinoStackParamList } from "../../navigation/AlunoNavigator";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<AlunoTreinoStackParamList, "ConjuntoAtivo">;

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

function parseApiDateToMs(value: string) {
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`).getTime();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ConjuntoAtivoScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { data: conjunto, isLoading: loadingConjunto } =
    useQuery<ConjuntoTreino>({
      queryKey: keys.aluno.conjuntoAtivo(),
      queryFn: () => alunoService.conjuntoAtivo(),
    });

  const { data: treinos, isLoading: loadingTreinos } = useQuery<Treino[]>({
    queryKey: keys.aluno.conjuntoAtivoTreinos(),
    queryFn: () => alunoService.conjuntoAtivoTreinos(),
    enabled: !!conjunto,
  });

  const { data: sessoes = [] } = useQuery<SessaoResumo[]>({
    queryKey: keys.aluno.sessoes(),
    queryFn: () => alunoService.sessoes(),
    enabled: !!treinos?.length,
  });

  const {
    data: sessaoAtiva,
    refetch: refetchSessaoAtiva,
  } = useQuery<SessaoAtiva | null>({
    queryKey: keys.aluno.sessaoAtiva(),
    queryFn: async () => {
      try {
        return await alunoService.sessaoAtiva();
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    },
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    staleTime: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      // Garante sincronização imediata ao voltar para a home do aluno.
      void refetchSessaoAtiva();
    }, [refetchSessaoAtiva]),
  );

  const descartarSessaoMutation = useMutation({
    mutationFn: (sessaoId: string) => alunoService.descartarSessao(sessaoId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: keys.aluno.sessaoAtiva(),
      });
      Alert.alert("Treino descartado", "A sessão em andamento foi descartada.");
    },
    onError: async (err: any) => {
      if (err?.response?.status === 404) {
        await queryClient.invalidateQueries({
          queryKey: keys.aluno.sessaoAtiva(),
        });
        Alert.alert(
          "Treino descartado",
          "A sessão já tinha sido finalizada ou descartada.",
        );
        return;
      }

      Alert.alert("Erro", "Não foi possível descartar o treino em andamento.");
    },
  });

  const primeiraDataTreinoDoCiclo = useMemo(() => {
    if (!treinos?.length || !sessoes.length) return null;

    const idsTreinoDoCiclo = new Set(treinos.map((treino) => treino.id));
    const sessoesDoCiclo = sessoes.filter((sessao) =>
      idsTreinoDoCiclo.has(sessao.treino_id),
    );
    if (!sessoesDoCiclo.length) return null;

    const primeiraSessao = sessoesDoCiclo.reduce((maisAntiga, atual) => {
      return new Date(atual.iniciado_em).getTime() <
        new Date(maisAntiga.iniciado_em).getTime()
        ? atual
        : maisAntiga;
    });

    return formatDate(primeiraSessao.iniciado_em);
  }, [treinos, sessoes]);

  function confirmarDescarte(sessaoId: string) {
    Alert.alert(
      "Descartar treino?",
      "Isso vai apagar a sessão em andamento e as séries registradas nela.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => descartarSessaoMutation.mutate(sessaoId),
        },
      ],
    );
  }

  // Cronômetro para sessão ativa
  useEffect(() => {
    const iniciadoEm = sessaoAtiva?.iniciado_em;
    if (!iniciadoEm) {
      setElapsedSeconds(0);
      return;
    }

    const iniciadoEmMs = parseApiDateToMs(iniciadoEm);
    const calcElapsed = () =>
      Math.max(0, Math.floor((Date.now() - iniciadoEmMs) / 1000));

    setElapsedSeconds(calcElapsed());

    const timer = setInterval(() => {
      setElapsedSeconds(calcElapsed());
    }, 1000);

    return () => clearInterval(timer);
  }, [sessaoAtiva?.iniciado_em]);

  if (loadingConjunto) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!conjunto) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Nenhuma periodização ativa.</Text>
        <Text style={styles.emptySub}>
          Peça ao seu personal para ativar uma periodização.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.conjuntoNome}>{conjunto.nome}</Text>
        <Text style={styles.conjuntoSub}>
          {primeiraDataTreinoDoCiclo
            ? `Primeiro treino deste ciclo feito em ${primeiraDataTreinoDoCiclo}`
            : "Periodização ativa"}
        </Text>
      </View>

      {/* Continuar Treino */}
      {sessaoAtiva && (
        <View style={styles.continueCard}>
          <View style={styles.continueTopRow}>
            <View style={styles.continueTopLeft}>
              <Text style={styles.continueBadge}>EM ANDAMENTO</Text>
              <Text style={styles.continueTimer}>
                {formatTime(elapsedSeconds)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.discardIconButton}
              onPress={() => confirmarDescarte(sessaoAtiva.id)}
              disabled={descartarSessaoMutation.isPending}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              {descartarSessaoMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <MaterialIcons
                  name="delete-outline"
                  size={18}
                  color={colors.danger}
                />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.continueTitle}>
            Treino {sessaoAtiva.treino_codigo}
          </Text>
          <Text style={styles.continueSub}>{sessaoAtiva.treino_nome}</Text>

          <TouchableOpacity
            style={styles.continueCtaButton}
            onPress={() =>
              navigation.navigate("SessaoTreino", {
                treinoId: sessaoAtiva.treino_id,
                treinoCodigo: sessaoAtiva.treino_codigo,
                treinoNome: sessaoAtiva.treino_nome,
                sessaoAtiva,
              })
            }
          >
            <Text style={styles.continueCtaText}>Continuar treino</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.background} />
          </TouchableOpacity>
        </View>
      )}

      {loadingTreinos ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 32 }}
        />
      ) : (
        <FlatList
          data={treinos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("SessaoTreino", {
                  treinoId: item.id,
                  treinoCodigo: item.codigo,
                  treinoNome: item.nome,
                })
              }
            >
              <Text style={styles.codigo}>{item.codigo}</Text>
              <Text style={styles.nome}>{item.nome}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 32,
  },
  header: { marginBottom: 24 },
  conjuntoNome: { color: colors.text, fontSize: 24, fontWeight: "bold" },
  conjuntoSub: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  // Continuar Treino
  continueCard: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  continueTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  continueTopLeft: {
    gap: 4,
  },
  continueBadge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  continueTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  continueSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  continueTimer: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  discardIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueCtaButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  continueCtaText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  // Lista de treinos
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  codigo: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "bold",
    width: 48,
    textAlign: "center",
  },
  nome: { color: colors.text, fontSize: 18, flex: 1 },
  empty: { color: colors.textMuted, textAlign: "center", fontSize: 18 },
  emptySub: { color: colors.border, textAlign: "center", fontSize: 14, marginTop: 8 },
});
