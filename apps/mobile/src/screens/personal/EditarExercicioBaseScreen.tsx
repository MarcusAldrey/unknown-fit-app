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

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "EditarExercicioBase"
>;

interface FormData {
  nome: string;
  grupo_muscular: string;
  equipamento: string;
}

export function EditarExercicioBaseScreen({ route, navigation }: Props) {
  const { exercicio } = route.params;
  const queryClient = useQueryClient();

  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      nome: exercicio.nome,
      grupo_muscular: exercicio.grupo_muscular,
      equipamento: exercicio.equipamento ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      await api.patch(`/catalogo/exercicios-base/${exercicio.id}`, {
        nome: data.nome.trim(),
        grupo_muscular: data.grupo_muscular.trim(),
        equipamento: data.equipamento.trim() || null,
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

      <Text style={styles.label}>Equipamento</Text>
      <Controller
        control={control}
        name="equipamento"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholder="Opcional"
            placeholderTextColor="#666"
          />
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
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
