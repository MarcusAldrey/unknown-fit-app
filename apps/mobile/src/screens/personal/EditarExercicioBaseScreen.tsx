import React from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import type { ImplementoExecucao } from "../../types";

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "EditarExercicioBase"
>;

interface FormData {
  nome: string;
  grupo_muscular: string;
  implemento_execucao: ImplementoExecucao;
  pode_ser_feito_em_casa: boolean;
}

const IMPLEMENTOS: ImplementoExecucao[] = [
  "BARRA",
  "ELASTICO",
  "HALTERE",
  "KETTLEBELL",
  "CABO",
  "MAQUINA",
  "PESO_CORPO",
  "OUTRO",
];

const formatarImplemento = (valor: ImplementoExecucao) =>
  valor.replace(/_/g, " ");

export function EditarExercicioBaseScreen({ route, navigation }: Props) {
  const { exercicio } = route.params;
  const queryClient = useQueryClient();

  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      nome: exercicio.nome,
      grupo_muscular: exercicio.grupo_muscular,
      implemento_execucao: exercicio.implemento_execucao,
      pode_ser_feito_em_casa: exercicio.pode_ser_feito_em_casa,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      await api.patch(`/catalogo/exercicios-base/${exercicio.id}`, {
        nome: data.nome.trim(),
        grupo_muscular: data.grupo_muscular.trim(),
        implemento_execucao: data.implemento_execucao,
        pode_ser_feito_em_casa: data.pode_ser_feito_em_casa,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["catalogo", "exercicios-base"],
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome</Text>
      <Controller
        control={control}
        name="nome"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholder="Nome do exercício"
            placeholderTextColor="#666"
          />
        )}
      />

      <Text style={styles.label}>Grupo muscular</Text>
      <Controller
        control={control}
        name="grupo_muscular"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholder="Grupo muscular"
            placeholderTextColor="#666"
          />
        )}
      />

      <Text style={styles.label}>Implemento de execução</Text>
      <Controller
        control={control}
        name="implemento_execucao"
        render={({ field: { onChange, value } }) => (
          <View style={styles.row}>
            {IMPLEMENTOS.map((implemento) => (
              <TouchableOpacity
                key={implemento}
                style={[styles.chip, value === implemento && styles.chipActive]}
                onPress={() => onChange(implemento)}
              >
                <Text
                  style={[
                    styles.chipText,
                    value === implemento && styles.chipTextActive,
                  ]}
                >
                  {formatarImplemento(implemento)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      <Text style={styles.label}>Pode ser feito em casa</Text>
      <Controller
        control={control}
        name="pode_ser_feito_em_casa"
        render={({ field: { onChange, value } }) => (
          <TouchableOpacity
            style={[
              styles.toggle,
              value ? styles.toggleAtivo : styles.toggleInativo,
            ]}
            onPress={() => onChange(!value)}
          >
            <Text style={styles.toggleText}>{value ? "Sim" : "Não"}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit((data) => {
          if (!data.nome.trim() || !data.grupo_muscular.trim()) {
            Alert.alert("Atenção", "Preencha nome e grupo muscular.");
            return;
          }
          mutation.mutate(data);
        })}
      >
        <Text style={styles.buttonText}>
          {mutation.isPending ? "Salvando..." : "Salvar alterações"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d", padding: 16 },
  label: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  toggle: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  toggleAtivo: {
    backgroundColor: "#133120",
    borderColor: "#245d3d",
  },
  toggleInativo: {
    backgroundColor: "#171717",
    borderColor: "#2b2b2b",
  },
  toggleText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
