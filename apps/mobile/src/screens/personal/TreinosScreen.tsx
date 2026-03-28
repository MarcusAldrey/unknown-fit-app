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
import type { SessaoResumo, Treino } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "Treinos">;

export function TreinosScreen({ route, navigation }: Props) {
  const { alunoId, conjuntoId, conjuntoNome, alunoNome } = route.params;
  const queryClient = useQueryClient();
  const [localConjuntoNome, setLocalConjuntoNome] = useState(conjuntoNome);
  const [editConjuntoVisible, setEditConjuntoVisible] = useState(false);
  const [editConjuntoText, setEditConjuntoText] = useState(conjuntoNome);

  const { data: treinos, isLoading } = useQuery<Treino[]>({
    queryKey: ["personal", "conjunto", conjuntoId, "treinos"],
    queryFn: async () => {
      const res = await api.get(`/personal/conjuntos/${conjuntoId}/treinos`);
      return res.data;
    },
  });

  const { data: sessoes } = useQuery<SessaoResumo[]>({
    queryKey: ["personal", "aluno", alunoId, "conjunto", conjuntoId, "sessoes"],
    queryFn: async () => {
      const res = await api.get(
        `/personal/alunos/${alunoId}/conjuntos/${conjuntoId}/sessoes`,
      );
      return res.data;
    },
  });

  const [reorderMode, setReorderMode] = useState(false);
  const [localTreinos, setLocalTreinos] = useState<Treino[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTreino, setMenuTreino] = useState<Treino | null>(null);
  const [editTreinoVisible, setEditTreinoVisible] = useState(false);
  const [editTreinoNome, setEditTreinoNome] = useState("");
  const [editTreinoCodigo, setEditTreinoCodigo] = useState("");

  useEffect(() => {
    setLocalConjuntoNome(conjuntoNome);
    setEditConjuntoText(conjuntoNome);
  }, [conjuntoNome]);

  useEffect(() => {
    if (treinos) setLocalTreinos(treinos);
  }, [treinos]);

  const reorderMutation = useMutation({
    mutationFn: async (items: Treino[]) => {
      await Promise.all(
        items.map((t, idx) =>
          api.patch(`/personal/treinos/${t.id}`, {
            ordem: idx + 1,
            codigo: String.fromCharCode(65 + idx),
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "conjunto", conjuntoId, "treinos"],
      });
      setReorderMode(false);
    },
  });

  const editConjuntoMutation = useMutation({
    mutationFn: async (nome: string) => {
      await api.patch(`/personal/conjuntos/${conjuntoId}`, { nome });
    },
    onSuccess: () => {
      setLocalConjuntoNome(editConjuntoText.trim());
      setEditConjuntoVisible(false);
      queryClient.invalidateQueries({
        queryKey: ["personal", "aluno"],
      });
      queryClient.invalidateQueries({
        queryKey: ["personal", "conjunto", conjuntoId, "treinos"],
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível atualizar o nome da periodização.");
    },
  });

  const editTreinoMutation = useMutation({
    mutationFn: async (payload: {
      treinoId: string;
      nome: string;
      codigo: string;
    }) => {
      await api.patch(`/personal/treinos/${payload.treinoId}`, {
        nome: payload.nome,
        codigo: payload.codigo,
      });
    },
    onSuccess: () => {
      setEditTreinoVisible(false);
      setMenuTreino(null);
      queryClient.invalidateQueries({
        queryKey: ["personal", "conjunto", conjuntoId, "treinos"],
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível editar o treino.");
    },
  });

  const deleteTreinoMutation = useMutation({
    mutationFn: async (treinoId: string) => {
      await api.delete(`/personal/treinos/${treinoId}`);
    },
    onSuccess: () => {
      setMenuVisible(false);
      setMenuTreino(null);
      queryClient.invalidateQueries({
        queryKey: ["personal", "conjunto", conjuntoId, "treinos"],
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível remover o treino.");
    },
  });

  const handleEditTreino = () => {
    if (!menuTreino) return;
    setMenuVisible(false);
    setEditTreinoNome(menuTreino.nome);
    setEditTreinoCodigo(menuTreino.codigo);
    setEditTreinoVisible(true);
  };

  const handleDeleteTreino = () => {
    if (!menuTreino) return;
    Alert.alert("Remover treino", `Deseja remover "${menuTreino.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => deleteTreinoMutation.mutate(menuTreino.id),
      },
    ]);
  };

  const moveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= localTreinos.length) return;
      const updated = [...localTreinos];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      // Recalculate codes based on new positions
      const recoded = updated.map((t, idx) => ({
        ...t,
        codigo: String.fromCharCode(65 + idx),
        ordem: idx + 1,
      }));
      setLocalTreinos(recoded);
    },
    [localTreinos],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const displayTreinos = reorderMode ? localTreinos : (treinos ?? []);
  const totalTreinosRealizados = (sessoes ?? []).length;
  const treinoTexto = totalTreinosRealizados === 1 ? "treino" : "treinos";

  const renderHeader = () => (
    <>
      <View style={styles.contextHeader}>
        <View style={styles.contextRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={styles.editConjuntoRow}
              onPress={() => {
                setEditConjuntoText(localConjuntoNome);
                setEditConjuntoVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.contextTitle}>{localConjuntoNome}</Text>
              <Text style={styles.editIcon}>✎</Text>
            </TouchableOpacity>
            <Text style={styles.contextSub}>{alunoNome}</Text>
            <Text style={styles.historicoResumoText}>
              O aluno realizou {totalTreinosRealizados} {treinoTexto} desta
              periodização
            </Text>
            <TouchableOpacity
              style={styles.historicoBtn}
              onPress={() =>
                navigation.navigate("HistoricoTreinosAluno", {
                  alunoId,
                  conjuntoId,
                  conjuntoNome: localConjuntoNome,
                  alunoNome,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.historicoBtnText}>
                Ver histórico de treinos deste aluno
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {displayTreinos.length > 1 ? (
        <View style={styles.reorderControlsRow}>
          {!reorderMode ? (
            <TouchableOpacity
              style={styles.reorderBtnAfterSeparator}
              onPress={() => setReorderMode(true)}
            >
              <Text style={styles.reorderBtnText}>Reordenar treinos</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.reorderActionsInline}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setLocalTreinos(treinos ?? []);
                  setReorderMode(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => reorderMutation.mutate(localTreinos)}
              >
                <Text style={styles.saveBtnText}>
                  {reorderMutation.isPending ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
    </>
  );

  const renderFooter = () =>
    !reorderMode ? (
      <TouchableOpacity
        style={styles.addCard}
        onPress={() =>
          navigation.navigate("CriarTreino", {
            alunoId,
            conjuntoId,
            conjuntoNome: localConjuntoNome,
            alunoNome,
          })
        }
      >
        <Text style={styles.addIcon}>+</Text>
        <Text style={styles.addText}>Novo Treino</Text>
      </TouchableOpacity>
    ) : null;

  const renderEmpty = () => (
    <TouchableOpacity
      style={styles.emptyCard}
      onPress={() =>
        navigation.navigate("CriarTreino", {
          alunoId,
          conjuntoId,
          conjuntoNome: localConjuntoNome,
          alunoNome,
        })
      }
    >
      <Text style={styles.emptyIcon}>+</Text>
      <Text style={styles.emptyText}>
        Crie o primeiro treino desta periodização
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayTreinos}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          displayTreinos.length > 0 ? renderFooter : undefined
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={
              reorderMode
                ? undefined
                : () =>
                    navigation.navigate("Exercicios", {
                      alunoId,
                      treinoId: item.id,
                      treinoCodigo: item.codigo,
                      treinoNome: item.nome,
                    })
            }
            onLongPress={reorderMode ? undefined : () => setReorderMode(true)}
            activeOpacity={reorderMode ? 1 : 0.7}
          >
            <Text style={styles.codigo}>{item.codigo}</Text>
            <Text style={styles.nome}>{item.nome}</Text>
            {reorderMode && (
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
                    index === displayTreinos.length - 1 && styles.arrowDisabled,
                  ]}
                  onPress={() => moveItem(index, "down")}
                  disabled={index === displayTreinos.length - 1}
                >
                  <Text style={styles.arrowText}>↓</Text>
                </TouchableOpacity>
              </View>
            )}
            {!reorderMode && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => {
                  setMenuTreino(item);
                  setMenuVisible(true);
                }}
              >
                <Text style={styles.menuDots}>⋮</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMenuVisible(false);
          setMenuTreino(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setMenuVisible(false);
            setMenuTreino(null);
          }}
        >
          <Pressable style={styles.menuContent} onPress={() => {}}>
            <Text style={styles.menuTitle}>{menuTreino?.nome}</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEditTreino}
            >
              <Text style={styles.menuItemIcon}>✎</Text>
              <Text style={styles.menuItemText}>Editar treino</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDeleteTreino}
            >
              <Text style={[styles.menuItemIcon, styles.menuItemDangerText]}>
                ✕
              </Text>
              <Text style={[styles.menuItemText, styles.menuItemDangerText]}>
                Remover treino
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editTreinoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTreinoVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditTreinoVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Editar treino</Text>

            <Text style={styles.modalFieldLabel}>Código</Text>
            <TextInput
              style={styles.modalInput}
              value={editTreinoCodigo}
              onChangeText={setEditTreinoCodigo}
              autoCapitalize="characters"
              placeholderTextColor="#555"
              placeholder="A"
            />

            <Text style={styles.modalFieldLabel}>Nome</Text>
            <TextInput
              style={styles.modalInput}
              value={editTreinoNome}
              onChangeText={setEditTreinoNome}
              placeholderTextColor="#555"
              placeholder="Nome do treino"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditTreinoVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  const nome = editTreinoNome.trim();
                  const codigo = editTreinoCodigo.trim().toUpperCase();
                  if (!menuTreino || !nome || !codigo) {
                    Alert.alert("Atenção", "Informe código e nome do treino.");
                    return;
                  }
                  editTreinoMutation.mutate({
                    treinoId: menuTreino.id,
                    nome,
                    codigo,
                  });
                }}
              >
                <Text style={styles.modalSaveText}>
                  {editTreinoMutation.isPending ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editConjuntoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditConjuntoVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditConjuntoVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Editar nome da periodização</Text>
            <TextInput
              style={styles.modalInput}
              value={editConjuntoText}
              onChangeText={setEditConjuntoText}
              autoFocus
              placeholderTextColor="#555"
              placeholder="Nome da periodização"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditConjuntoVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  const nome = editConjuntoText.trim();
                  if (!nome) {
                    Alert.alert(
                      "Atenção",
                      "Informe um nome para a periodização.",
                    );
                    return;
                  }
                  editConjuntoMutation.mutate(nome);
                }}
              >
                <Text style={styles.modalSaveText}>
                  {editConjuntoMutation.isPending ? "Salvando..." : "Salvar"}
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
  container: { flex: 1, backgroundColor: "#0d0d0d", padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
  },
  contextHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  editConjuntoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  contextSub: { color: "#888", fontSize: 14, marginTop: 2 },
  historicoResumoText: {
    color: "#bdbdbd",
    fontSize: 13,
    marginTop: 8,
  },
  historicoBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#173324",
    borderWidth: 1,
    borderColor: "#2b6a44",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  historicoBtnText: {
    color: "#6ee7a3",
    fontSize: 14,
    fontWeight: "700",
  },
  editIcon: { color: "#555", fontSize: 14 },
  reorderBtnAfterSeparator: {
    alignSelf: "flex-end",
    marginBottom: 0,
    minHeight: 34,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
  },
  reorderControlsRow: {
    minHeight: 36,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  reorderActionsInline: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    minHeight: 34,
  },
  reorderBtnText: { color: "#888", fontSize: 13 },
  reorderBar: {
    marginTop: 8,
    marginBottom: 14,
    backgroundColor: "#151d17",
    borderWidth: 1,
    borderColor: "#23422f",
    borderRadius: 10,
    padding: 12,
  },
  reorderLabel: { color: "#9ccfb0", fontSize: 13, marginBottom: 10 },
  reorderActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: "center",
  },
  cancelBtnText: { color: "#888", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  codigo: {
    color: "#22c55e",
    fontSize: 24,
    fontWeight: "bold",
    width: 40,
    textAlign: "center",
  },
  nome: { color: "#fff", fontSize: 16, flex: 1 },
  menuBtn: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuDots: { color: "#888", fontSize: 22, fontWeight: "bold" },
  arrowContainer: {
    flexDirection: "column",
    gap: 4,
  },
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
  modalFieldLabel: {
    color: "#8b8b8b",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 4,
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
  menuItemDangerText: { color: "#ef4444" },
});
