import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { Treino } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "Treinos">;

export function TreinosScreen({ route, navigation }: Props) {
  const { conjuntoId, conjuntoNome, alunoNome } = route.params;
  const queryClient = useQueryClient();

  const { data: treinos, isLoading } = useQuery<Treino[]>({
    queryKey: ["personal", "conjunto", conjuntoId, "treinos"],
    queryFn: async () => {
      const res = await api.get(`/personal/conjuntos/${conjuntoId}/treinos`);
      return res.data;
    },
  });

  const [reorderMode, setReorderMode] = useState(false);
  const [localTreinos, setLocalTreinos] = useState<Treino[]>([]);

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

  const renderHeader = () => (
    <View style={styles.contextHeader}>
      <View style={styles.contextRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contextTitle}>{conjuntoNome}</Text>
          <Text style={styles.contextSub}>{alunoNome}</Text>
        </View>
        {!reorderMode && displayTreinos.length > 1 && (
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
            Segure e use as setas para reordenar
          </Text>
          <View style={styles.reorderActions}>
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
        </View>
      )}
    </View>
  );

  const renderFooter = () =>
    !reorderMode ? (
      <TouchableOpacity
        style={styles.addCard}
        onPress={() =>
          navigation.navigate("CriarTreino", {
            conjuntoId,
            conjuntoNome,
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
          conjuntoId,
          conjuntoNome,
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
          </TouchableOpacity>
        )}
      />
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
  contextTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  contextSub: { color: "#888", fontSize: 14, marginTop: 2 },
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
});
