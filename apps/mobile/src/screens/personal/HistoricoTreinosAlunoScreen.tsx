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

import { keys } from "../../api/queryKeys";
import { personalService } from "../../api/services/personal";
import type { SessaoResumo } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import { colors } from "../../theme/colors";

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
    queryKey: keys.personal.alunoConjuntoSessoes(alunoId, conjuntoId),
    queryFn: () => personalService.alunoConjuntoSessoes(alunoId, conjuntoId),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
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
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
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
    borderBottomColor: colors.border,
  },
  conjunto: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
  },
  aluno: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  codigo: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 16,
  },
  nome: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 13,
  },
  statusDone: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  statusOpen: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 16,
    textAlign: "center",
  },
});
