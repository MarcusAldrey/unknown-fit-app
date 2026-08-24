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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { keys } from "../../api/queryKeys";
import { personalService } from "../../api/services/personal";
import type { Treino } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<PersonalStackParamList, "CriarTreino">;

interface FormData {
  codigo: string;
  nome: string;
}

export function CriarTreinoScreen({ route, navigation }: Props) {
  const { alunoId, conjuntoId, conjuntoNome, alunoNome } = route.params;
  const queryClient = useQueryClient();

  const { data: treinos } = useQuery<Treino[]>({
    queryKey: keys.personal.conjuntoTreinos(conjuntoId),
    queryFn: () => personalService.conjuntoTreinos(conjuntoId),
  });

  const nextOrdem = (treinos?.length ?? 0) + 1;
  const nextCodigo = String.fromCharCode(64 + nextOrdem); // A, B, C...

  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: { codigo: nextCodigo, nome: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return personalService.criarTreino(conjuntoId, {
        ...data,
        ordem: nextOrdem,
      });
    },
    onSuccess: (treino) => {
      queryClient.invalidateQueries({
        queryKey: keys.personal.conjuntoTreinos(conjuntoId),
      });
      navigation.replace("Exercicios", {
        alunoId,
        treinoId: treino.id,
        treinoCodigo: treino.codigo,
        treinoNome: treino.nome,
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível criar o treino.");
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.contextHeader}>
        <Text style={styles.contextTitle}>Novo treino da {conjuntoNome}</Text>
        <Text style={styles.contextSub}>de {alunoNome}</Text>
      </View>

      <Text style={styles.label}>Código (A, B, C...)</Text>
      <Controller
        control={control}
        name="codigo"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder={nextCodigo}
            placeholderTextColor={colors.border}
            value={value}
            onChangeText={onChange}
            autoCapitalize="characters"
          />
        )}
      />

      <Text style={styles.label}>Nome do Treino</Text>
      <Controller
        control={control}
        name="nome"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Peito e Tríceps"
            placeholderTextColor={colors.border}
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit((data) => mutation.mutate(data))}
      >
        <Text style={styles.buttonText}>
          {mutation.isPending ? "Criando..." : "Criar Treino"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  contextHeader: {
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  contextTitle: { color: colors.text, fontSize: 17, fontWeight: "bold" },
  contextSub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "bold" },
});
