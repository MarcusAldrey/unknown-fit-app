import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Keyboard,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type {
  ExercicioTreinoCreate,
  ExercicioTreino,
  ExercicioBase,
} from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "CriarExercicio">;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CriarExercicioScreen({ route, navigation }: Props) {
  const { treinoId, exercicioData } = route.params;
  const isEditMode = !!exercicioData;
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(
    exercicioData?.nome_exercicio ?? "",
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(searchText, 300);

  const { control, handleSubmit, setValue, watch } =
    useForm<ExercicioTreinoCreate>({
      defaultValues: {
        exercicio_base_id: exercicioData?.exercicio_base_id ?? "",
        numero_series_prescritas: exercicioData?.numero_series_prescritas ?? 3,
        repeticao_ou_tempo: exercicioData?.repeticao_ou_tempo ?? "",
        rer_rm_valor: exercicioData?.rer_rm_valor ?? "",
        descanso_segundos: exercicioData?.descanso_segundos ?? 60,
        tecnica: exercicioData?.tecnica ?? "PADRAO",
        observacoes: exercicioData?.observacoes ?? "",
      },
    });

  const selectedExercicioBaseId = watch("exercicio_base_id");

  // Fetch existing exercises count for auto-ordem on create
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

  const filteredExercicios = useMemo(() => {
    if (!exerciciosBase || !debouncedSearch.trim()) return [];
    const term = debouncedSearch.toLowerCase();
    return exerciciosBase.filter(
      (ex) =>
        ex.nome.toLowerCase().includes(term) ||
        ex.grupo_muscular.toLowerCase().includes(term),
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

  // --- Create mutation ---
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
    onError: () => {
      Alert.alert("Erro", "Não foi possível criar o exercício.");
    },
  });

  // --- Edit mutation ---
  const editMutation = useMutation({
    mutationFn: async (data: ExercicioTreinoCreate) => {
      await api.patch(`/personal/exercicios/${exercicioData!.id}`, {
        exercicio_base_id: data.exercicio_base_id,
        numero_series_prescritas: data.numero_series_prescritas,
        repeticao_ou_tempo: data.repeticao_ou_tempo || null,
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
    onError: () => {
      Alert.alert("Erro", "Não foi possível atualizar o exercício.");
    },
  });

  const onSubmit = (data: ExercicioTreinoCreate) => {
    if (isEditMode) {
      editMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || editMutation.isPending;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
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
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓</Text>
            </View>
          ) : null}
        </View>

        {showDropdown && filteredExercicios.length > 0 && (
          <View style={styles.dropdown}>
            {filteredExercicios.slice(0, 8).map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={styles.dropdownItem}
                onPress={() => handleSelectExercicio(ex)}
              >
                <Text style={styles.dropdownNome}>{ex.nome}</Text>
                <Text style={styles.dropdownGrupo}>
                  {ex.grupo_muscular}
                  {ex.equipamento ? ` · ${ex.equipamento}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Repetição / Tempo</Text>
        <Controller
          control={control}
          name="repeticao_ou_tempo"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="12 reps ou 45s"
              placeholderTextColor="#555"
              value={value ?? ""}
              onChangeText={onChange}
            />
          )}
        />

        <Text style={styles.label}>Séries Prescritas</Text>
        <Controller
          control={control}
          name="numero_series_prescritas"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="3"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={String(value ?? "")}
              onChangeText={(v) => onChange(Math.max(1, Number(v) || 1))}
            />
          )}
        />

        <Text style={styles.label}>RER / RM</Text>
        <Controller
          control={control}
          name="rer_rm_valor"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="2 ou 30%"
              placeholderTextColor="#555"
              value={value ?? ""}
              onChangeText={onChange}
            />
          )}
        />

        <Text style={styles.label}>Descanso (segundos)</Text>
        <Controller
          control={control}
          name="descanso_segundos"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="60"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={String(value ?? "")}
              onChangeText={(v) => onChange(Number(v) || undefined)}
            />
          )}
        />

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
                  onPress={() => onChange(t)}
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
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="Observações..."
              placeholderTextColor="#555"
              multiline
              value={value ?? ""}
              onChangeText={onChange}
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
    </View>
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
  },
  selectedBadge: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  selectedBadgeText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  dropdown: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    overflow: "hidden",
    zIndex: 10,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  dropdownNome: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dropdownGrupo: { color: "#888", fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#22c55e" },
  chipText: { color: "#888", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "bold" },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
