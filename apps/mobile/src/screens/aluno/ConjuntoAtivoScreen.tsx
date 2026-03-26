import React, { useEffect, useMemo, useState } from "react";
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
import { MaterialIcons } from "@expo/vector-icons";

import api from "../../api/client";
import type {
  ConjuntoTreino,
  Treino,
  SessaoAtiva,
  SessaoResumo,
} from "../../types";
import type { AlunoTreinoStackParamList } from "../../navigation/AlunoNavigator";

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
      queryKey: ["aluno", "conjunto-ativo"],
      queryFn: async () => {
        const res = await api.get("/aluno/me/conjunto-ativo");
        return res.data;
      },
    });

  const { data: treinos, isLoading: loadingTreinos } = useQuery<Treino[]>({
    queryKey: ["aluno", "conjunto-ativo", "treinos"],
    queryFn: async () => {
      const res = await api.get("/aluno/me/conjunto-ativo/treinos");
      return res.data;
    },
    enabled: !!conjunto,
  });

  const { data: sessoes = [] } = useQuery<SessaoResumo[]>({
    queryKey: ["aluno", "sessoes", "historico"],
    queryFn: async () => {
      const res = await api.get("/aluno/sessoes");
      return res.data;
    },
    enabled: !!treinos?.length,
  });

  const { data: sessaoAtiva, isLoading: loadingSessaoAtiva } =
    useQuery<SessaoAtiva | null>({
      queryKey: ["aluno", "sessao-ativa"],
      queryFn: async () => {
        try {
          const res = await api.get("/aluno/sessoes/ativa");
          return res.data;
        } catch (err: any) {
          if (err.response?.status === 404) return null;
          throw err;
        }
      },
      refetchOnWindowFocus: false,
      refetchOnMount: "always",
      staleTime: 30_000,
    });

  const descartarSessaoMutation = useMutation({
    mutationFn: async (sessaoId: string) => {
      await api.delete(`/aluno/sessoes/${sessaoId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["aluno", "sessao-ativa"],
      });
      Alert.alert("Treino descartado", "A sessão em andamento foi descartada.");
    },
    onError: () => {
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
        <ActivityIndicator size="large" color="#22c55e" />
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
                <ActivityIndicator size="small" color="#fca5a5" />
              ) : (
                <MaterialIcons
                  name="delete-outline"
                  size={18}
                  color="#fca5a5"
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
            <MaterialIcons name="arrow-forward" size={18} color="#0d0d0d" />
          </TouchableOpacity>
        </View>
      )}

      {loadingTreinos ? (
        <ActivityIndicator
          size="large"
          color="#22c55e"
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
  container: { flex: 1, backgroundColor: "#0d0d0d", padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    padding: 32,
  },
  header: { marginBottom: 24 },
  conjuntoNome: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  conjuntoSub: { color: "#888", fontSize: 14, marginTop: 4 },
  // Continuar Treino
  continueCard: {
    backgroundColor: "#152a1d",
    borderColor: "#22c55e",
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
    color: "#86efac",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  continueTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  continueSub: {
    color: "#a3a3a3",
    fontSize: 13,
    marginTop: 3,
  },
  continueTimer: {
    color: "#d1fae5",
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
    backgroundColor: "#1a3624",
    borderWidth: 1,
    borderColor: "#2f5b40",
  },
  continueCtaButton: {
    marginTop: 12,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  continueCtaText: {
    color: "#0d0d0d",
    fontSize: 14,
    fontWeight: "700",
  },
  // Lista de treinos
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  codigo: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "bold",
    width: 48,
    textAlign: "center",
  },
  nome: { color: "#fff", fontSize: 18, flex: 1 },
  empty: { color: "#888", textAlign: "center", fontSize: 18 },
  emptySub: { color: "#555", textAlign: "center", fontSize: 14, marginTop: 8 },
});
