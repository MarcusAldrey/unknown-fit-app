import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { ExercicioTreino, SessaoTreino, SerieCreate } from "../../types";
import type { AlunoStackParamList } from "../../navigation/AlunoNavigator";

type Props = NativeStackScreenProps<AlunoStackParamList, "SessaoTreino">;

interface SerieLocal {
  exercicio_treino_id: string;
  numero_serie: number;
  peso: string;
  reps: string;
  concluida: boolean;
}

export function SessaoTreinoScreen({ route, navigation }: Props) {
  const { treinoId, treinoCodigo } = route.params;
  const queryClient = useQueryClient();

  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [series, setSeries] = useState<SerieLocal[]>([]);

  // Buscar exercícios do treino
  const { data: exercicios, isLoading } = useQuery<ExercicioTreino[]>({
    queryKey: ["aluno", "treino", treinoId, "exercicios"],
    queryFn: async () => {
      const res = await api.get(`/personal/treinos/${treinoId}/exercicios`);
      return res.data;
    },
  });

  // Iniciar sessão
  const iniciarMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<SessaoTreino>("/aluno/sessoes", {
        treino_id: treinoId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSessaoId(data.id);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível iniciar a sessão.");
    },
  });

  // Registrar série
  const serieMutation = useMutation({
    mutationFn: async (body: SerieCreate) => {
      await api.post(`/aluno/sessoes/${sessaoId}/series`, body);
    },
    onError: () => {
      Alert.alert(
        "Erro",
        "Falha ao salvar série. Será reenviada ao reconectar.",
      );
    },
  });

  // Finalizar sessão
  const finalizarMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/aluno/sessoes/${sessaoId}/finalizar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno"] });
      Alert.alert("Parabéns!", "Sessão finalizada com sucesso.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    },
  });

  function adicionarSerie(exercicioId: string) {
    const seriesDoExercicio = series.filter(
      (s) => s.exercicio_treino_id === exercicioId,
    );
    setSeries([
      ...series,
      {
        exercicio_treino_id: exercicioId,
        numero_serie: seriesDoExercicio.length + 1,
        peso: "",
        reps: "",
        concluida: false,
      },
    ]);
  }

  function confirmarSerie(index: number) {
    const serie = series[index];
    if (!serie.peso && !serie.reps) return;

    const updated = [...series];
    updated[index] = { ...serie, concluida: true };
    setSeries(updated);

    serieMutation.mutate({
      exercicio_treino_id: serie.exercicio_treino_id,
      numero_serie: serie.numero_serie,
      peso_utilizado: serie.peso ? parseFloat(serie.peso) : undefined,
      repeticoes_realizadas: serie.reps ? parseInt(serie.reps, 10) : undefined,
      concluida: true,
    });
  }

  function updateSerie(index: number, field: "peso" | "reps", value: string) {
    const updated = [...series];
    updated[index] = { ...updated[index], [field]: value };
    setSeries(updated);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // Tela de início
  if (!sessaoId) {
    return (
      <View style={styles.center}>
        <Text style={styles.iniciarTitle}>Treino {treinoCodigo}</Text>
        <Text style={styles.iniciarSub}>
          {exercicios?.length ?? 0} exercícios
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => iniciarMutation.mutate()}
          disabled={iniciarMutation.isPending}
        >
          {iniciarMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Treino</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={exercicios}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item: ex }) => {
          const seriesDoEx = series.filter(
            (s) => s.exercicio_treino_id === ex.id,
          );

          return (
            <View style={styles.exercicioCard}>
              <Text style={styles.exercicioNome}>{ex.nome_exercicio}</Text>
              <Text style={styles.exercicioDetalhe}>
                {ex.repeticao_ou_tempo ?? ""} · Desc:{" "}
                {ex.descanso_segundos ? `${ex.descanso_segundos}s` : "—"}
              </Text>

              {seriesDoEx.map((serie, idx) => {
                const globalIdx = series.indexOf(serie);
                return (
                  <View key={idx} style={styles.serieRow}>
                    <Text style={styles.serieNum}>S{serie.numero_serie}</Text>
                    <TextInput
                      style={styles.serieInput}
                      placeholder="kg"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={serie.peso}
                      onChangeText={(v) => updateSerie(globalIdx, "peso", v)}
                      editable={!serie.concluida}
                    />
                    <TextInput
                      style={styles.serieInput}
                      placeholder="reps"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={serie.reps}
                      onChangeText={(v) => updateSerie(globalIdx, "reps", v)}
                      editable={!serie.concluida}
                    />
                    {serie.concluida ? (
                      <Text style={styles.check}>✓</Text>
                    ) : (
                      <TouchableOpacity
                        onPress={() => confirmarSerie(globalIdx)}
                      >
                        <Text style={styles.confirmar}>OK</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={() => adicionarSerie(ex.id)}
                style={styles.addSerie}
              >
                <Text style={styles.addSerieText}>+ Série</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#166534" }]}
          onPress={() =>
            Alert.alert(
              "Finalizar?",
              "Deseja encerrar esta sessão de treino?",
              [
                { text: "Cancelar" },
                {
                  text: "Finalizar",
                  onPress: () => finalizarMutation.mutate(),
                },
              ],
            )
          }
        >
          <Text style={styles.buttonText}>Finalizar Sessão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    padding: 32,
  },
  iniciarTitle: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  iniciarSub: { color: "#888", fontSize: 16, marginTop: 8, marginBottom: 32 },
  exercicioCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
  },
  exercicioNome: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  exercicioDetalhe: {
    color: "#888",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  serieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  serieNum: { color: "#22c55e", fontWeight: "bold", width: 30 },
  serieInput: {
    backgroundColor: "#0d0d0d",
    color: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 70,
    textAlign: "center",
    fontSize: 15,
  },
  check: {
    color: "#4caf50",
    fontSize: 18,
    fontWeight: "bold",
    width: 30,
    textAlign: "center",
  },
  confirmar: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "bold",
    width: 30,
    textAlign: "center",
  },
  addSerie: { marginTop: 10, alignSelf: "flex-start" },
  addSerieText: { color: "#22c55e", fontSize: 14 },
  footer: { padding: 16 },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
