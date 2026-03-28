import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { AlunoRecursoDisponibilidade } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "GerirRecursosAluno"
>;

export function GerirRecursosAlunoScreen({ route }: Props) {
  const { alunoId } = route.params;
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const recursosQueryKey = [
    "personal",
    "aluno",
    alunoId,
    "recursos-treino",
  ] as const;

  const {
    data: recursos,
    isLoading,
    isError,
    error,
  } = useQuery<AlunoRecursoDisponibilidade[]>({
    queryKey: recursosQueryKey,
    queryFn: async () => {
      const res = await api.get(`/personal/alunos/${alunoId}/recursos-treino`);
      return res.data;
    },
  });

  const atualizarDisponibilidadeMutation = useMutation({
    mutationFn: async (variables: {
      recursoId: string;
      disponivel: boolean;
    }) => {
      const { recursoId, disponivel } = variables;
      const res = await api.patch(
        `/personal/alunos/${alunoId}/recursos-treino/${recursoId}`,
        {
          disponivel_para_aluno: disponivel,
        },
      );
      return res.data as AlunoRecursoDisponibilidade;
    },
  });

  const atualizarDisponibilidadeEmLoteMutation = useMutation({
    mutationFn: async (disponivel: boolean) => {
      const res = await api.patch(
        `/personal/alunos/${alunoId}/recursos-treino`,
        {
          disponivel_para_aluno: disponivel,
        },
      );
      return res.data as AlunoRecursoDisponibilidade[];
    },
  });

  const todosMarcados = useMemo(
    () =>
      Boolean(recursos?.length) &&
      (recursos ?? []).every((item) => item.disponivel_para_aluno),
    [recursos],
  );

  const toggleDisponibilidade = async (
    item: AlunoRecursoDisponibilidade,
    novoValor: boolean,
  ) => {
    if (pendingIds.includes(item.recurso_treino_id)) return;

    setPendingIds((prev) => [...prev, item.recurso_treino_id]);

    const previous =
      queryClient.getQueryData<AlunoRecursoDisponibilidade[]>(recursosQueryKey);

    queryClient.setQueryData<AlunoRecursoDisponibilidade[]>(
      recursosQueryKey,
      (current) =>
        (current ?? []).map((row) =>
          row.recurso_treino_id === item.recurso_treino_id
            ? { ...row, disponivel_para_aluno: novoValor }
            : row,
        ),
    );

    try {
      await atualizarDisponibilidadeMutation.mutateAsync({
        recursoId: item.recurso_treino_id,
        disponivel: novoValor,
      });
    } catch (mutationError: any) {
      queryClient.setQueryData(recursosQueryKey, previous);
      const detail = mutationError?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Nao foi possivel atualizar a disponibilidade do recurso.",
      );
    } finally {
      setPendingIds((prev) =>
        prev.filter((id) => id !== item.recurso_treino_id),
      );
      queryClient.invalidateQueries({ queryKey: recursosQueryKey });
    }
  };

  const toggleMarcarTodos = async () => {
    if (!recursos || recursos.length === 0) return;

    const novoValor = !todosMarcados;
    const alvoIds = recursos
      .filter((item) => item.disponivel_para_aluno !== novoValor)
      .map((item) => item.recurso_treino_id);

    if (alvoIds.length === 0) return;

    setPendingIds((prev) => [...new Set([...prev, ...alvoIds])]);

    const previous =
      queryClient.getQueryData<AlunoRecursoDisponibilidade[]>(recursosQueryKey);

    queryClient.setQueryData<AlunoRecursoDisponibilidade[]>(
      recursosQueryKey,
      (current) =>
        (current ?? []).map((row) =>
          alvoIds.includes(row.recurso_treino_id)
            ? { ...row, disponivel_para_aluno: novoValor }
            : row,
        ),
    );

    try {
      const atualizados =
        await atualizarDisponibilidadeEmLoteMutation.mutateAsync(novoValor);
      queryClient.setQueryData(recursosQueryKey, atualizados);
    } catch (mutationError: any) {
      queryClient.setQueryData(recursosQueryKey, previous);
      const detail = mutationError?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Nao foi possivel atualizar os equipamentos do aluno.",
      );
    } finally {
      setPendingIds((prev) => prev.filter((id) => !alvoIds.includes(id)));
      queryClient.invalidateQueries({ queryKey: recursosQueryKey });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (isError) {
    const detail = (error as any)?.response?.data?.detail;
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Erro ao carregar recursos</Text>
        <Text style={styles.errorText}>
          {typeof detail === "string"
            ? detail
            : "Verifique a conexao com a API e tente novamente."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={toggleMarcarTodos}
          disabled={
            (recursos?.length ?? 0) === 0 ||
            pendingIds.length > 0 ||
            atualizarDisponibilidadeMutation.isPending ||
            atualizarDisponibilidadeEmLoteMutation.isPending
          }
          style={styles.marcarTodosButton}
        >
          <Text style={styles.marcarTodosButtonText}>
            Desmarcar/Marcar todos
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={recursos ?? []}
        keyExtractor={(item) => item.recurso_treino_id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum recurso cadastrado.</Text>
        }
        renderItem={({ item }) => {
          const isPending = pendingIds.includes(item.recurso_treino_id);
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resourceName}>{item.nome_recurso}</Text>
                <Text
                  style={[
                    styles.resourceStatus,
                    item.disponivel_para_aluno
                      ? styles.resourceStatusOn
                      : styles.resourceStatusOff,
                  ]}
                >
                  {item.disponivel_para_aluno ? "Disponivel" : "Indisponivel"}
                </Text>
              </View>
              <Switch
                value={item.disponivel_para_aluno}
                onValueChange={(value) => toggleDisponibilidade(item, value)}
                disabled={isPending}
                trackColor={{ false: "#3a1f1f", true: "#1f3a27" }}
                thumbColor={item.disponivel_para_aluno ? "#22c55e" : "#ef4444"}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    paddingHorizontal: 24,
  },
  actionsRow: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  marcarTodosButton: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
  },
  marcarTodosButtonText: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#242424",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 10,
  },
  resourceName: {
    color: "#f0f0f0",
    fontSize: 15,
    fontWeight: "600",
  },
  resourceStatus: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  resourceStatusOn: {
    color: "#22c55e",
  },
  resourceStatusOff: {
    color: "#ef4444",
  },
  emptyText: {
    color: "#8a8a8a",
    textAlign: "center",
    marginTop: 32,
  },
  errorTitle: {
    color: "#fca5a5",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#aaaaaa",
    textAlign: "center",
    fontSize: 13,
  },
});
