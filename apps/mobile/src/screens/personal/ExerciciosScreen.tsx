import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { ExercicioTreino } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "Exercicios">;

export function ExerciciosScreen({ route, navigation }: Props) {
  const { treinoId, treinoCodigo, treinoNome } = route.params;
  const queryClient = useQueryClient();

  // --- State ---
  const [localNome, setLocalNome] = useState(treinoNome);
  const [editNomeVisible, setEditNomeVisible] = useState(false);
  const [editNomeText, setEditNomeText] = useState(treinoNome);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuExercicio, setMenuExercicio] = useState<ExercicioTreino | null>(
    null,
  );

  const [reorderMode, setReorderMode] = useState(false);
  const [localExercicios, setLocalExercicios] = useState<ExercicioTreino[]>([]);

  // --- Queries ---
  const { data: exercicios, isLoading } = useQuery<ExercicioTreino[]>({
    queryKey: ["personal", "treino", treinoId, "exercicios"],
    queryFn: async () => {
      const res = await api.get(`/personal/treinos/${treinoId}/exercicios`);
      return res.data;
    },
  });

  useEffect(() => {
    if (exercicios) setLocalExercicios(exercicios);
  }, [exercicios]);

  // --- Mutations ---
  const editNomeMutation = useMutation({
    mutationFn: async (nome: string) => {
      await api.patch(`/personal/treinos/${treinoId}`, { nome });
    },
    onSuccess: () => {
      setLocalNome(editNomeText);
      setEditNomeVisible(false);
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId],
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível atualizar o nome.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (exercicioId: string) => {
      await api.delete(`/personal/exercicios/${exercicioId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setMenuVisible(false);
      setMenuExercicio(null);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível deletar o exercício.");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (ex: ExercicioTreino) => {
      const nextOrdem = (exercicios?.length ?? 0) + 1;
      await api.post(`/personal/treinos/${treinoId}/exercicios`, {
        nome_exercicio: ex.nome_exercicio,
        ordem: nextOrdem,
        repeticao_ou_tempo: ex.repeticao_ou_tempo,
        rer_rm_valor: ex.rer_rm_valor,
        descanso_segundos: ex.descanso_segundos,
        tecnica: ex.tecnica,
        observacoes: ex.observacoes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setMenuVisible(false);
      setMenuExercicio(null);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível duplicar o exercício.");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: ExercicioTreino[]) => {
      await Promise.all(
        items.map((ex, idx) =>
          api.patch(`/personal/exercicios/${ex.id}`, { ordem: idx + 1 }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setReorderMode(false);
    },
  });

  // --- Reorder helpers ---
  const moveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= localExercicios.length) return;
      const updated = [...localExercicios];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      const renumbered = updated.map((ex, idx) => ({
        ...ex,
        ordem: idx + 1,
      }));
      setLocalExercicios(renumbered);
    },
    [localExercicios],
  );

  // --- Menu actions ---
  const handleDelete = () => {
    if (!menuExercicio) return;
    Alert.alert(
      "Deletar exercício",
      `Deseja deletar "${menuExercicio.nome_exercicio}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: () => deleteMutation.mutate(menuExercicio.id),
        },
      ],
    );
  };

  const handleDuplicate = () => {
    if (!menuExercicio) return;
    duplicateMutation.mutate(menuExercicio);
  };

  const handleEdit = () => {
    if (!menuExercicio) return;
    setMenuVisible(false);
    navigation.navigate("CriarExercicio", {
      treinoId,
      exercicioData: menuExercicio,
    });
    setMenuExercicio(null);
  };

  // --- Render ---
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const displayExercicios = reorderMode ? localExercicios : (exercicios ?? []);

  const renderHeader = () => (
    <View style={styles.contextHeader}>
      <View style={styles.contextRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contextTitle}>Treino {treinoCodigo}</Text>
          <TouchableOpacity
            style={styles.editNomeRow}
            onPress={() => {
              setEditNomeText(localNome);
              setEditNomeVisible(true);
            }}
          >
            <Text style={styles.contextSub}>{localNome}</Text>
            <Text style={styles.editIcon}>✎</Text>
          </TouchableOpacity>
        </View>
        {!reorderMode && displayExercicios.length > 1 && (
          <TouchableOpacity
            style={styles.reorderBtn}
            onPress={() => setReorderMode(true)}
          >
            <Text style={styles.reorderBtnText}>Reordenar</Text>
          </TouchableOpacity>
        )}
      </View>
      {reorderMode && (
        <View style={styles.reorderBar}>
          <Text style={styles.reorderLabel}>
            Use as setas para reordenar os exercícios
          </Text>
          <View style={styles.reorderActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setLocalExercicios(exercicios ?? []);
                setReorderMode(false);
              }}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => reorderMutation.mutate(localExercicios)}
            >
              <Text style={styles.saveBtnText}>
                {reorderMutation.isPending ? "Salvando..." : "Salvar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderFooter = () =>
    !reorderMode ? (
      <TouchableOpacity
        style={styles.addCard}
        onPress={() => navigation.navigate("CriarExercicio", { treinoId })}
      >
        <Text style={styles.addIcon}>+</Text>
        <Text style={styles.addText}>Novo Exercício</Text>
      </TouchableOpacity>
    ) : null;

  const renderEmpty = () => (
    <TouchableOpacity
      style={styles.emptyCard}
      onPress={() => navigation.navigate("CriarExercicio", { treinoId })}
    >
      <Text style={styles.emptyIcon}>+</Text>
      <Text style={styles.emptyText}>
        Adicione o primeiro exercício deste treino
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayExercicios}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          displayExercicios.length > 0 ? renderFooter : undefined
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={reorderMode ? 1 : 0.7}
            onLongPress={reorderMode ? undefined : () => setReorderMode(true)}
            onPress={reorderMode ? undefined : () => {}}
          >
            <Text style={styles.ordem}>{item.ordem}</Text>
            <View style={styles.info}>
              <Text style={styles.nome}>{item.nome_exercicio}</Text>
              <Text style={styles.detalhe}>
                {item.repeticao_ou_tempo ?? "—"} · RER/RM:{" "}
                {item.rer_rm_valor ?? "—"} · Desc:{" "}
                {item.descanso_segundos ? `${item.descanso_segundos}s` : "—"}
              </Text>
              {item.tecnica !== "PADRAO" && (
                <Text style={styles.tecnica}>{item.tecnica}</Text>
              )}
              {item.observacoes && (
                <Text style={styles.obs}>{item.observacoes}</Text>
              )}
            </View>
            {reorderMode ? (
              <View style={styles.arrowContainer}>
                <TouchableOpacity
                  style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
                  onPress={() => moveItem(index, "up")}
                  disabled={index === 0}
                >
                  <Text style={styles.arrowText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.arrowBtn,
                    index === displayExercicios.length - 1 &&
                      styles.arrowDisabled,
                  ]}
                  onPress={() => moveItem(index, "down")}
                  disabled={index === displayExercicios.length - 1}
                >
                  <Text style={styles.arrowText}>↓</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => {
                  setMenuExercicio(item);
                  setMenuVisible(true);
                }}
              >
                <Text style={styles.menuDots}>⋮</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Modal: Editar Nome do Treino */}
      <Modal
        visible={editNomeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNomeVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditNomeVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Editar nome do treino</Text>
            <TextInput
              style={styles.modalInput}
              value={editNomeText}
              onChangeText={setEditNomeText}
              autoFocus
              placeholderTextColor="#555"
              placeholder="Nome do treino"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditNomeVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => editNomeMutation.mutate(editNomeText)}
              >
                <Text style={styles.modalSaveText}>
                  {editNomeMutation.isPending ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Menu de Ações do Exercício */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMenuVisible(false);
          setMenuExercicio(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setMenuVisible(false);
            setMenuExercicio(null);
          }}
        >
          <Pressable style={styles.menuContent} onPress={() => {}}>
            <Text style={styles.menuTitle}>
              {menuExercicio?.nome_exercicio}
            </Text>

            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Text style={styles.menuItemIcon}>✎</Text>
              <Text style={styles.menuItemText}>Editar exercício</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleDuplicate}>
              <Text style={styles.menuItemIcon}>⧉</Text>
              <Text style={styles.menuItemText}>Duplicar exercício</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDelete}
            >
              <Text style={[styles.menuItemIcon, { color: "#ef4444" }]}>✕</Text>
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>
                Deletar exercício
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d", padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
  },

  // --- Header ---
  contextHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  contextRow: { flexDirection: "row", alignItems: "center" },
  contextTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  contextSub: { color: "#888", fontSize: 14 },
  editNomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  editIcon: { color: "#555", fontSize: 14 },

  // --- Reorder bar ---
  reorderBtn: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reorderBtnText: { color: "#888", fontSize: 13 },
  reorderBar: {
    marginTop: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
  },
  reorderLabel: { color: "#888", fontSize: 13, marginBottom: 10 },
  reorderActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtnText: { color: "#888", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },

  // --- Exercise card ---
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    gap: 12,
  },
  ordem: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "bold",
    width: 30,
    textAlign: "center",
    alignSelf: "center",
  },
  info: { flex: 1 },
  nome: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  detalhe: { color: "#aaa", fontSize: 13, marginTop: 4 },
  tecnica: { color: "#22c55e", fontSize: 12, marginTop: 4, fontWeight: "bold" },
  obs: { color: "#666", fontSize: 12, marginTop: 4, fontStyle: "italic" },
  menuBtn: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuDots: { color: "#888", fontSize: 22, fontWeight: "bold" },

  // --- Arrows ---
  arrowContainer: { flexDirection: "column", gap: 4, alignSelf: "center" },
  arrowBtn: {
    backgroundColor: "#2a2a2a",
    borderRadius: 6,
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: { opacity: 0.25 },
  arrowText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  // --- Footer / Empty ---
  addCard: {
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addIcon: { color: "#22c55e", fontSize: 20, fontWeight: "bold" },
  addText: { color: "#888", fontSize: 15 },
  emptyCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginTop: 8,
  },
  emptyIcon: { color: "#22c55e", fontSize: 32, fontWeight: "bold" },
  emptyText: {
    color: "#888",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },

  // --- Modal Edit Nome ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 20,
    width: "100%",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "#0d0d0d",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: { color: "#888", fontSize: 14 },
  modalSaveBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSaveText: { color: "#fff", fontSize: 14, fontWeight: "bold" },

  // --- Modal Menu ---
  menuContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 8,
    width: "100%",
  },
  menuTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  menuItemIcon: { color: "#ccc", fontSize: 18 },
  menuItemText: { color: "#ccc", fontSize: 15 },
});
