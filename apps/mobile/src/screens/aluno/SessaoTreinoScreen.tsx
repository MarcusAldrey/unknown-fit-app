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
  SessaoAtiva,
  SessaoTreino,
  SerieCreate,
  Treino,
  UltimoPesoExercicio,
} from "../../types";
import type { AlunoTreinoStackParamList } from "../../navigation/AlunoNavigator";

type Props = NativeStackScreenProps<AlunoTreinoStackParamList, "SessaoTreino">;

interface SerieLocal {
  localId: string;
  serieId?: string;
  exercicio_treino_id: string;
  numero_serie: number;
  peso: string;
  reps: string;
  concluida: boolean;
  deleting?: boolean;
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

function parseApiDateToMs(value: string) {
  // Backend envia datetime UTC sem timezone; normalizamos para evitar clock travado em 00:00:00.
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`).getTime();
}

function primeiraColunaTitulo(exercicio: ExercicioTreino) {
  const valor = (exercicio.repeticao_ou_tempo ?? "").toLowerCase();
  const ehTempo = /tempo|seg|segundo|sec|min|\d+\s*s\b/.test(valor);
  return ehTempo ? "Tempo (s)" : "Reps";
}

function formatarDescanso(descansoSegundos: number | null) {
  if (descansoSegundos == null) return "-";
  if (descansoSegundos < 60) return `${descansoSegundos}s`;

  const minutos = Math.floor(descansoSegundos / 60);
  const segundos = descansoSegundos % 60;
  return segundos > 0 ? `${minutos}min ${segundos}s` : `${minutos}min`;
}

function formatarPrescricaoPrincipal(exercicio: ExercicioTreino) {
  const prescricaoBruta = exercicio.repeticao_ou_tempo?.trim();
  if (!prescricaoBruta) {
    return `${exercicio.numero_series_prescritas} séries · sem prescrição`;
  }

  const tituloPrimeiraColuna = primeiraColunaTitulo(exercicio);
  const contemUnidadeTempo = /(s\b|min|tempo|seg|segundo|sec)/i.test(
    prescricaoBruta,
  );
  const somenteNumero = /^\d+(?:[.,]\d+)?$/.test(prescricaoBruta);

  if (tituloPrimeiraColuna === "Tempo (s)") {
    const valorTempo = somenteNumero ? `${prescricaoBruta}s` : prescricaoBruta;
    return `${exercicio.numero_series_prescritas} séries de ${valorTempo}`;
  }

  const valorReps =
    somenteNumero && !contemUnidadeTempo
      ? `${prescricaoBruta} reps`
      : prescricaoBruta;
  return `${exercicio.numero_series_prescritas} séries de ${valorReps}`;
}

export function SessaoTreinoScreen({ route, navigation }: Props) {
  const { treinoId, treinoCodigo, treinoNome } = route.params;
  const sessaoAtivaParam = route.params.sessaoAtiva;
  const queryClient = useQueryClient();

  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [series, setSeries] = useState<SerieLocal[]>([]);
  const [sessaoAtivaInicializada, setSessaoAtivaInicializada] = useState(false);
  const [observacoesAbertas, setObservacoesAbertas] = useState<
    Record<string, boolean>
  >({});
  const [observacaoTreinoAluno, setObservacaoTreinoAluno] = useState("");
  const [observacoesAlunoExercicio, setObservacoesAlunoExercicio] = useState<
    Record<string, string>
  >({});

  const { data: exercicios, isLoading } = useQuery<ExercicioTreino[]>({
    queryKey: ["aluno", "treino", treinoId, "exercicios"],
    queryFn: async () => {
      const res = await api.get(`/aluno/treinos/${treinoId}/exercicios`);
      return res.data;
    },
  });

  const { data: treinosAtivos } = useQuery<Treino[]>({
    queryKey: ["aluno", "conjunto-ativo", "treinos"],
    queryFn: async () => {
      const res = await api.get("/aluno/me/conjunto-ativo/treinos");
      return res.data;
    },
  });

  const { data: sessaoAtivaAtual } = useQuery<SessaoAtiva | null>({
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
    enabled: !sessaoId,
    refetchOnWindowFocus: false,
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

  useEffect(() => {
    if (!exercicios?.length) return;
    setObservacoesAlunoExercicio((current) => {
      const next = { ...current };
      exercicios.forEach((exercicio) => {
        if (next[exercicio.id] === undefined) {
          next[exercicio.id] = exercicio.observacoes_aluno ?? "";
        }
      });
      return next;
    });
  }, [exercicios]);

  useEffect(() => {
    if (!treinosAtivos?.length) return;
    const treinoAtual = treinosAtivos.find((treino) => treino.id === treinoId);
    if (!treinoAtual) return;
    setObservacaoTreinoAluno(treinoAtual.observacoes_aluno ?? "");
  }, [treinosAtivos, treinoId]);

  const iniciarMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<SessaoTreino>("/aluno/sessoes", {
        treino_id: treinoId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSessaoId(data.id);
      const startedAt = parseApiDateToMs(data.iniciado_em);
      setSessionStartMs(startedAt);
      setSessionElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
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

  const finalizarSessaoConflitanteMutation = useMutation({
    mutationFn: async (sessaoIdConflitante: string) => {
      await api.patch(`/aluno/sessoes/${sessaoIdConflitante}/finalizar`);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível concluir o treino em andamento.");
    },
  });

  const descartarSessaoConflitanteMutation = useMutation({
    mutationFn: async (sessaoIdConflitante: string) => {
      await api.delete(`/aluno/sessoes/${sessaoIdConflitante}`);
    },
  });

  function descartarSessaoConflitanteEIniciar(sessaoIdConflitante: string) {
    descartarSessaoConflitanteMutation.mutate(sessaoIdConflitante, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["aluno", "sessao-ativa"],
        });
        iniciarMutation.mutate();
      },
      onError: (err: any) => {
        // Se a sessão já não existe mais como ativa (stale cache), seguimos o fluxo normalmente.
        if (err?.response?.status === 404) {
          queryClient.invalidateQueries({
            queryKey: ["aluno", "sessao-ativa"],
          });
          iniciarMutation.mutate();
          return;
        }

        Alert.alert(
          "Erro",
          "Não foi possível descartar o treino em andamento.",
        );
      },
    });
  }

  function iniciarTreinoComValidacao() {
    const sessaoConflitante =
      sessaoAtivaAtual && sessaoAtivaAtual.treino_id !== treinoId
        ? sessaoAtivaAtual
        : null;

    if (!sessaoConflitante) {
      iniciarMutation.mutate();
      return;
    }

    Alert.alert(
      "Você possui um treino em andamento.",
      "Escolha o que fazer com o treino atual:",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => {
            descartarSessaoConflitanteEIniciar(sessaoConflitante.id);
          },
        },
        {
          text: "Concluir atual",
          onPress: () => {
            finalizarSessaoConflitanteMutation.mutate(sessaoConflitante.id, {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: ["aluno", "sessao-ativa"],
                });
                iniciarMutation.mutate();
              },
            });
          },
        },
      ],
    );
  }

  // Retomar sessão ativa vinda dos params
  useEffect(() => {
    if (!sessaoAtivaParam || !exercicios?.length || sessaoAtivaInicializada) {
      return;
    }

    setSessaoId(sessaoAtivaParam.id);
    const startedAt = parseApiDateToMs(sessaoAtivaParam.iniciado_em);
    setSessionStartMs(startedAt);
    setSessionElapsedSeconds(
      Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    );

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
            serieId: registrada.id,
            exercicio_treino_id: exercicio.id,
            numero_serie: i + 1,
            peso:
              registrada.peso_utilizado != null
                ? String(registrada.peso_utilizado)
                : "",
            reps:
              registrada.repeticoes_realizadas != null
                ? String(registrada.repeticoes_realizadas)
                : "",
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
    setSessaoAtivaInicializada(true);
  }, [sessaoAtivaParam, exercicios, sessaoAtivaInicializada]);

  useEffect(() => {
    if (!sessaoId || !sessionStartMs) return;

    const updateElapsed = () => {
      setSessionElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - sessionStartMs) / 1000)),
      );
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [sessaoId, sessionStartMs]);

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

  function toggleObservacoes(exercicioId: string) {
    setObservacoesAbertas((current) => ({
      ...current,
      [exercicioId]: !current[exercicioId],
    }));
  }

  const serieMutation = useMutation({
    mutationFn: async (body: SerieCreate) => {
      const res = await api.post(`/aluno/sessoes/${sessaoId}/series`, body);
      return res.data;
    },
    onError: () => {
      Alert.alert("Erro", "Falha ao salvar série.");
    },
  });

  const excluirSerieMutation = useMutation({
    mutationFn: async (serieId: string) => {
      await api.delete(`/aluno/sessoes/${sessaoId}/series/${serieId}`);
    },
  });

  const salvarObservacaoTreinoMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/aluno/treinos/${treinoId}/observacoes-aluno`, {
        observacoes_aluno: observacaoTreinoAluno,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["aluno", "conjunto-ativo", "treinos"],
      });
      Alert.alert("Sucesso", "Observação do treino salva.");
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível salvar a observação do treino.");
    },
  });

  const salvarObservacaoExercicioMutation = useMutation({
    mutationFn: async (exercicioId: string) => {
      await api.patch(`/aluno/exercicios/${exercicioId}/observacoes-aluno`, {
        observacoes_aluno: observacoesAlunoExercicio[exercicioId] ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["aluno", "treino", treinoId, "exercicios"],
      });
      Alert.alert("Sucesso", "Observação do exercício salva.");
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível salvar a observação do exercício.");
    },
  });

  function renumerarSeries(seriesAtuais: SerieLocal[]) {
    const contadores: Record<string, number> = {};
    return seriesAtuais.map((serie) => {
      const atual = (contadores[serie.exercicio_treino_id] ?? 0) + 1;
      contadores[serie.exercicio_treino_id] = atual;
      return {
        ...serie,
        numero_serie: atual,
      };
    });
  }

  function marcarSerieConcluida(serie: SerieLocal) {
    if (!serie.peso && !serie.reps) {
      Alert.alert("Preencha ao menos um campo", "Informe peso ou repetições.");
      return;
    }

    setSeries((current) =>
      current.map((item) =>
        item.localId === serie.localId
          ? { ...item, concluida: true, deleting: true }
          : item,
      ),
    );

    serieMutation.mutate(
      {
        exercicio_treino_id: serie.exercicio_treino_id,
        numero_serie: serie.numero_serie,
        peso_utilizado: serie.peso ? Number(serie.peso) : undefined,
        repeticoes_realizadas: serie.reps ? Number(serie.reps) : undefined,
        concluida: true,
      },
      {
        onSuccess: (savedSerie) => {
          setSeries((current) =>
            current.map((item) =>
              item.localId === serie.localId
                ? { ...item, serieId: savedSerie.id, deleting: false }
                : item,
            ),
          );
        },
        onError: () => {
          setSeries((current) =>
            current.map((item) =>
              item.localId === serie.localId
                ? { ...item, concluida: false, deleting: false }
                : item,
            ),
          );
        },
      },
    );
  }

  function desmarcarSerieConcluida(serie: SerieLocal) {
    if (serie.deleting) return;

    if (!serie.serieId) {
      setSeries((current) =>
        current.map((item) =>
          item.localId === serie.localId ? { ...item, concluida: false } : item,
        ),
      );
      return;
    }

    setSeries((current) =>
      current.map((item) =>
        item.localId === serie.localId ? { ...item, deleting: true } : item,
      ),
    );

    excluirSerieMutation.mutate(serie.serieId, {
      onSuccess: () => {
        setSeries((current) =>
          current.map((item) =>
            item.localId === serie.localId
              ? {
                  ...item,
                  concluida: false,
                  serieId: undefined,
                  deleting: false,
                }
              : item,
          ),
        );
      },
      onError: () => {
        setSeries((current) =>
          current.map((item) =>
            item.localId === serie.localId
              ? { ...item, deleting: false }
              : item,
          ),
        );
        Alert.alert("Erro", "Não foi possível desmarcar a série.");
      },
    });
  }

  function toggleSerieConcluida(serie: SerieLocal) {
    if (serie.concluida) {
      desmarcarSerieConcluida(serie);
      return;
    }
    marcarSerieConcluida(serie);
  }

  function excluirSerieConfirmada(serie: SerieLocal) {
    if (serie.deleting) return;

    if (!serie.serieId) {
      setSeries((current) =>
        renumerarSeries(
          current.filter((item) => item.localId !== serie.localId),
        ),
      );
      return;
    }

    setSeries((current) =>
      current.map((item) =>
        item.localId === serie.localId ? { ...item, deleting: true } : item,
      ),
    );

    excluirSerieMutation.mutate(serie.serieId, {
      onSuccess: () => {
        setSeries((current) =>
          renumerarSeries(
            current.filter((item) => item.localId !== serie.localId),
          ),
        );
      },
      onError: () => {
        setSeries((current) =>
          current.map((item) =>
            item.localId === serie.localId
              ? { ...item, deleting: false }
              : item,
          ),
        );
        Alert.alert("Erro", "Não foi possível excluir a série.");
      },
    });
  }

  function excluirSerie(serie: SerieLocal) {
    Alert.alert(
      "Excluir série?",
      "Essa ação remove esta série da sessão atual.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => excluirSerieConfirmada(serie),
        },
      ],
    );
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
        {!!(treinoNome ?? sessaoAtivaParam?.treino_nome) && (
          <Text style={styles.iniciarNomeTreino}>
            {treinoNome ?? sessaoAtivaParam?.treino_nome}
          </Text>
        )}
        <Text style={styles.iniciarSub}>
          {exercicios?.length ?? 0} exercícios
        </Text>

        <View style={styles.alunoObsCardPreStart}>
          <Text style={styles.alunoObsLabel}>Observação do aluno (treino)</Text>
          <TextInput
            style={styles.alunoObsInput}
            multiline
            placeholder="Escreva uma observação sobre este treino"
            placeholderTextColor="#666"
            value={observacaoTreinoAluno}
            onChangeText={setObservacaoTreinoAluno}
          />
          <TouchableOpacity
            style={styles.alunoObsSaveBtn}
            onPress={() => salvarObservacaoTreinoMutation.mutate()}
            disabled={salvarObservacaoTreinoMutation.isPending}
          >
            <Text style={styles.alunoObsSaveText}>
              {salvarObservacaoTreinoMutation.isPending
                ? "Salvando..."
                : "Salvar observação"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview de exercícios */}
        {exercicios && exercicios.length > 0 && (
          <View style={styles.previewContainer}>
            {exercicios.map((ex, idx) => (
              <View key={ex.id} style={styles.previewItem}>
                <Text style={styles.previewOrder}>{idx + 1}</Text>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{ex.nome_exercicio}</Text>
                  <Text style={styles.previewDetail}>
                    {formatarPrescricaoPrincipal(ex)}
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
          style={[
            styles.button,
            { marginTop: 24, alignSelf: "stretch", marginHorizontal: 16 },
          ]}
          onPress={iniciarTreinoComValidacao}
          disabled={
            iniciarMutation.isPending ||
            finalizarSessaoConflitanteMutation.isPending ||
            descartarSessaoConflitanteMutation.isPending
          }
        >
          {iniciarMutation.isPending ||
          finalizarSessaoConflitanteMutation.isPending ||
          descartarSessaoConflitanteMutation.isPending ? (
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
        <View style={styles.alunoObsCardSessao}>
          <Text style={styles.alunoObsLabel}>Observação do aluno (treino)</Text>
          <TextInput
            style={styles.alunoObsInput}
            multiline
            placeholder="Escreva uma observação sobre este treino"
            placeholderTextColor="#666"
            value={observacaoTreinoAluno}
            onChangeText={setObservacaoTreinoAluno}
          />
          <TouchableOpacity
            style={styles.alunoObsSaveBtn}
            onPress={() => salvarObservacaoTreinoMutation.mutate()}
            disabled={salvarObservacaoTreinoMutation.isPending}
          >
            <Text style={styles.alunoObsSaveText}>
              {salvarObservacaoTreinoMutation.isPending
                ? "Salvando..."
                : "Salvar observação"}
            </Text>
          </TouchableOpacity>
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
                {formatarPrescricaoPrincipal(exercicio)}
              </Text>
              <Text style={styles.exercicioMetaSecundaria}>
                {`Descanso: ${formatarDescanso(exercicio.descanso_segundos)}`}
              </Text>
              {exercicio.rer_rm_valor ? (
                <Text style={styles.exercicioMetaTerciaria}>
                  {`ROR/RM: ${exercicio.rer_rm_valor}`}
                </Text>
              ) : null}

              <View style={styles.alunoObsExercicioBox}>
                <Text style={styles.alunoObsLabel}>Sua observação</Text>
                <TextInput
                  style={styles.alunoObsInput}
                  multiline
                  placeholder="Escreva uma observação sobre este exercício"
                  placeholderTextColor="#666"
                  value={observacoesAlunoExercicio[exercicio.id] ?? ""}
                  onChangeText={(texto) =>
                    setObservacoesAlunoExercicio((current) => ({
                      ...current,
                      [exercicio.id]: texto,
                    }))
                  }
                />
                <TouchableOpacity
                  style={styles.alunoObsSaveBtn}
                  onPress={() =>
                    salvarObservacaoExercicioMutation.mutate(exercicio.id)
                  }
                  disabled={salvarObservacaoExercicioMutation.isPending}
                >
                  <Text style={styles.alunoObsSaveText}>
                    {salvarObservacaoExercicioMutation.isPending
                      ? "Salvando..."
                      : "Salvar observação"}
                  </Text>
                </TouchableOpacity>
              </View>

              {exercicio.observacoes?.trim() ? (
                <View style={styles.observacoesBox}>
                  <TouchableOpacity
                    onPress={() => toggleObservacoes(exercicio.id)}
                    style={styles.observacoesToggle}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.observacoesTitulo}>Observações</Text>
                    <Text style={styles.observacoesAcao}>+</Text>
                  </TouchableOpacity>

                  {observacoesAbertas[exercicio.id] ? (
                    <Text style={styles.observacoesTexto}>
                      {exercicio.observacoes}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.seriesHeaderRow}>
                <Text style={styles.serieNumHeaderSpacer}> </Text>
                <Text
                  style={[styles.seriesHeaderTitle, styles.seriesHeaderInput]}
                >
                  {primeiraColunaTitulo(exercicio)}
                </Text>
                <Text
                  style={[styles.seriesHeaderTitle, styles.seriesHeaderInput]}
                >
                  Carga (kg)
                </Text>
                <View style={styles.seriesHeaderActionsSpacer} />
              </View>

              {seriesDoExercicio.map((serie) => (
                <View key={serie.localId} style={styles.serieRow}>
                  <Text style={styles.serieNum}>
                    SÉRIE {serie.numero_serie}
                  </Text>
                  <TextInput
                    style={styles.serieInput}
                    placeholder={
                      primeiraColunaTitulo(exercicio) === "Tempo (s)"
                        ? "s"
                        : "reps"
                    }
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={serie.reps}
                    onChangeText={(v) => updateSerie(serie.localId, "reps", v)}
                    editable={!serie.concluida && !serie.deleting}
                  />
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
                    editable={!serie.concluida && !serie.deleting}
                  />
                  <View style={styles.serieActions}>
                    <TouchableOpacity
                      onPress={() => toggleSerieConcluida(serie)}
                      disabled={Boolean(serie.deleting)}
                      hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                      style={[
                        styles.checkbox,
                        serie.concluida ? styles.checkboxChecked : undefined,
                        serie.deleting ? styles.checkboxBusy : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.checkboxIcon,
                          serie.concluida
                            ? styles.checkboxIconChecked
                            : undefined,
                        ]}
                      >
                        ✓
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => excluirSerie(serie)}
                      disabled={Boolean(serie.deleting)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>
                        {serie.deleting ? "..." : "X"}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
  iniciarNomeTreino: {
    color: "#d4d4d4",
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 18,
  },
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
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  previewOrder: {
    color: "#6ee7b7",
    fontSize: 13,
    fontWeight: "700",
    width: 22,
    textAlign: "center",
    marginTop: 1,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  previewDetail: {
    color: "#7d7d7d",
    fontSize: 14,
    marginTop: 2,
  },
  timerHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  alunoObsCardPreStart: {
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  alunoObsCardSessao: {
    marginTop: 10,
  },
  alunoObsExercicioBox: {
    marginBottom: 10,
  },
  alunoObsLabel: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  alunoObsInput: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 8,
    color: "#fff",
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontSize: 13,
  },
  alunoObsSaveBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#1f2b22",
    borderWidth: 1,
    borderColor: "#245132",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alunoObsSaveText: {
    color: "#9fe6b4",
    fontSize: 12,
    fontWeight: "600",
  },
  timerCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#232323",
  },
  timerLabel: { color: "#a3a3a3", fontSize: 12 },
  timerValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
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
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  exercicioMetaSecundaria: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 2,
  },
  exercicioMetaTerciaria: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 8,
  },
  observacoesBox: {
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 8,
    backgroundColor: "#101010",
    marginBottom: 8,
  },
  observacoesToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  observacoesTitulo: {
    color: "#d4d4d4",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  observacoesAcao: {
    color: "#22c55e",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 18,
  },
  observacoesTexto: {
    color: "#e5e5e5",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  seriesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 2,
    gap: 8,
  },
  serieNumHeaderSpacer: {
    width: 68,
  },
  seriesHeaderTitle: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  seriesHeaderInput: {
    flex: 1,
    textAlign: "center",
  },
  seriesHeaderActionsSpacer: {
    width: 72,
  },
  serieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  serieNum: { color: "#22c55e", fontWeight: "bold", width: 68, fontSize: 12 },
  serieInput: {
    backgroundColor: "#0d0d0d",
    color: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1,
    textAlign: "center",
    fontSize: 15,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#6b7280",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f232a",
  },
  checkboxChecked: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  checkboxBusy: {
    opacity: 0.6,
  },
  checkboxIcon: {
    color: "#9ca3af",
    fontSize: 18,
    fontWeight: "900",
  },
  checkboxIconChecked: {
    color: "#0d0d0d",
  },
  serieActions: {
    width: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 8,
    backgroundColor: "#151515",
  },
  deleteButtonText: {
    color: "#a3a3a3",
    fontSize: 13,
    fontWeight: "700",
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
