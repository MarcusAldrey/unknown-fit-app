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

import api from "../../api/client";
import type {
  AlvoTipo,
  AlunoRecursoDisponibilidade,
  ExercicioTreinoCreate,
  ExercicioTreino,
  ExercicioBase,
  RerRmTipo,
} from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import { formatarImplementoExecucao } from "../../utils/formatters";

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
  const [descansoInput, setDescansoInput] = useState(
    exercicioData?.descanso_segundos != null
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
        descanso_segundos: exercicioData?.descanso_segundos ?? 60,
        tecnica: exercicioData?.tecnica ?? "PADRAO",
        observacoes: exercicioData?.observacoes ?? "",
      },
    });

  const selectedExercicioBaseId = watch("exercicio_base_id");
  const alvoTipo = watch("alvo_tipo");
  const rerRmTipo = watch("rer_rm_tipo");

  const { data: existingExercicios } = useQuery<ExercicioTreino[]>({
    queryKey: ["personal", "treino", treinoId, "exercicios"],
    queryFn: async () => {
      const res = await api.get(`/personal/treinos/${treinoId}/exercicios`);
      return res.data;
    },
    enabled: !isEditMode,
  });

  const { data: exerciciosBase } = useQuery<ExercicioBase[]>({
    queryKey: ["catalogo", "exercicios-base"],
    queryFn: async () => {
      const res = await api.get("/catalogo/exercicios-base");
      return res.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: recursosAluno, isLoading: loadingRecursosAluno } = useQuery<
    AlunoRecursoDisponibilidade[]
  >({
    queryKey: ["personal", "aluno", alunoId, "recursos-treino"],
    queryFn: async () => {
      const res = await api.get(`/personal/alunos/${alunoId}/recursos-treino`);
      return res.data;
    },
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
      setShowDropdown(false);
      Keyboard.dismiss();
    },
    [setValue],
  );

  const createMutation = useMutation({
    mutationFn: async (data: ExercicioTreinoCreate) => {
      const nextOrdem = (existingExercicios?.length ?? 0) + 1;
      await api.post(`/personal/treinos/${treinoId}/exercicios`, {
        ...data,
        ordem: nextOrdem,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
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
      await api.patch(`/personal/exercicios/${exercicioData!.id}`, {
        exercicio_base_id: data.exercicio_base_id,
        numero_series_prescritas: data.numero_series_prescritas,
        alvo_tipo: data.alvo_tipo,
        alvo_valor_min: data.alvo_valor_min ?? null,
        alvo_valor_max: data.alvo_valor_max ?? null,
        alvo_outros_texto: data.alvo_outros_texto || null,
        rer_rm_tipo: data.rer_rm_tipo ?? null,
        rer_rm_valor: data.rer_rm_valor || null,
        descanso_segundos: data.descanso_segundos || null,
        tecnica: data.tecnica,
        observacoes: data.observacoes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
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
    };

    const seriesPrescritas = parseInt(seriesPrescritasInput.trim(), 10);
    if (!Number.isInteger(seriesPrescritas) || seriesPrescritas < 1) {
      Alert.alert("Atenção", "Informe um número de séries válido (mínimo 1).");
      return;
    }
    payload.numero_series_prescritas = seriesPrescritas;

    const descansoTexto = descansoInput.trim();
    if (!descansoTexto) {
      payload.descanso_segundos = undefined;
    } else {
      const descansoValor = parseInt(descansoTexto, 10);
      if (!Number.isInteger(descansoValor) || descansoValor < 0) {
        Alert.alert("Atenção", "Informe um descanso válido (0 ou maior).");
        return;
      }
      payload.descanso_segundos = descansoValor;
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
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 56 : 48,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.label}>Exercício</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.input}
            placeholder="Buscar exercício..."
            placeholderTextColor="#555"
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              setShowDropdown(true);
              if (!text.trim()) {
                setValue("exercicio_base_id", "");
              }
            }}
            onFocus={() => {
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
            <Text style={styles.recursoAlertaTitulo}>Recurso indisponível</Text>
            <Text style={styles.recursoAlertaTexto}>
              {statusExercicioSelecionado.texto}
            </Text>
          </View>
        ) : null}

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
              placeholderTextColor="#555"
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
              placeholderTextColor="#555"
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
                placeholderTextColor="#555"
                value={value ?? ""}
                onChangeText={onChange}
              />
            )}
          />
        ) : null}

        <View style={styles.compactFieldsRow}>
          <View style={styles.compactField}>
            <Text style={styles.labelCompact}>Séries prescritas</Text>
            <TextInput
              style={styles.inputCompact}
              placeholder="3"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={seriesPrescritasInput}
              onChangeText={setSeriesPrescritasInput}
            />
          </View>

          <View style={styles.compactField}>
            <Text style={styles.labelCompact}>Descanso (s)</Text>
            <TextInput
              style={styles.inputCompact}
              placeholder="60"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={descansoInput}
              onChangeText={setDescansoInput}
            />
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
                placeholderTextColor="#555"
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
                      setValue("alvo_tipo", "PASSOS");
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
              placeholderTextColor="#555"
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
  wrapper: { flex: 1, backgroundColor: "#0d0d0d" },
  container: { flex: 1, padding: 16 },
  label: {
    color: "#888",
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
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  observacoesInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#282828",
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
    backgroundColor: "#22c55e",
  },
  selectedBadgeInvalid: {
    backgroundColor: "#ef4444",
  },
  selectedBadgeText: { color: "#fff", fontWeight: "700" },
  dropdown: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#282828",
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
  },
  dropdownNome: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dropdownGrupo: { color: "#9aa0a6", fontSize: 12, marginTop: 3 },
  dropdownRecurso: { fontSize: 12, marginTop: 3 },
  dropdownRecursoDisponivel: { color: "#9fe6b4" },
  dropdownRecursoIndisponivel: { color: "#ef4444" },
  dropdownRecursoNeutro: { color: "#9aa0a6" },
  recursoAlertaBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#5b2222",
    backgroundColor: "#2a1515",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recursoAlertaTitulo: {
    color: "#fda4a4",
    fontSize: 12,
    fontWeight: "700",
  },
  recursoAlertaTexto: {
    color: "#fecaca",
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
    color: "#7c7c7c",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 26,
    marginHorizontal: -2,
  },
  inlineHint: {
    color: "#7c7c7c",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  alvoTipoTrigger: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#282828",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alvoTipoTriggerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  alvoTipoTriggerChevron: {
    color: "#9aa0a6",
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
    borderColor: "#2b2b2b",
    backgroundColor: "#141414",
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
    borderBottomColor: "#202020",
  },
  alvoTipoMenuText: {
    color: "#cfcfcf",
    fontSize: 13,
    fontWeight: "500",
  },
  alvoTipoMenuTextActive: {
    color: "#9fe6b4",
    fontWeight: "700",
  },
  inlineNumericInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#282828",
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
  labelCompact: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputCompact: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  rowSplit: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  inputHalf: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#2b2b2b",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#151515",
  },
  chipActive: {
    backgroundColor: "#133120",
    borderColor: "#245d3d",
  },
  chipText: { color: "#9aa0a6", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#c8f2d7" },
  button: {
    marginTop: 24,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
