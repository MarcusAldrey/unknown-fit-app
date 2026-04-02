import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorNome, setEditorNome] = useState("");
  const [recursoEmEdicao, setRecursoEmEdicao] =
    useState<AlunoRecursoDisponibilidade | null>(null);

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

  const criarRecursoMutation = useMutation({
    mutationFn: async (nome: string) => {
      await api.post("/catalogo/recursos-treino", { nome });
    },
  });

  const editarRecursoMutation = useMutation({
    mutationFn: async (variables: { recursoId: string; nome: string }) => {
      await api.patch(`/catalogo/recursos-treino/${variables.recursoId}`, {
        nome: variables.nome,
      });
    },
  });

  const removerRecursoMutation = useMutation({
    mutationFn: async (recursoId: string) => {
      await api.patch(`/catalogo/recursos-treino/${recursoId}`, {
        ativo: false,
      });
    },
  });

  const recursoCrudPendente =
    criarRecursoMutation.isPending ||
    editarRecursoMutation.isPending ||
    removerRecursoMutation.isPending;

  const invalidarRecursos = () => {
    queryClient.invalidateQueries({ queryKey: recursosQueryKey });
    queryClient.invalidateQueries({
      queryKey: ["catalogo", "recursos-treino"],
    });
    queryClient.invalidateQueries({
      queryKey: ["catalogo", "exercicios-base"],
    });
  };

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

  const abrirCriacaoRecurso = () => {
    setRecursoEmEdicao(null);
    setEditorNome("");
    setEditorVisible(true);
  };

  const abrirEdicaoRecurso = (item: AlunoRecursoDisponibilidade) => {
    setRecursoEmEdicao(item);
    setEditorNome(item.nome_recurso);
    setEditorVisible(true);
  };

  const salvarRecurso = async () => {
    const nome = editorNome.trim();
    if (nome.length < 2) {
      Alert.alert(
        "Atencao",
        "Informe um nome de recurso com pelo menos 2 caracteres.",
      );
      return;
    }

    try {
      if (recursoEmEdicao) {
        await editarRecursoMutation.mutateAsync({
          recursoId: recursoEmEdicao.recurso_treino_id,
          nome,
        });
      } else {
        await criarRecursoMutation.mutateAsync(nome);
      }

      setEditorVisible(false);
      setEditorNome("");
      setRecursoEmEdicao(null);
      invalidarRecursos();
    } catch (mutationError: any) {
      const detail = mutationError?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Nao foi possivel salvar o recurso.",
      );
    }
  };

  const confirmarRemocaoRecurso = (item: AlunoRecursoDisponibilidade) => {
    Alert.alert(
      "Remover recurso",
      `Deseja remover o recurso \"${item.nome_recurso}\"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await removerRecursoMutation.mutateAsync(item.recurso_treino_id);
              invalidarRecursos();
            } catch (mutationError: any) {
              const detail = mutationError?.response?.data?.detail;
              Alert.alert(
                "Erro",
                typeof detail === "string"
                  ? detail
                  : "Nao foi possivel remover o recurso.",
              );
            }
          },
        },
      ],
    );
  };

  const abrirMenuRecurso = (item: AlunoRecursoDisponibilidade) => {
    Alert.alert(item.nome_recurso, "", [
      { text: "Editar nome", onPress: () => abrirEdicaoRecurso(item) },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => confirmarRemocaoRecurso(item),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
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
          onPress={abrirCriacaoRecurso}
          disabled={recursoCrudPendente}
          style={styles.addRecursoButton}
        >
          <Text style={styles.addRecursoButtonText}>+ recurso</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleMarcarTodos}
          disabled={
            (recursos?.length ?? 0) === 0 ||
            pendingIds.length > 0 ||
            atualizarDisponibilidadeMutation.isPending ||
            atualizarDisponibilidadeEmLoteMutation.isPending ||
            recursoCrudPendente
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
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.rowMenuButton}
                  onPress={() => abrirMenuRecurso(item)}
                  disabled={recursoCrudPendente || isPending}
                >
                  <Text style={styles.rowMenuText}>...</Text>
                </TouchableOpacity>

                <Switch
                  value={item.disponivel_para_aluno}
                  onValueChange={(value) => toggleDisponibilidade(item, value)}
                  disabled={isPending || recursoCrudPendente}
                  trackColor={{ false: "#3a1f1f", true: "#1f3a27" }}
                  thumbColor={
                    item.disponivel_para_aluno ? "#22c55e" : "#ef4444"
                  }
                />
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (recursoCrudPendente) return;
          setEditorVisible(false);
          setEditorNome("");
          setRecursoEmEdicao(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (recursoCrudPendente) return;
            setEditorVisible(false);
            setEditorNome("");
            setRecursoEmEdicao(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {recursoEmEdicao ? "Editar recurso" : "Novo recurso"}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={editorNome}
              onChangeText={setEditorNome}
              editable={!recursoCrudPendente}
              autoFocus
              placeholder="Nome do recurso"
              placeholderTextColor="#666"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  if (recursoCrudPendente) return;
                  setEditorVisible(false);
                  setEditorNome("");
                  setRecursoEmEdicao(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={salvarRecurso}
                disabled={recursoCrudPendente}
              >
                <Text style={styles.modalSaveText}>
                  {recursoCrudPendente ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addRecursoButton: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    backgroundColor: "transparent",
  },
  addRecursoButtonText: {
    color: "#7dd3a2",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.9,
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
  rowActions: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  rowMenuButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#121212",
    marginRight: 2,
  },
  rowMenuText: {
    color: "#7f7f7f",
    fontSize: 11,
    fontWeight: "700",
    marginTop: -1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#131313",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    padding: 16,
  },
  modalTitle: {
    color: "#f5f5f5",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#323232",
  },
  modalCancelText: {
    color: "#b8b8b8",
    fontWeight: "600",
  },
  modalSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#14532d",
    borderWidth: 1,
    borderColor: "#1f7a45",
  },
  modalSaveText: {
    color: "#d7ffe8",
    fontWeight: "700",
  },
});
