import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { SerieDetalhe } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "DetalheTreinoRealizadoAluno"
>;

interface GrupoExercicio {
  nome_exercicio: string;
  series: SerieDetalhe[];
}

export function DetalheTreinoRealizadoAlunoScreen({ route }: Props) {
  const { alunoId, sessao } = route.params;

  const { data, isLoading, isError } = useQuery<SerieDetalhe[]>({
    queryKey: ["personal", "aluno", alunoId, "sessao", sessao.id, "series"],
    queryFn: async () => {
      const res = await api.get(
        `/personal/alunos/${alunoId}/sessoes/${sessao.id}/series`,
      );
      return res.data;
    },
  });

  const grupos = useMemo<GrupoExercicio[]>(() => {
    const map = new Map<string, GrupoExercicio>();

    (data ?? []).forEach((serie) => {
      if (!map.has(serie.nome_exercicio)) {
        map.set(serie.nome_exercicio, {
          nome_exercicio: serie.nome_exercicio,
          series: [],
        });
      }

      map.get(serie.nome_exercicio)?.series.push(serie);
    });

    return Array.from(map.values());
  }, [data]);

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
        <Text style={styles.error}>Erro ao carregar detalhes da sessão.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.codigo}>Treino {sessao.treino_codigo}</Text>
        <Text style={styles.nome}>{sessao.treino_nome}</Text>
      </View>

      {!grupos.length ? (
        <View style={styles.centerBody}>
          <Text style={styles.empty}>
            Nenhuma série registrada nesta sessão.
          </Text>
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={(item) => item.nome_exercicio}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 6,
            paddingBottom: 24,
          }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.exercicioNome}>{item.nome_exercicio}</Text>
              {item.series.map((serie) => (
                <View key={serie.id} style={styles.serieRow}>
                  <Text style={styles.serieNum}>S{serie.numero_serie}</Text>
                  <Text style={styles.valor}>
                    {serie.peso_utilizado ?? "-"} kg
                  </Text>
                  <Text style={styles.valor}>
                    {serie.repeticoes_realizadas ?? "-"} reps
                  </Text>
                  <Text style={serie.concluida ? styles.done : styles.pending}>
                    {serie.concluida ? "✓" : "-"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  center: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  codigo: { color: "#22c55e", fontSize: 14, fontWeight: "700" },
  nome: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 2 },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#242424",
  },
  exercicioNome: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  serieRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  serieNum: {
    color: "#22c55e",
    fontWeight: "700",
    width: 36,
  },
  valor: {
    color: "#d0d0d0",
    width: 90,
    fontSize: 14,
  },
  done: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "700",
  },
  pending: {
    color: "#999",
    fontSize: 16,
    fontWeight: "700",
  },
  empty: { color: "#8d8d8d", fontSize: 16, textAlign: "center" },
  error: { color: "#f87171", fontSize: 16, textAlign: "center" },
});
