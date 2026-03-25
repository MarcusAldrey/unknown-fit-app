import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type {
  ExercicioTreino,
  SessaoTreino,
  SerieCreate,
  UltimoPesoExercicio,
} from "../../types";
import type { AlunoTreinoStackParamList } from "../../navigation/AlunoNavigator";

type Props = NativeStackScreenProps<AlunoTreinoStackParamList, "SessaoTreino">;

interface SerieLocal {
  localId: string;
  exercicio_treino_id: string;
  numero_serie: number;
  peso: string;
  reps: string;
  concluida: boolean;
}

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

export function SessaoTreinoScreen({ route, navigation }: Props) {
  const { treinoId, treinoCodigo } = route.params;
  const queryClient = useQueryClient();

  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [series, setSeries] = useState<SerieLocal[]>([]);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [restExerciseId, setRestExerciseId] = useState<string | null>(null);
  const sessaoAtivaParam = route.params.sessaoAtiva;

  const { data: exercicios, isLoading } = useQuery<ExercicioTreino[]>({
    queryKey: ["aluno", "treino", treinoId, "exercicios"],
    queryFn: async () => {
      const res = await api.get(`/aluno/treinos/${treinoId}/exercicios`);
      return res.data;
    },
  });

  const { data: ultimosPesos = {} } = useQuery<Record<string, number | null>>({
    queryKey: ["aluno", "treino", treinoId, "ultimos-pesos"],
    enabled: !!exercicios?.length,
    queryFn: async () => {
      const responses = await Promise.all(
        (exercicios ?? []).map(async (exercicio) => {
          const res = await api.get<UltimoPesoExercicio>(
            `/aluno/exercicios/${exercicio.id}/ultimo-peso`,
          );
          return [exercicio.id, res.data.peso_utilizado] as const;
        }),
      );

      return Object.fromEntries(responses);
    },
  });

  const iniciarMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<SessaoTreino>("/aluno/sessoes", {
        treino_id: treinoId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSessaoId(data.id);
      setSessionElapsedSeconds(0);
      setSeries(() => {
        const iniciais: SerieLocal[] = [];

        (exercicios ?? []).forEach((exercicio) => {
          const quantidade = Math.max(1, exercicio.numero_series_prescritas);
          for (let i = 0; i < quantidade; i += 1) {
            iniciais.push({
              localId: `${exercicio.id}-${i + 1}-${Date.now()}-${Math.random()}`,
              exercicio_treino_id: exercicio.id,
              numero_serie: i + 1,
              peso: "",
              reps: "",
              concluida: false,
            });
          }
        });

        return iniciais;
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível iniciar a sessão.");
    },
  });

  // Retomar sessão ativa vinda dos params
  useEffect(() => {
    if (!sessaoAtivaParam || sessaoId) return;

    setSessaoId(sessaoAtivaParam.id);

    // Calcular tempo decorrido
    const iniciadoEm = new Date(sessaoAtivaParam.iniciado_em).getTime();
    const agora = Date.now();
    const elapsed = Math.max(0, Math.floor((agora - iniciadoEm) / 1000));
    setSessionElapsedSeconds(elapsed);

    // Restaurar séries já registradas e criar as pendentes
    const seriesLocal: SerieLocal[] = [];
    const seriesJaRegistradas = sessaoAtivaParam.series || [];

    (exercicios ?? []).forEach((exercicio) => {
      const registradas = seriesJaRegistradas.filter(
        (s) => s.exercicio_treino_id === exercicio.id,
      );
      const quantidade = Math.max(
        exercicio.numero_series_prescritas,
        registradas.length,
      );

      for (let i = 0; i < quantidade; i += 1) {
        const registrada = registradas.find((s) => s.numero_serie === i + 1);
        if (registrada) {
          seriesLocal.push({
            localId: `${exercicio.id}-${i + 1}-restored-${Math.random()}`,
            exercicio_treino_id: exercicio.id,
            numero_serie: i + 1,
            peso: registrada.peso_utilizado != null ? String(registrada.peso_utilizado) : "",
            reps: registrada.repeticoes_realizadas != null ? String(registrada.repeticoes_realizadas) : "",
            concluida: registrada.concluida,
          });
        } else {
          seriesLocal.push({
            localId: `${exercicio.id}-${i + 1}-${Date.now()}-${Math.random()}`,
            exercicio_treino_id: exercicio.id,
            numero_serie: i + 1,
            peso: "",
            reps: "",
            concluida: false,
          });
        }
      }
    });

    setSeries(seriesLocal);
  }, [sessaoAtivaParam, exercicios]);

  const serieMutation = useMutation({
    mutationFn: async (body: SerieCreate) => {
      await api.post(`/aluno/sessoes/${sessaoId}/series`, body);
    },
    onError: () => {
      Alert.alert("Erro", "Falha ao salvar série.");
    },
  });

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
    onError: () => {
      Alert.alert("Erro", "Não foi possível finalizar a sessão.");
    },
  });

  useEffect(() => {
    if (!sessaoId) return;

    const timer = setInterval(() => {
      setSessionElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [sessaoId]);

  useEffect(() => {
    if (restSecondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setRestSecondsRemaining((current) => {
        if (current <= 1) {
          setRestExerciseId(null);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [restSecondsRemaining]);

  const exerciciosComEstado = useMemo(() => {
    return (exercicios ?? []).map((exercicio) => {
      const seriesDoExercicio = series.filter(
        (serie) => serie.exercicio_treino_id === exercicio.id,
      );
      const concluido =
        seriesDoExercicio.length > 0 &&
        seriesDoExercicio.every((serie) => serie.concluida);

      return {
        exercicio,
        seriesDoExercicio,
        concluido,
      };
    });
  }, [exercicios, series]);

  function adicionarSerie(exercicioId: string) {
    const seriesDoExercicio = series.filter(
      (serie) => serie.exercicio_treino_id === exercicioId,
    );

    setSeries((current) => [
      ...current,
      {
        localId: `${exercicioId}-${seriesDoExercicio.length + 1}-${Date.now()}-${Math.random()}`,
        exercicio_treino_id: exercicioId,
        numero_serie: seriesDoExercicio.length + 1,
        peso: "",
        reps: "",
        concluida: false,
      },
    ]);
  }

  function updateSerie(localId: string, field: "peso" | "reps", value: string) {
    setSeries((current) =>
      current.map((serie) =>
        serie.localId === localId ? { ...serie, [field]: value } : serie,
      ),
    );
  }

  function confirmarSerie(serie: SerieLocal, descansoSegundos: number | null) {
    if (!serie.peso && !serie.reps) {
      Alert.alert("Preencha ao menos um campo", "Informe peso ou repetições.");
      return;
    }

    setSeries((current) =>
      current.map((item) =>
        item.localId === serie.localId ? { ...item, concluida: true } : item,
      ),
    );

    serieMutation.mutate({
      exercicio_treino_id: serie.exercicio_treino_id,
      numero_serie: serie.numero_serie,
      peso_utilizado: serie.peso ? Number(serie.peso) : undefined,
      repeticoes_realizadas: serie.reps ? Number(serie.reps) : undefined,
      concluida: true,
    });

    if (descansoSegundos && descansoSegundos > 0) {
      setRestExerciseId(serie.exercicio_treino_id);
      setRestSecondsRemaining(descansoSegundos);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!sessaoId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#0d0d0d" }}
        contentContainerStyle={styles.preStartContainer}
      >
        <Text style={styles.iniciarTitle}>Treino {treinoCodigo}</Text>
        <Text style={styles.iniciarSub}>
          {exercicios?.length ?? 0} exercícios
        </Text>

        {/* Preview de exercícios */}
        {exercicios && exercicios.length > 0 && (
          <View style={styles.previewContainer}>
            {exercicios.map((ex, idx) => (
              <View key={ex.id} style={styles.previewItem}>
                <Text style={styles.previewOrder}>{idx + 1}</Text>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{ex.nome_exercicio}</Text>
                  <Text style={styles.previewDetail}>
                    {ex.numero_series_prescritas} séries ·{" "}
                    {ex.repeticao_ou_tempo ?? "Sem prescrição"}
                    {ex.tecnica && ex.tecnica !== "PADRAO"
                      ? ` · ${ex.tecnica}`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { marginTop: 24, marginHorizontal: 16 }]}
          onPress={() => iniciarMutation.mutate()}
          disabled={iniciarMutation.isPending}
        >
          {iniciarMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Treino</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerHeader}>
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Duração da sessão</Text>
          <Text style={styles.timerValue}>
            {formatTime(sessionElapsedSeconds)}
          </Text>
        </View>
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Descanso</Text>
          <Text style={styles.timerValue}>
            {restSecondsRemaining > 0
              ? formatTime(restSecondsRemaining)
              : "00:00:00"}
          </Text>
          {restExerciseId ? (
            <Text style={styles.timerSub}>Em andamento</Text>
          ) : (
            <Text style={styles.timerSub}>Parado</Text>
          )}
        </View>
      </View>

      <FlatList
        data={exerciciosComEstado}
        keyExtractor={(item) => item.exercicio.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const { exercicio, seriesDoExercicio, concluido } = item;

          return (
            <View
              style={[
                styles.exercicioCard,
                concluido ? styles.exercicioCardDone : undefined,
              ]}
            >
              <View style={styles.exercicioHeader}>
                <Text style={styles.exercicioNome}>
                  {exercicio.nome_exercicio}
                </Text>
                <Text
                  style={concluido ? styles.badgeDone : styles.badgePending}
                >
                  {concluido ? "Concluído" : "Pendente"}
                </Text>
              </View>
              <Text style={styles.exercicioDetalhe}>
                {exercicio.numero_series_prescritas} séries ·{" "}
                {exercicio.repeticao_ou_tempo ?? "Sem prescrição"} · Desc:{" "}
                {exercicio.descanso_segundos
                  ? `${exercicio.descanso_segundos}s`
                  : "—"}
              </Text>

              {seriesDoExercicio.map((serie) => (
                <View key={serie.localId} style={styles.serieRow}>
                  <Text style={styles.serieNum}>S{serie.numero_serie}</Text>
                  <TextInput
                    style={styles.serieInput}
                    placeholder={
                      ultimosPesos[exercicio.id] != null
                        ? String(ultimosPesos[exercicio.id])
                        : "kg"
                    }
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={serie.peso}
                    onChangeText={(v) => updateSerie(serie.localId, "peso", v)}
                    editable={!serie.concluida}
                  />
                  <TextInput
                    style={styles.serieInput}
                    placeholder="reps"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={serie.reps}
                    onChangeText={(v) => updateSerie(serie.localId, "reps", v)}
                    editable={!serie.concluida}
                  />
                  {serie.concluida ? (
                    <Text style={styles.check}>✓</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() =>
                        confirmarSerie(serie, exercicio.descanso_segundos)
                      }
                    >
                      <Text style={styles.confirmar}>OK</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={() => adicionarSerie(exercicio.id)}
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
          disabled={finalizarMutation.isPending}
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
          {finalizarMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Finalizar Sessão</Text>
          )}
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
  iniciarSub: { color: "#888", fontSize: 16, marginTop: 8, marginBottom: 16 },
  preStartContainer: {
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: "center",
  },
  previewContainer: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  previewOrder: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "bold",
    width: 28,
    textAlign: "center",
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  previewDetail: {
    color: "#888",
    fontSize: 13,
    marginTop: 2,
  },
  timerHeader: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  timerCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  timerLabel: { color: "#a3a3a3", fontSize: 12 },
  timerValue: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "700",
    marginTop: 2,
  },
  timerSub: { color: "#22c55e", fontSize: 12, marginTop: 2 },
  content: { paddingBottom: 100, paddingTop: 2 },
  exercicioCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#232323",
  },
  exercicioCardDone: {
    borderColor: "#22c55e",
    backgroundColor: "#13201a",
  },
  exercicioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgePending: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "600",
  },
  badgeDone: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },
  exercicioNome: { color: "#fff", fontSize: 16, fontWeight: "bold", flex: 1 },
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
    width: 78,
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
