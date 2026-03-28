import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { SessaoResumo } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "HistoricoTreinosAluno"
>;

function formatDate(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDuration(startIso: string, endIso: string | null) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));

  const minutes = Math.floor(diffSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(diffSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function HistoricoTreinosAlunoScreen({ route, navigation }: Props) {
  const { alunoId, conjuntoId, conjuntoNome, alunoNome } = route.params;

  const { data, isLoading, isError } = useQuery<SessaoResumo[]>({
    queryKey: ["personal", "aluno", alunoId, "conjunto", conjuntoId, "sessoes"],
    queryFn: async () => {
      const res = await api.get(
        `/personal/alunos/${alunoId}/conjuntos/${conjuntoId}/sessoes`,
      );
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Erro ao carregar histórico de treinos.</Text>
      </View>
    );
  }

  const sessoes = data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.conjunto}>{conjuntoNome}</Text>
        <Text style={styles.aluno}>{alunoNome}</Text>
      </View>

      {!sessoes.length ? (
        <View style={styles.centerBody}>
          <Text style={styles.empty}>
            Nenhum treino realizado nesta periodização.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessoes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("DetalheTreinoRealizadoAluno", {
                  alunoId,
                  sessao: item,
                })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.codigo}>{item.treino_codigo}</Text>
                <Text
                  style={
                    item.status === "FINALIZADO"
                      ? styles.statusDone
                      : styles.statusOpen
                  }
                >
                  {item.status === "FINALIZADO" ? "Finalizado" : "Em andamento"}
                </Text>
              </View>
              <Text style={styles.nome}>{item.treino_nome}</Text>
              <Text style={styles.meta}>
                Data: {formatDate(item.iniciado_em)} · Duração:{" "}
                {formatDuration(item.iniciado_em, item.finalizado_em)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0d0d",
    padding: 24,
  },
  centerBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
  },
  conjunto: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },
  aluno: {
    color: "#8a8a8a",
    fontSize: 14,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#242424",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  codigo: {
    color: "#22c55e",
    fontWeight: "700",
    fontSize: 16,
  },
  nome: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    color: "#9a9a9a",
    marginTop: 6,
    fontSize: 13,
  },
  statusDone: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },
  statusOpen: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    color: "#8d8d8d",
    fontSize: 16,
    textAlign: "center",
  },
  error: {
    color: "#f87171",
    fontSize: 16,
    textAlign: "center",
  },
});
