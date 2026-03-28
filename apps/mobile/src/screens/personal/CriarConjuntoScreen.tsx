import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { ConjuntoTreino, ConjuntoTreinoCreate } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "CriarConjunto">;

export function CriarConjuntoScreen({ route, navigation }: Props) {
  const { alunoId, alunoNome } = route.params;
  const queryClient = useQueryClient();

  const { control, handleSubmit } = useForm<ConjuntoTreinoCreate>({
    defaultValues: { nome: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ConjuntoTreinoCreate) => {
      const res = await api.post<ConjuntoTreino>(
        `/personal/alunos/${alunoId}/conjuntos`,
        data,
      );
      return res.data;
    },
    onSuccess: (conjuntoCriado) => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "aluno", alunoId, "conjuntos"],
      });
      navigation.replace("Treinos", {
        alunoId,
        conjuntoId: conjuntoCriado.id,
        conjuntoNome: conjuntoCriado.nome,
        alunoNome,
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível criar a periodização.");
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome da Periodização</Text>
      <Controller
        control={control}
        name="nome"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Ex: Ciclo Hipertrofia 1"
            placeholderTextColor="#888"
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit((data) => mutation.mutate(data))}
      >
        <Text style={styles.buttonText}>Criar Periodização</Text>
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
  },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
