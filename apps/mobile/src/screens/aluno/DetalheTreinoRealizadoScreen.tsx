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

import { keys } from "../../api/queryKeys";
import { alunoService } from "../../api/services/aluno";
import type { SerieDetalhe } from "@kine/types";
import type { AlunoHistoricoStackParamList } from "../../navigation/AlunoNavigator";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<
  AlunoHistoricoStackParamList,
  "DetalheTreinoRealizado"
>;

interface GrupoExercicio {
  nome_exercicio: string;
  series: SerieDetalhe[];
}

export function DetalheTreinoRealizadoScreen({ route }: Props) {
  const { sessao } = route.params;

  const { data, isLoading, isError } = useQuery<SerieDetalhe[]>({
    queryKey: keys.aluno.sessaoSeries(sessao.id),
    queryFn: () => alunoService.sessaoSeries(sessao.id),
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
        <ActivityIndicator size="large" color={colors.primary} />
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
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
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
  codigo: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  nome: { color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exercicioNome: {
    color: colors.text,
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
    color: colors.primary,
    fontWeight: "700",
    width: 36,
  },
  valor: {
    color: colors.text,
    width: 90,
    fontSize: 14,
  },
  done: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  pending: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  empty: { color: colors.textMuted, fontSize: 16, textAlign: "center" },
  error: { color: colors.danger, fontSize: 16, textAlign: "center" },
});
