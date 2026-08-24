import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { keys } from "../../api/queryKeys";
import { alunoService } from "../../api/services/aluno";
import type {
  ExercicioTreino,
  SessaoAtiva,
  SerieCreate,
  Treino,
  UltimoPesoExercicio,
} from "@ecg/types";
import type { AlunoTreinoStackParamList } from "../../navigation/AlunoNavigator";
import { formatarIntervaloDescanso } from "../../utils/formatters";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<AlunoTreinoStackParamList, "SessaoTreino">;

interface SerieLocal {
  localId: string;
  serieId?: string;
  exercicio_treino_id: string;
  exercicio_treino_executado_id?: string;
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
  if (exercicio.alvo_tipo === "SEGUNDOS") return "Tempo (s)";
  if (exercicio.alvo_tipo === "PASSOS") return "Passos";
  return "Reps";
}

function placeholderPrimeiraColuna(
  exercicio: ExercicioTreino,
  ultimoValor: number | null | undefined,
) {
  if (ultimoValor != null) {
    return String(ultimoValor);
  }

  if (exercicio.alvo_tipo === "SEGUNDOS") return "s";
  if (exercicio.alvo_tipo === "PASSOS") return "passos";
  return "reps";
}

function formatarPrescricaoPrincipal(exercicio: ExercicioTreino) {
  if (exercicio.alvo_tipo === "OUTROS") {
    const descricao = exercicio.alvo_outros_texto?.trim() || "sem alvo";
    return `${exercicio.numero_series_prescritas} séries · ${descricao}`;
  }

  if (exercicio.alvo_valor_min == null || exercicio.alvo_valor_max == null) {
    return `${exercicio.numero_series_prescritas} séries · sem prescrição`;
  }

  const unidade =
    exercicio.alvo_tipo === "SEGUNDOS"
      ? "s"
      : exercicio.alvo_tipo === "PASSOS"
        ? " passos"
        : " reps";

  const alvoTexto =
    exercicio.alvo_valor_min === exercicio.alvo_valor_max
      ? `${exercicio.alvo_valor_min}${unidade}`
      : `${exercicio.alvo_valor_min}-${exercicio.alvo_valor_max}${unidade}`;

  return `${exercicio.numero_series_prescritas} séries de ${alvoTexto}`;
}

function criarSeriePendente(
  exercicioId: string,
  numeroSerie: number,
  exercicioExecutadoId?: string,
) {
  return {
    localId: `${exercicioId}-${numeroSerie}-${Date.now()}-${Math.random()}`,
    exercicio_treino_id: exercicioId,
    exercicio_treino_executado_id: exercicioExecutadoId,
    numero_serie: numeroSerie,
    peso: "",
    reps: "",
    concluida: false,
  };
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
  const [substituicoesExercicio, setSubstituicoesExercicio] = useState<
    Record<string, string>
  >({});
  const [exercicioSubstituicaoAbertoId, setExercicioSubstituicaoAbertoId] =
    useState<string | null>(null);
  const [observacaoTreinoAluno, setObservacaoTreinoAluno] = useState("");
  const [observacoesAlunoExercicio, setObservacoesAlunoExercicio] = useState<
    Record<string, string>
  >({});
  const [
    observacoesAlunoExercicioAbertas,
    setObservacoesAlunoExercicioAbertas,
  ] = useState<Record<string, boolean>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const ultimaObservacaoTreinoSalvaRef = useRef("");
  const observacoesExercicioSalvasRef = useRef<Record<string, string>>({});
  const debounceObservacaoTreinoRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const debounceObservacoesExercicioRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const listaExerciciosRef = useRef<FlatList<any>>(null);

  function focarObservacaoExercicio(index: number) {
    // Aguarda um frame para o teclado iniciar a animacao antes do scroll.
    setTimeout(() => {
      listaExerciciosRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.15,
      });
    }, 120);
  }

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const { data: exercicios, isLoading } = useQuery<ExercicioTreino[]>({
    queryKey: keys.aluno.treinoExercicios(treinoId),
    queryFn: () => alunoService.treinoExercicios(treinoId),
  });

  const exerciciosPorId = useMemo(() => {
    const mapa = new Map<string, ExercicioTreino>();
    (exercicios ?? []).forEach((exercicio) => {
      mapa.set(exercicio.id, exercicio);
    });
    return mapa;
  }, [exercicios]);

  function obterExercicioAtivo(
    exercicioBase: ExercicioTreino,
    exercicioExecutadoId?: string | null,
  ) {
    const idAtivo =
      exercicioExecutadoId ??
      substituicoesExercicio[exercicioBase.id] ??
      exercicioBase.id;
    return exerciciosPorId.get(idAtivo) ?? exercicioBase;
  }

  function ajustarSeriesParaExercicioAtivo(
    seriesAtuais: SerieLocal[],
    exercicioBaseId: string,
    exercicioExecutadoId?: string,
  ) {
    const exercicioBase = exerciciosPorId.get(exercicioBaseId);
    if (!exercicioBase) return seriesAtuais;

    const exercicioAtivo =
      exerciciosPorId.get(exercicioExecutadoId ?? exercicioBaseId) ??
      exercicioBase;
    const quantidadeDesejada = Math.max(
      1,
      exercicioAtivo.numero_series_prescritas,
    );

    const outrasSeries = seriesAtuais.filter(
      (serie) => serie.exercicio_treino_id !== exercicioBaseId,
    );
    const seriesDoExercicio = seriesAtuais.filter(
      (serie) => serie.exercicio_treino_id === exercicioBaseId,
    );

    const seriesPendentesOrdenadas = [...seriesDoExercicio]
      .filter((serie) => !serie.concluida)
      .sort((a, b) => a.numero_serie - b.numero_serie);

    const novasSeriesDoExercicio: SerieLocal[] = [];
    for (let i = 0; i < quantidadeDesejada; i += 1) {
      const existente = seriesPendentesOrdenadas[i];
      if (existente) {
        novasSeriesDoExercicio.push({
          ...existente,
          numero_serie: i + 1,
          exercicio_treino_executado_id: exercicioExecutadoId,
        });
        continue;
      }

      novasSeriesDoExercicio.push(
        criarSeriePendente(exercicioBaseId, i + 1, exercicioExecutadoId),
      );
    }

    return [...outrasSeries, ...novasSeriesDoExercicio];
  }

  const { data: treinosAtivos } = useQuery<Treino[]>({
    queryKey: keys.aluno.conjuntoAtivoTreinos(),
    queryFn: () => alunoService.conjuntoAtivoTreinos(),
  });

  const { data: sessaoAtivaAtual, isLoading: loadingSessaoAtivaAtual } =
    useQuery<SessaoAtiva | null>({
      queryKey: keys.aluno.sessaoAtiva(),
      queryFn: async () => {
        try {
          return await alunoService.sessaoAtiva();
        } catch (err: any) {
          if (err.response?.status === 404) return null;
          throw err;
        }
      },
      enabled: !sessaoId,
      refetchOnWindowFocus: false,
    });

  const sessaoAtivaParaRetomar = sessaoAtivaParam ?? null;

  const { data: ultimosPesos = {} } = useQuery<
    Record<string, UltimoPesoExercicio>
  >({
    queryKey: keys.aluno.ultimosPesos(treinoId),
    enabled: !!exercicios?.length,
    queryFn: async () => {
      const responses = await Promise.all(
        (exercicios ?? []).map(async (exercicio) => {
          const ultimoPeso = await alunoService.ultimoPeso(exercicio.id);
          return [exercicio.id, ultimoPeso] as const;
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

        if (observacoesExercicioSalvasRef.current[exercicio.id] === undefined) {
          observacoesExercicioSalvasRef.current[exercicio.id] =
            exercicio.observacoes_aluno ?? "";
        }
      });
      return next;
    });

    setObservacoesAlunoExercicioAbertas((current) => {
      const next = { ...current };
      exercicios.forEach((exercicio) => {
        if (next[exercicio.id] === undefined) {
          next[exercicio.id] = false;
        }
      });
      return next;
    });
  }, [exercicios]);

  useEffect(() => {
    if (!treinosAtivos?.length) return;
    const treinoAtual = treinosAtivos.find((treino) => treino.id === treinoId);
    if (!treinoAtual) return;
    const observacaoAtual = treinoAtual.observacoes_aluno ?? "";
    setObservacaoTreinoAluno(observacaoAtual);
    ultimaObservacaoTreinoSalvaRef.current = observacaoAtual;
  }, [treinosAtivos, treinoId]);

  const iniciarMutation = useMutation({
    mutationFn: () => alunoService.iniciarSessao(treinoId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: keys.aluno.sessaoAtiva(),
      });

      setSessaoId(data.id);
      setSubstituicoesExercicio({});
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
            iniciais.push(criarSeriePendente(exercicio.id, i + 1));
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
      await alunoService.finalizarSessao(sessaoIdConflitante);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível concluir o treino em andamento.");
    },
  });

  const descartarSessaoConflitanteMutation = useMutation({
    mutationFn: (sessaoIdConflitante: string) =>
      alunoService.descartarSessao(sessaoIdConflitante),
  });

  function descartarSessaoConflitanteEIniciar(sessaoIdConflitante: string) {
    descartarSessaoConflitanteMutation.mutate(sessaoIdConflitante, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: keys.aluno.sessaoAtiva(),
        });
        iniciarMutation.mutate();
      },
      onError: (err: any) => {
        // Se a sessão já não existe mais como ativa (stale cache), seguimos o fluxo normalmente.
        if (err?.response?.status === 404) {
          queryClient.invalidateQueries({
            queryKey: keys.aluno.sessaoAtiva(),
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
    if (loadingSessaoAtivaAtual) {
      return;
    }

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
                  queryKey: keys.aluno.sessaoAtiva(),
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
    if (
      !sessaoAtivaParaRetomar ||
      !exercicios?.length ||
      sessaoAtivaInicializada
    ) {
      return;
    }

    setSessaoId(sessaoAtivaParaRetomar.id);
    const startedAt = parseApiDateToMs(sessaoAtivaParaRetomar.iniciado_em);
    setSessionStartMs(startedAt);
    setSessionElapsedSeconds(
      Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    );

    // Restaurar séries já registradas e criar as pendentes
    const seriesLocal: SerieLocal[] = [];
    const seriesJaRegistradas = sessaoAtivaParaRetomar.series || [];
    const substituicoesIniciais: Record<string, string> = {};

    (exercicios ?? []).forEach((exercicio) => {
      const registradas = seriesJaRegistradas.filter(
        (s) => s.exercicio_treino_id === exercicio.id,
      );
      const exercicioExecutadoRestauradoId =
        registradas.find((s) => s.exercicio_treino_executado_id)
          ?.exercicio_treino_executado_id ?? exercicio.id;
      const exercicioAtivo =
        exerciciosPorId.get(exercicioExecutadoRestauradoId) ?? exercicio;
      const quantidade = Math.max(
        exercicioAtivo.numero_series_prescritas,
        registradas.length,
      );

      for (let i = 0; i < quantidade; i += 1) {
        const registrada = registradas.find((s) => s.numero_serie === i + 1);
        if (registrada) {
          if (registrada.exercicio_treino_executado_id) {
            substituicoesIniciais[exercicio.id] =
              registrada.exercicio_treino_executado_id;
          }
          seriesLocal.push({
            localId: `${exercicio.id}-${i + 1}-restored-${Math.random()}`,
            serieId: registrada.id,
            exercicio_treino_id: exercicio.id,
            exercicio_treino_executado_id:
              registrada.exercicio_treino_executado_id ?? undefined,
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
          seriesLocal.push(
            criarSeriePendente(
              exercicio.id,
              i + 1,
              substituicoesIniciais[exercicio.id],
            ),
          );
        }
      }
    });

    setSeries(seriesLocal);
    setSubstituicoesExercicio(substituicoesIniciais);
    setSessaoAtivaInicializada(true);
  }, [
    sessaoAtivaParaRetomar,
    exercicios,
    exerciciosPorId,
    sessaoAtivaInicializada,
  ]);

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
      await alunoService.finalizarSessao(sessaoId!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: keys.aluno.sessaoAtiva(),
      });
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
      const exercicioExecutadoId =
        substituicoesExercicio[exercicio.id] ??
        seriesDoExercicio.find((serie) => serie.exercicio_treino_executado_id)
          ?.exercicio_treino_executado_id ??
        exercicio.id;
      const exercicioAtivo = obterExercicioAtivo(
        exercicio,
        exercicioExecutadoId,
      );
      const concluido =
        seriesDoExercicio.length > 0 &&
        seriesDoExercicio.every((serie) => serie.concluida);

      return {
        exercicio,
        exercicioAtivo,
        seriesDoExercicio,
        concluido,
      };
    });
  }, [exercicios, exerciciosPorId, series, substituicoesExercicio]);

  const exercicioSubstituicaoAberto = useMemo(
    () =>
      (exercicios ?? []).find(
        (exercicio) => exercicio.id === exercicioSubstituicaoAbertoId,
      ) ?? null,
    [exercicios, exercicioSubstituicaoAbertoId],
  );

  function adicionarSerie(exercicioId: string) {
    const seriesDoExercicio = series.filter(
      (serie) => serie.exercicio_treino_id === exercicioId,
    );

    setSeries((current) => [
      ...current,
      {
        localId: `${exercicioId}-${seriesDoExercicio.length + 1}-${Date.now()}-${Math.random()}`,
        exercicio_treino_id: exercicioId,
        exercicio_treino_executado_id: substituicoesExercicio[exercicioId],
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

  function toggleObservacaoAlunoExercicio(exercicioId: string) {
    setObservacoesAlunoExercicioAbertas((current) => ({
      ...current,
      [exercicioId]: !current[exercicioId],
    }));
  }

  function abrirSelecaoSubstituicao(exercicioId: string) {
    const existeSerieConcluida = series.some(
      (serie) => serie.exercicio_treino_id === exercicioId && serie.concluida,
    );

    if (existeSerieConcluida) {
      Alert.alert(
        "Substituição bloqueada",
        "Não é possível alterar o exercício após concluir séries.",
      );
      return;
    }

    setExercicioSubstituicaoAbertoId(exercicioId);
  }

  function selecionarSubstituicaoExercicio(
    exercicioId: string,
    exercicioExecutadoId: string,
  ) {
    const idExecutadoNormalizado =
      exercicioExecutadoId === exercicioId ? undefined : exercicioExecutadoId;

    setSubstituicoesExercicio((current) => {
      const next = { ...current };
      if (!idExecutadoNormalizado) {
        delete next[exercicioId];
      } else {
        next[exercicioId] = idExecutadoNormalizado;
      }
      return next;
    });

    setSeries((current) =>
      ajustarSeriesParaExercicioAtivo(
        current,
        exercicioId,
        idExecutadoNormalizado,
      ),
    );

    setExercicioSubstituicaoAbertoId(null);
  }

  const serieMutation = useMutation({
    mutationFn: (body: SerieCreate) =>
      alunoService.registrarSerie(sessaoId!, body),
    onError: () => {
      Alert.alert("Erro", "Falha ao salvar série.");
    },
  });

  const excluirSerieMutation = useMutation({
    mutationFn: (serieId: string) => alunoService.excluirSerie(sessaoId!, serieId),
  });

  const salvarObservacaoTreinoMutation = useMutation({
    mutationFn: async (observacoesAluno: string) => {
      await alunoService.atualizarObsTreino(treinoId, observacoesAluno);
    },
    onSuccess: (_, observacoesAluno) => {
      ultimaObservacaoTreinoSalvaRef.current = observacoesAluno;
      queryClient.setQueryData<Treino[]>(
        keys.aluno.conjuntoAtivoTreinos(),
        (current) =>
          current?.map((treino) =>
            treino.id === treinoId
              ? { ...treino, observacoes_aluno: observacoesAluno }
              : treino,
          ) ?? current,
      );
    },
  });

  const salvarObservacaoExercicioMutation = useMutation({
    mutationFn: async ({
      exercicioId,
      observacoesAluno,
    }: {
      exercicioId: string;
      observacoesAluno: string;
    }) => {
      await alunoService.atualizarObsExercicio(exercicioId, observacoesAluno);
    },
    onSuccess: (_, vars) => {
      observacoesExercicioSalvasRef.current[vars.exercicioId] =
        vars.observacoesAluno;
      delete debounceObservacoesExercicioRef.current[vars.exercicioId];
      queryClient.setQueryData<ExercicioTreino[]>(
        keys.aluno.treinoExercicios(treinoId),
        (current) =>
          current?.map((exercicio) =>
            exercicio.id === vars.exercicioId
              ? { ...exercicio, observacoes_aluno: vars.observacoesAluno }
              : exercicio,
          ) ?? current,
      );
    },
  });

  function atualizarObservacaoTreinoComDebounce(texto: string) {
    setObservacaoTreinoAluno(texto);

    if (debounceObservacaoTreinoRef.current) {
      clearTimeout(debounceObservacaoTreinoRef.current);
    }

    debounceObservacaoTreinoRef.current = setTimeout(() => {
      if (texto !== ultimaObservacaoTreinoSalvaRef.current) {
        salvarObservacaoTreinoMutation.mutate(texto);
      }
    }, 1000);
  }

  function atualizarObservacaoExercicioComDebounce(
    exercicioId: string,
    texto: string,
  ) {
    setObservacoesAlunoExercicio((current) => ({
      ...current,
      [exercicioId]: texto,
    }));

    const timerExistente = debounceObservacoesExercicioRef.current[exercicioId];
    if (timerExistente) {
      clearTimeout(timerExistente);
    }

    debounceObservacoesExercicioRef.current[exercicioId] = setTimeout(() => {
      const observacaoSalva =
        observacoesExercicioSalvasRef.current[exercicioId] ?? "";
      if (texto !== observacaoSalva) {
        salvarObservacaoExercicioMutation.mutate({
          exercicioId,
          observacoesAluno: texto,
        });
      }
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (debounceObservacaoTreinoRef.current) {
        clearTimeout(debounceObservacaoTreinoRef.current);
      }

      Object.values(debounceObservacoesExercicioRef.current).forEach(
        (timer) => {
          clearTimeout(timer);
        },
      );
    };
  }, []);

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
        exercicio_treino_executado_id: serie.exercicio_treino_executado_id,
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
                ? {
                    ...item,
                    serieId: (savedSerie as { id: string }).id,
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!sessaoId) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.preStartContainer,
            { paddingBottom: 32 + keyboardHeight },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
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
            <Text style={styles.alunoObsLabel}>
              Observação do aluno (treino)
            </Text>
            <TextInput
              style={styles.alunoObsInput}
              multiline
              placeholder="Escreva uma observação sobre este treino"
              placeholderTextColor={colors.textMuted}
              value={observacaoTreinoAluno}
              onChangeText={atualizarObservacaoTreinoComDebounce}
            />
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
              loadingSessaoAtivaAtual ||
              iniciarMutation.isPending ||
              finalizarSessaoConflitanteMutation.isPending ||
              descartarSessaoConflitanteMutation.isPending
            }
          >
            {iniciarMutation.isPending ||
            finalizarSessaoConflitanteMutation.isPending ||
            descartarSessaoConflitanteMutation.isPending ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Iniciar Treino</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={styles.timerHeader}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Duração da sessão</Text>
            <Text style={styles.timerValue}>
              {formatTime(sessionElapsedSeconds)}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listaExerciciosRef}
          data={exerciciosComEstado}
          keyExtractor={(item) => item.exercicio.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 180 : 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          onScrollToIndexFailed={(info) => {
            const fallbackOffset = Math.max(
              0,
              info.index * info.averageItemLength - info.averageItemLength,
            );
            listaExerciciosRef.current?.scrollToOffset({
              offset: fallbackOffset,
              animated: true,
            });

            setTimeout(() => {
              listaExerciciosRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.15,
              });
            }, 140);
          }}
          renderItem={({ item, index }) => {
            const { exercicio, exercicioAtivo, seriesDoExercicio, concluido } =
              item;
            const usandoEquivalente = exercicioAtivo.id !== exercicio.id;

            return (
              <View
                style={[
                  styles.exercicioCard,
                  concluido ? styles.exercicioCardDone : undefined,
                ]}
              >
                <View style={styles.exercicioHeader}>
                  <Text style={styles.exercicioNome}>
                    {exercicioAtivo.nome_exercicio}
                  </Text>
                  <Text
                    style={concluido ? styles.badgeDone : styles.badgePending}
                  >
                    {concluido ? "Concluído" : "Pendente"}
                  </Text>
                </View>
                {usandoEquivalente ? (
                  <Text style={styles.exercicioNomeSecundario}>
                    {`Bloco do treino: ${exercicio.nome_exercicio}`}
                  </Text>
                ) : null}
                <Text style={styles.exercicioDetalhe}>
                  {formatarPrescricaoPrincipal(exercicioAtivo)}
                </Text>
                <Text style={styles.exercicioMetaSecundaria}>
                  {`Descanso: ${formatarIntervaloDescanso(
                    exercicioAtivo.descanso_segundos_min,
                    exercicioAtivo.descanso_segundos_max,
                    exercicioAtivo.descanso_segundos,
                  )}`}
                </Text>
                {exercicioAtivo.rer_rm_tipo && exercicioAtivo.rer_rm_valor ? (
                  <Text style={styles.exercicioMetaTerciaria}>
                    {`RER/RM: ${exercicioAtivo.rer_rm_tipo} ${exercicioAtivo.rer_rm_valor}`}
                  </Text>
                ) : null}

                {exercicio.equivalentes.length > 0 ? (
                  <View style={styles.substituicaoBox}>
                    <TouchableOpacity
                      style={styles.substituicaoBtn}
                      onPress={() => abrirSelecaoSubstituicao(exercicio.id)}
                    >
                      <Text style={styles.substituicaoBtnText}>
                        Trocar exercício do bloco
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.substituicaoResumo}>
                      {`Exercício ativo: ${exercicioAtivo.nome_exercicio}`}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.alunoObsExercicioBox}>
                  <TouchableOpacity
                    style={styles.observacoesToggle}
                    onPress={() => toggleObservacaoAlunoExercicio(exercicio.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.alunoObsLabel}>Sua observação</Text>
                    <Text style={styles.observacoesAcao}>
                      {observacoesAlunoExercicioAbertas[exercicio.id]
                        ? "-"
                        : "+"}
                    </Text>
                  </TouchableOpacity>
                  {observacoesAlunoExercicioAbertas[exercicio.id] ? (
                    <TextInput
                      style={styles.alunoObsInput}
                      multiline
                      placeholder="Escreva uma observação sobre este exercício"
                      placeholderTextColor={colors.textMuted}
                      value={observacoesAlunoExercicio[exercicio.id] ?? ""}
                      onFocus={() => focarObservacaoExercicio(index)}
                      onChangeText={(texto) =>
                        atualizarObservacaoExercicioComDebounce(
                          exercicio.id,
                          texto,
                        )
                      }
                    />
                  ) : null}
                </View>

                {exercicioAtivo.observacoes?.trim() ? (
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
                        {`Obs: ${exercicioAtivo.observacoes}`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.seriesHeaderRow}>
                  <Text style={styles.serieNumHeaderSpacer}> </Text>
                  <Text
                    style={[styles.seriesHeaderTitle, styles.seriesHeaderInput]}
                  >
                    {primeiraColunaTitulo(exercicioAtivo)}
                  </Text>
                  <Text
                    style={[styles.seriesHeaderTitle, styles.seriesHeaderInput]}
                  >
                    Carga (kg)
                  </Text>
                  <View style={styles.seriesHeaderActionsSpacer} />
                </View>

                {seriesDoExercicio.map((serie: SerieLocal) => (
                  <View key={serie.localId} style={styles.serieRow}>
                    <Text style={styles.serieNum}>
                      SÉRIE {serie.numero_serie}
                    </Text>
                    <TextInput
                      style={styles.serieInput}
                      placeholder={placeholderPrimeiraColuna(
                        exercicioAtivo,
                        ultimosPesos[exercicioAtivo.id]?.repeticoes_realizadas,
                      )}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={serie.reps}
                      onChangeText={(v) =>
                        updateSerie(serie.localId, "reps", v)
                      }
                      editable={!serie.concluida && !serie.deleting}
                    />
                    <TextInput
                      style={styles.serieInput}
                      placeholder={
                        ultimosPesos[exercicioAtivo.id]?.peso_utilizado != null
                          ? String(
                              ultimosPesos[exercicioAtivo.id]?.peso_utilizado,
                            )
                          : "kg"
                      }
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={serie.peso}
                      onChangeText={(v) =>
                        updateSerie(serie.localId, "peso", v)
                      }
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

        {keyboardHeight === 0 ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
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
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.buttonText}>Finalizar Sessão</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <Modal
          visible={Boolean(exercicioSubstituicaoAberto)}
          transparent
          animationType="fade"
          onRequestClose={() => setExercicioSubstituicaoAbertoId(null)}
        >
          <Pressable
            style={styles.substituicaoModalOverlay}
            onPress={() => setExercicioSubstituicaoAbertoId(null)}
          >
            <Pressable
              style={styles.substituicaoModalContent}
              onPress={() => {}}
            >
              <Text style={styles.substituicaoModalTitle}>
                Selecionar exercício do bloco
              </Text>
              <Text style={styles.substituicaoModalSubTitle}>
                {exercicioSubstituicaoAberto?.nome_exercicio}
              </Text>

              {exercicioSubstituicaoAberto ? (
                <>
                  <TouchableOpacity
                    style={styles.substituicaoOpcao}
                    onPress={() =>
                      selecionarSubstituicaoExercicio(
                        exercicioSubstituicaoAberto.id,
                        exercicioSubstituicaoAberto.id,
                      )
                    }
                  >
                    <Text style={styles.substituicaoOpcaoNome}>
                      {`Usar ${exercicioSubstituicaoAberto.nome_exercicio}`}
                    </Text>
                    <Text style={styles.substituicaoOpcaoHint}>
                      Mesmo exercício do bloco
                    </Text>
                  </TouchableOpacity>

                  {exercicioSubstituicaoAberto.equivalentes.map(
                    (equivalente) => {
                      const exercicioEquivalente = exerciciosPorId.get(
                        equivalente.exercicio_equivalente_treino_id,
                      );

                      return (
                        <TouchableOpacity
                          key={equivalente.id}
                          style={styles.substituicaoOpcao}
                          onPress={() =>
                            selecionarSubstituicaoExercicio(
                              exercicioSubstituicaoAberto.id,
                              equivalente.exercicio_equivalente_treino_id,
                            )
                          }
                        >
                          <Text style={styles.substituicaoOpcaoNome}>
                            {exercicioEquivalente?.nome_exercicio ??
                              equivalente.nome_exercicio}
                          </Text>
                          <Text style={styles.substituicaoOpcaoHint}>
                            {exercicioEquivalente
                              ? formatarPrescricaoPrincipal(
                                  exercicioEquivalente,
                                )
                              : "Equivalente"}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 32,
  },
  iniciarTitle: { color: colors.text, fontSize: 32, fontWeight: "bold" },
  iniciarNomeTreino: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 18,
  },
  iniciarSub: { color: colors.textMuted, fontSize: 16, marginTop: 8, marginBottom: 16 },
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
    color: colors.primary,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  previewDetail: {
    color: colors.textMuted,
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
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  alunoObsInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontSize: 13,
  },
  alunoObsSaveBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alunoObsSaveText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerLabel: { color: colors.textMuted, fontSize: 12 },
  timerValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  content: { paddingBottom: 100, paddingTop: 2 },
  exercicioCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exercicioCardDone: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  exercicioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgePending: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "600",
  },
  badgeDone: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  exercicioNome: { color: colors.text, fontSize: 16, fontWeight: "bold", flex: 1 },
  exercicioNomeSecundario: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  exercicioDetalhe: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  exercicioMetaSecundaria: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  exercicioMetaTerciaria: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  substituicaoBox: {
    marginBottom: 10,
  },
  substituicaoBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  substituicaoBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  substituicaoResumo: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 6,
  },
  observacoesBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
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
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  observacoesAcao: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 18,
  },
  observacoesTexto: {
    color: colors.text,
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
    color: colors.textMuted,
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
  serieNum: { color: colors.primary, fontWeight: "bold", width: 68, fontSize: 12 },
  serieInput: {
    backgroundColor: colors.background,
    color: colors.text,
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
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxBusy: {
    opacity: 0.6,
  },
  checkboxIcon: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "900",
  },
  checkboxIconChecked: {
    color: colors.background,
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
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  deleteButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  addSerie: { marginTop: 10, alignSelf: "flex-start" },
  addSerieText: { color: colors.primary, fontSize: 14 },
  substituicaoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  substituicaoModalContent: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  substituicaoModalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  substituicaoModalSubTitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  substituicaoOpcao: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  substituicaoOpcaoNome: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  substituicaoOpcaoHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: { padding: 16 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "bold" },
});
