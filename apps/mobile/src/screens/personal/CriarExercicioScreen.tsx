import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { keys } from "../../api/queryKeys";
import { catalogoService } from "../../api/services/catalogo";
import { personalService } from "../../api/services/personal";
import type {
  AlvoTipo,
  AlunoRecursoDisponibilidade,
  ExercicioTreinoCreate,
  ExercicioTreino,
  ExercicioBase,
  RerRmTipo,
} from "@ecg/types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import { formatarImplementoExecucao } from "../../utils/formatters";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<PersonalStackParamList, "CriarExercicio">;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const ALVO_TIPOS: AlvoTipo[] = ["REPETICOES", "SEGUNDOS", "PASSOS", "OUTROS"];

const RER_RM_OPCOES: Array<RerRmTipo | "NONE"> = ["NONE", "RER", "RM"];

const ALVO_TIPO_LABEL: Record<AlvoTipo, string> = {
  REPETICOES: "Repetições",
  SEGUNDOS: "Segundos",
  PASSOS: "Passos",
  OUTROS: "Outros",
};

const OBSERVACOES_MIN_HEIGHT = 80;
const OBSERVACOES_MAX_HEIGHT = 320;
const OBSERVACOES_LINE_HEIGHT = 22;
const OBSERVACOES_CHARS_PER_LINE = 38;

function estimarAlturaObservacoes(texto: string): number {
  if (!texto.trim()) return OBSERVACOES_MIN_HEIGHT;

  const linhasEstimadas = texto
    .split("\n")
    .reduce(
      (total, linha) =>
        total +
        Math.max(1, Math.ceil(linha.length / OBSERVACOES_CHARS_PER_LINE)),
      0,
    );

  const altura =
    OBSERVACOES_MIN_HEIGHT + (linhasEstimadas - 1) * OBSERVACOES_LINE_HEIGHT;
  return Math.min(
    OBSERVACOES_MAX_HEIGHT,
    Math.max(OBSERVACOES_MIN_HEIGHT, altura),
  );
}

export function CriarExercicioScreen({ route, navigation }: Props) {
  const { alunoId, treinoId, exercicioData } = route.params;
  const isEditMode = !!exercicioData;
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(
    exercicioData?.nome_exercicio ?? "",
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAlvoTipoDropdown, setShowAlvoTipoDropdown] = useState(false);
  const [alvoMinInput, setAlvoMinInput] = useState(
    exercicioData?.alvo_valor_min != null
      ? String(exercicioData.alvo_valor_min)
      : exercicioData?.alvo_tipo === "OUTROS"
        ? ""
        : "8",
  );
  const [alvoMaxInput, setAlvoMaxInput] = useState(
    exercicioData?.alvo_valor_max != null
      ? String(exercicioData.alvo_valor_max)
      : exercicioData?.alvo_tipo === "OUTROS"
        ? ""
        : "12",
  );
  const [seriesPrescritasInput, setSeriesPrescritasInput] = useState(
    exercicioData?.numero_series_prescritas != null
      ? String(exercicioData.numero_series_prescritas)
      : "3",
  );
  const [descansoMinInput, setDescansoMinInput] = useState(
    exercicioData?.descanso_segundos_min != null
      ? String(exercicioData.descanso_segundos_min)
      : exercicioData?.descanso_segundos != null
        ? String(exercicioData.descanso_segundos)
        : "60",
  );
  const [descansoMaxInput, setDescansoMaxInput] = useState(
    exercicioData?.descanso_segundos_max != null
      ? String(exercicioData.descanso_segundos_max)
      : exercicioData?.descanso_segundos != null
        ? String(exercicioData.descanso_segundos)
        : "60",
  );
  const [observacoesInputHeight, setObservacoesInputHeight] = useState(() =>
    estimarAlturaObservacoes(exercicioData?.observacoes ?? ""),
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const formScrollRef = useRef<ScrollView>(null);
  const debouncedSearch = useDebounce(searchText, 300);

  const scrollToFormEnd = useCallback(() => {
    setTimeout(() => {
      formScrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const hasFloatingPanelsOpen = showDropdown || showAlvoTipoDropdown;

  const closeFloatingPanels = useCallback(() => {
    setShowDropdown(false);
    setShowAlvoTipoDropdown(false);
  }, []);

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

  const { control, handleSubmit, setValue, watch } =
    useForm<ExercicioTreinoCreate>({
      defaultValues: {
        exercicio_base_id: exercicioData?.exercicio_base_id ?? "",
        numero_series_prescritas: exercicioData?.numero_series_prescritas ?? 3,
        alvo_tipo: exercicioData?.alvo_tipo ?? "REPETICOES",
        alvo_valor_min: exercicioData?.alvo_valor_min ?? 8,
        alvo_valor_max: exercicioData?.alvo_valor_max ?? 12,
        alvo_outros_texto: exercicioData?.alvo_outros_texto ?? "",
        rer_rm_tipo: exercicioData?.rer_rm_tipo ?? undefined,
        rer_rm_valor: exercicioData?.rer_rm_valor ?? "",
        descanso_segundos:
          exercicioData?.descanso_segundos_max ??
          exercicioData?.descanso_segundos ??
          60,
        descanso_segundos_min:
          exercicioData?.descanso_segundos_min ??
          exercicioData?.descanso_segundos ??
          60,
        descanso_segundos_max:
          exercicioData?.descanso_segundos_max ??
          exercicioData?.descanso_segundos ??
          60,
        tecnica: exercicioData?.tecnica ?? "PADRAO",
        observacoes: exercicioData?.observacoes ?? "",
      },
    });

  const selectedExercicioBaseId = watch("exercicio_base_id");
  const alvoTipo = watch("alvo_tipo");
  const rerRmTipo = watch("rer_rm_tipo");
  const tecnica = watch("tecnica");

  useEffect(() => {
    if (tecnica === "ISOMETRIA" && alvoTipo !== "SEGUNDOS") {
      setValue("alvo_tipo", "SEGUNDOS");
      setValue("alvo_outros_texto", "");
    }
  }, [tecnica, alvoTipo, setValue]);

  const { data: existingExercicios } = useQuery<ExercicioTreino[]>({
    queryKey: keys.personal.treinoExercicios(treinoId),
    queryFn: () => personalService.treinoExercicios(treinoId),
    enabled: !isEditMode,
  });

  const { data: exerciciosBase } = useQuery<ExercicioBase[]>({
    queryKey: keys.catalogo.exerciciosBase(),
    queryFn: () => catalogoService.exerciciosBase(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: recursosAluno, isLoading: loadingRecursosAluno } = useQuery<
    AlunoRecursoDisponibilidade[]
  >({
    queryKey: keys.personal.alunoRecursos(alunoId),
    queryFn: () => personalService.alunoRecursos(alunoId),
  });

  const disponibilidadeRecursos = useMemo(() => {
    const mapa: Record<string, boolean> = {};
    for (const item of recursosAluno ?? []) {
      mapa[item.recurso_treino_id] = item.disponivel_para_aluno;
    }
    return mapa;
  }, [recursosAluno]);

  const avaliarRecursosExercicio = useCallback(
    (exercicio: ExercicioBase) => {
      const requisitos = exercicio.requisitos_alternativos_recurso;

      if (requisitos.length === 0) {
        return {
          disponivel: true,
          texto: "",
          cor: "neutro" as const,
        };
      }

      if (loadingRecursosAluno) {
        return {
          disponivel: true,
          texto: "Verificando disponibilidade de recursos...",
          cor: "neutro" as const,
        };
      }

      const possuiAlgumRecurso = requisitos.some(
        (recurso) => disponibilidadeRecursos[recurso.id],
      );
      const nomesRequisitos = requisitos.map((r) => r.nome).join(" ou ");

      if (possuiAlgumRecurso) {
        return {
          disponivel: true,
          texto: `Requisitos: ${nomesRequisitos}`,
          cor: "disponivel" as const,
        };
      }

      return {
        disponivel: false,
        texto: `Aluno não possui os recursos: ${nomesRequisitos}`,
        cor: "indisponivel" as const,
      };
    },
    [disponibilidadeRecursos, loadingRecursosAluno],
  );

  const exercicioSelecionado = useMemo(
    () =>
      exerciciosBase?.find((item) => item.id === selectedExercicioBaseId) ??
      null,
    [exerciciosBase, selectedExercicioBaseId],
  );

  const statusExercicioSelecionado = useMemo(
    () =>
      exercicioSelecionado
        ? avaliarRecursosExercicio(exercicioSelecionado)
        : null,
    [exercicioSelecionado, avaliarRecursosExercicio],
  );

  const filteredExercicios = useMemo(() => {
    if (!exerciciosBase || !debouncedSearch.trim()) return [];
    const term = debouncedSearch.toLowerCase();
    return exerciciosBase.filter(
      (ex) =>
        ex.nome.toLowerCase().includes(term) ||
        ex.grupo_muscular.toLowerCase().includes(term) ||
        ex.implemento_execucao.toLowerCase().includes(term) ||
        ex.requisitos_alternativos_recurso
          .map((r) => r.nome)
          .join(" ")
          .toLowerCase()
          .includes(term),
    );
  }, [exerciciosBase, debouncedSearch]);

  const handleSelectExercicio = useCallback(
    (ex: ExercicioBase) => {
      setValue("exercicio_base_id", ex.id);
      setSearchText(ex.nome);
      closeFloatingPanels();
      Keyboard.dismiss();
    },
    [closeFloatingPanels, setValue],
  );

  const createMutation = useMutation({
    mutationFn: async (data: ExercicioTreinoCreate) => {
      const nextOrdem = (existingExercicios?.length ?? 0) + 1;
      await personalService.criarExercicio(treinoId, {
        ...data,
        ordem: nextOrdem,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keys.personal.treinoExercicios(treinoId),
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível criar o exercício.",
      );
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: ExercicioTreinoCreate) => {
      await personalService.editarExercicio(exercicioData!.id, {
        exercicio_base_id: data.exercicio_base_id,
        numero_series_prescritas: data.numero_series_prescritas,
        alvo_tipo: data.alvo_tipo,
        alvo_valor_min: data.alvo_valor_min ?? null,
        alvo_valor_max: data.alvo_valor_max ?? null,
        alvo_outros_texto: data.alvo_outros_texto || null,
        rer_rm_tipo: data.rer_rm_tipo ?? null,
        rer_rm_valor: data.rer_rm_valor || null,
        descanso_segundos:
          data.descanso_segundos_max ?? data.descanso_segundos ?? null,
        descanso_segundos_min: data.descanso_segundos_min ?? null,
        descanso_segundos_max: data.descanso_segundos_max ?? null,
        tecnica: data.tecnica,
        observacoes: data.observacoes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keys.personal.treinoExercicios(treinoId),
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível atualizar o exercício.",
      );
    },
  });

  const onSubmit = (data: ExercicioTreinoCreate) => {
    const payload: ExercicioTreinoCreate = {
      ...data,
      rer_rm_valor: data.rer_rm_valor?.trim() || undefined,
      alvo_outros_texto: data.alvo_outros_texto?.trim() || undefined,
      observacoes: data.observacoes?.trim() || undefined,
      descanso_segundos: undefined,
      descanso_segundos_min: undefined,
      descanso_segundos_max: undefined,
    };

    const seriesPrescritas = parseInt(seriesPrescritasInput.trim(), 10);
    if (!Number.isInteger(seriesPrescritas) || seriesPrescritas < 1) {
      Alert.alert("Atenção", "Informe um número de séries válido (mínimo 1).");
      return;
    }
    payload.numero_series_prescritas = seriesPrescritas;

    const descansoMinTexto = descansoMinInput.trim();
    const descansoMaxTexto = descansoMaxInput.trim();
    if (!descansoMinTexto && !descansoMaxTexto) {
      payload.descanso_segundos = undefined;
      payload.descanso_segundos_min = undefined;
      payload.descanso_segundos_max = undefined;
    } else {
      if (!descansoMinTexto || !descansoMaxTexto) {
        Alert.alert(
          "Atenção",
          "Informe os dois valores de descanso (mínimo e máximo).",
        );
        return;
      }

      const descansoMin = parseInt(descansoMinTexto, 10);
      const descansoMax = parseInt(descansoMaxTexto, 10);
      if (!Number.isInteger(descansoMin) || !Number.isInteger(descansoMax)) {
        Alert.alert("Atenção", "Informe descanso mínimo e máximo válidos.");
        return;
      }
      if (descansoMin < 0 || descansoMax < 0) {
        Alert.alert("Atenção", "Descanso deve ser 0 ou maior.");
        return;
      }
      if (descansoMin > descansoMax) {
        Alert.alert(
          "Atenção",
          "O descanso mínimo não pode ser maior que o máximo.",
        );
        return;
      }
      payload.descanso_segundos_min = descansoMin;
      payload.descanso_segundos_max = descansoMax;
      payload.descanso_segundos = descansoMax;
    }

    if (payload.alvo_tipo === "OUTROS") {
      if (!payload.alvo_outros_texto) {
        Alert.alert(
          "Atenção",
          "Informe o texto do alvo quando o tipo for OUTROS.",
        );
        return;
      }
      payload.alvo_valor_min = undefined;
      payload.alvo_valor_max = undefined;
    } else {
      const minimo = parseInt(alvoMinInput.trim(), 10);
      const maximo = parseInt(alvoMaxInput.trim(), 10);
      if (!Number.isInteger(minimo) || !Number.isInteger(maximo)) {
        Alert.alert("Atenção", "Informe alvo mínimo e máximo válidos.");
        return;
      }
      if (minimo <= 0 || maximo <= 0) {
        Alert.alert(
          "Atenção",
          "Alvo mínimo e máximo devem ser maiores que zero.",
        );
        return;
      }
      if (minimo > maximo) {
        Alert.alert(
          "Atenção",
          "O alvo mínimo não pode ser maior que o máximo.",
        );
        return;
      }
      payload.alvo_valor_min = minimo;
      payload.alvo_valor_max = maximo;
      payload.alvo_outros_texto = undefined;
    }

    if (payload.rer_rm_tipo && !payload.rer_rm_valor) {
      Alert.alert("Atenção", "Informe o valor de RER/RM.");
      return;
    }

    if (!payload.rer_rm_tipo) {
      payload.rer_rm_valor = undefined;
    }

    if (statusExercicioSelecionado && !statusExercicioSelecionado.disponivel) {
      Alert.alert(
        "Recurso indisponível",
        "Este aluno não possui os recursos exigidos para o exercício selecionado. Deseja tentar salvar mesmo assim?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Salvar mesmo assim",
            style: "destructive",
            onPress: () => {
              if (isEditMode) {
                editMutation.mutate(payload);
              } else {
                createMutation.mutate(payload);
              }
            },
          },
        ],
      );
      return;
    }

    if (isEditMode) {
      editMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || editMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior="height"
      enabled={Platform.OS !== "ios"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={formScrollRef}
        style={styles.container}
        contentContainerStyle={{
          position: "relative",
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 56 : 48,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={closeFloatingPanels}
      >
        {hasFloatingPanelsOpen ? (
          <Pressable
            style={styles.floatingBackdrop}
            onPress={() => {
              closeFloatingPanels();
              Keyboard.dismiss();
            }}
          />
        ) : null}

        <View style={styles.searchBlock}>
          <Text style={styles.label}>Exercício</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.input}
              placeholder="Buscar exercício..."
              placeholderTextColor={colors.border}
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setShowAlvoTipoDropdown(false);
                setShowDropdown(true);
                if (!text.trim()) {
                  setValue("exercicio_base_id", "");
                }
              }}
              onFocus={() => {
                setShowAlvoTipoDropdown(false);
                if (searchText.trim()) setShowDropdown(true);
              }}
            />
            {selectedExercicioBaseId ? (
              <View
                style={[
                  styles.selectedBadge,
                  statusExercicioSelecionado &&
                  !statusExercicioSelecionado.disponivel
                    ? styles.selectedBadgeInvalid
                    : styles.selectedBadgeValid,
                ]}
              >
                <Text style={styles.selectedBadgeText}>
                  {statusExercicioSelecionado &&
                  !statusExercicioSelecionado.disponivel
                    ? "X"
                    : "✓"}
                </Text>
              </View>
            ) : null}
          </View>

          {showDropdown && filteredExercicios.length > 0 && (
            <View style={styles.dropdown}>
              {filteredExercicios.slice(0, 8).map((ex) => {
                const statusRecursos = avaliarRecursosExercicio(ex);

                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectExercicio(ex)}
                  >
                    <Text style={styles.dropdownNome}>{ex.nome}</Text>
                    <Text style={styles.dropdownGrupo}>
                      {ex.grupo_muscular} ·{" "}
                      {formatarImplementoExecucao(ex.implemento_execucao)}
                    </Text>
                    {statusRecursos.texto ? (
                      <Text
                        style={[
                          styles.dropdownRecurso,
                          statusRecursos.cor === "indisponivel"
                            ? styles.dropdownRecursoIndisponivel
                            : statusRecursos.cor === "disponivel"
                              ? styles.dropdownRecursoDisponivel
                              : styles.dropdownRecursoNeutro,
                        ]}
                      >
                        {statusRecursos.texto}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {statusExercicioSelecionado &&
          !statusExercicioSelecionado.disponivel ? (
            <View style={styles.recursoAlertaBox}>
              <Text style={styles.recursoAlertaTitulo}>
                Recurso indisponível
              </Text>
              <Text style={styles.recursoAlertaTexto}>
                {statusExercicioSelecionado.texto}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.label}>Repetições/tempo</Text>
        <View style={styles.alvoInlineRow}>
          <View style={styles.inlineNumericContainer}>
            <Text style={styles.inlineHint}>MIN</Text>
            <TextInput
              style={[
                styles.inlineNumericInput,
                alvoTipo === "OUTROS" && styles.inlineNumericDisabled,
              ]}
              placeholder="0"
              placeholderTextColor={colors.border}
              keyboardType="numeric"
              editable={alvoTipo !== "OUTROS"}
              value={alvoMinInput}
              onChangeText={setAlvoMinInput}
            />
          </View>

          <Text style={styles.inlineRangeSeparator}>-</Text>

          <View style={styles.inlineNumericContainer}>
            <Text style={styles.inlineHint}>MAX</Text>
            <TextInput
              style={[
                styles.inlineNumericInput,
                alvoTipo === "OUTROS" && styles.inlineNumericDisabled,
              ]}
              placeholder="0"
              placeholderTextColor={colors.border}
              keyboardType="numeric"
              editable={alvoTipo !== "OUTROS"}
              value={alvoMaxInput}
              onChangeText={setAlvoMaxInput}
            />
          </View>

          <View style={styles.alvoTipoContainer}>
            <Text style={styles.inlineHint}>TIPO</Text>
            <TouchableOpacity
              style={styles.alvoTipoTrigger}
              onPress={() => {
                Keyboard.dismiss();
                setShowDropdown(false);
                setShowAlvoTipoDropdown((current) => !current);
              }}
            >
              <Text style={styles.alvoTipoTriggerText}>
                {ALVO_TIPO_LABEL[alvoTipo]}
              </Text>
              <Text style={styles.alvoTipoTriggerChevron}>▾</Text>
            </TouchableOpacity>

            {showAlvoTipoDropdown ? (
              <View style={styles.alvoTipoMenu}>
                {ALVO_TIPOS.map((tipo) => (
                  <TouchableOpacity
                    key={tipo}
                    style={styles.alvoTipoMenuItem}
                    onPress={() => {
                      setValue("alvo_tipo", tipo);
                      if (tipo === "OUTROS") {
                        setAlvoMinInput("");
                        setAlvoMaxInput("");
                        setValue("alvo_valor_min", undefined);
                        setValue("alvo_valor_max", undefined);
                      } else {
                        if (!alvoMinInput.trim()) setAlvoMinInput("8");
                        if (!alvoMaxInput.trim()) setAlvoMaxInput("12");
                        setValue("alvo_outros_texto", "");
                      }
                      setShowAlvoTipoDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.alvoTipoMenuText,
                        alvoTipo === tipo && styles.alvoTipoMenuTextActive,
                      ]}
                    >
                      {ALVO_TIPO_LABEL[tipo]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {alvoTipo === "OUTROS" ? (
          <Controller
            control={control}
            name="alvo_outros_texto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Descreva o alvo"
                placeholderTextColor={colors.border}
                value={value ?? ""}
                onChangeText={onChange}
              />
            )}
          />
        ) : null}

        <View style={styles.compactFieldsRow}>
          <View style={styles.compactField}>
            <Text style={styles.labelCompact}>Séries prescritas</Text>
            <Text style={styles.inlineHintPlaceholder}>MIN</Text>
            <TextInput
              style={styles.inputCompact}
              placeholder="3"
              placeholderTextColor={colors.border}
              keyboardType="numeric"
              value={seriesPrescritasInput}
              onChangeText={setSeriesPrescritasInput}
            />
          </View>

          <View style={styles.compactField}>
            <Text style={styles.labelCompact}>Descanso (s)</Text>
            <View style={styles.compactRangeRow}>
              <View style={styles.inlineNumericContainer}>
                <Text style={styles.inlineHint}>MIN</Text>
                <TextInput
                  style={styles.inputHalf}
                  placeholder="0"
                  placeholderTextColor={colors.border}
                  keyboardType="numeric"
                  value={descansoMinInput}
                  onChangeText={setDescansoMinInput}
                />
              </View>

              <Text style={styles.inlineRangeSeparator}>-</Text>

              <View style={styles.inlineNumericContainer}>
                <Text style={styles.inlineHint}>MAX</Text>
                <TextInput
                  style={styles.inputHalf}
                  placeholder="0"
                  placeholderTextColor={colors.border}
                  keyboardType="numeric"
                  value={descansoMaxInput}
                  onChangeText={setDescansoMaxInput}
                />
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.label}>RER / RM</Text>
        <View style={styles.row}>
          {RER_RM_OPCOES.map((tipo) => (
            <TouchableOpacity
              key={tipo}
              style={[
                styles.chip,
                (tipo === "NONE" ? !rerRmTipo : rerRmTipo === tipo) &&
                  styles.chipActive,
              ]}
              onPress={() => {
                if (tipo === "NONE") {
                  setValue("rer_rm_tipo", undefined);
                  setValue("rer_rm_valor", "");
                  return;
                }
                setValue("rer_rm_tipo", tipo);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  (tipo === "NONE" ? !rerRmTipo : rerRmTipo === tipo) &&
                    styles.chipTextActive,
                ]}
              >
                {tipo === "NONE" ? "Sem RER/RM" : tipo}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {rerRmTipo ? (
          <Controller
            control={control}
            name="rer_rm_valor"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder={rerRmTipo === "RER" ? "Ex.: 2" : "Ex.: 85%"}
                placeholderTextColor={colors.border}
                value={value ?? ""}
                onFocus={scrollToFormEnd}
                onChangeText={onChange}
              />
            )}
          />
        ) : null}

        <Text style={styles.label}>Técnica</Text>
        <View style={styles.row}>
          {(["PADRAO", "ISOMETRIA", "INSTABILIDADE"] as const).map((t) => (
            <Controller
              key={t}
              control={control}
              name="tecnica"
              render={({ field: { onChange, value } }) => (
                <TouchableOpacity
                  style={[styles.chip, value === t && styles.chipActive]}
                  onPress={() => {
                    onChange(t);

                    if (t === "PADRAO") {
                      setValue("alvo_tipo", "REPETICOES");
                      setValue("alvo_outros_texto", "");
                      return;
                    }

                    if (t === "ISOMETRIA") {
                      setValue("alvo_tipo", "SEGUNDOS");
                      setValue("alvo_outros_texto", "");
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      value === t && styles.chipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ))}
        </View>

        <Text style={styles.label}>Observações</Text>
        <Controller
          control={control}
          name="observacoes"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[
                styles.observacoesInput,
                {
                  minHeight: OBSERVACOES_MIN_HEIGHT,
                  height: Math.min(
                    OBSERVACOES_MAX_HEIGHT,
                    Math.max(OBSERVACOES_MIN_HEIGHT, observacoesInputHeight),
                  ),
                  lineHeight: OBSERVACOES_LINE_HEIGHT,
                  textAlignVertical: "top",
                },
              ]}
              placeholder="Observações..."
              placeholderTextColor={colors.border}
              multiline
              scrollEnabled={false}
              value={value ?? ""}
              onFocus={scrollToFormEnd}
              onChangeText={(texto) => {
                onChange(texto);
                setObservacoesInputHeight(estimarAlturaObservacoes(texto));
              }}
            />
          )}
        />

        <TouchableOpacity
          style={[
            styles.button,
            !selectedExercicioBaseId && styles.buttonDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          disabled={!selectedExercicioBaseId || isPending}
        >
          <Text style={styles.buttonText}>
            {isPending
              ? "Salvando..."
              : isEditMode
                ? "Salvar Alterações"
                : "Criar Exercício"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 16 },
  floatingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.001)",
    zIndex: 30,
    elevation: 10,
  },
  searchBlock: {
    zIndex: 60,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  observacoesInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
  },
  selectedBadge: {
    marginLeft: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeValid: {
    backgroundColor: colors.primary,
  },
  selectedBadgeInvalid: {
    backgroundColor: colors.danger,
  },
  selectedBadgeText: { color: colors.text, fontWeight: "700" },
  dropdown: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownNome: { color: colors.text, fontSize: 15, fontWeight: "600" },
  dropdownGrupo: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  dropdownRecurso: { fontSize: 12, marginTop: 3 },
  dropdownRecursoDisponivel: { color: colors.primary },
  dropdownRecursoIndisponivel: { color: colors.danger },
  dropdownRecursoNeutro: { color: colors.textMuted },
  recursoAlertaBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recursoAlertaTitulo: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  recursoAlertaTexto: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  alvoInlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  alvoTipoContainer: {
    flex: 1,
    zIndex: 40,
    position: "relative",
  },
  inlineNumericContainer: {
    flex: 1,
  },
  inlineRangeSeparator: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 26,
    marginHorizontal: -2,
  },
  inlineHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  inlineHintPlaceholder: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 4,
    opacity: 0,
  },
  alvoTipoTrigger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alvoTipoTriggerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  alvoTipoTriggerChevron: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  alvoTipoMenu: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  alvoTipoMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  alvoTipoMenuText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  alvoTipoMenuTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  inlineNumericInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
  },
  inlineNumericDisabled: {
    opacity: 0.45,
  },
  compactFieldsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  compactField: {
    flex: 1,
  },
  compactRangeRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  labelCompact: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputCompact: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSplit: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  inputHalf: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  button: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "700" },
});
