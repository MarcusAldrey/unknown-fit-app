import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { AlunoFicha, ConjuntoTreino } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "AlunoFicha">;

export function AlunoFichaScreen({ route, navigation }: Props) {
  const { alunoId } = route.params;
  const queryClient = useQueryClient();

  const { data: aluno, isLoading: loadingAluno } = useQuery<AlunoFicha>({
    queryKey: ["personal", "aluno", alunoId],
    queryFn: async () => {
      const res = await api.get(`/personal/alunos/${alunoId}`);
      return res.data;
    },
  });

  const { data: conjuntos, isLoading: loadingConjuntos } = useQuery<
    ConjuntoTreino[]
  >({
    queryKey: ["personal", "aluno", alunoId, "conjuntos"],
    queryFn: async () => {
      const res = await api.get(`/personal/alunos/${alunoId}/conjuntos`);
      return res.data;
    },
  });

  const sortedConjuntos = useMemo(() => {
    if (!conjuntos) return [];
    return [...conjuntos].sort((a, b) => {
      if (a.ativo && !b.ativo) return -1;
      if (!a.ativo && b.ativo) return 1;
      return 0;
    });
  }, [conjuntos]);

  const ativarMutation = useMutation({
    mutationFn: async (conjuntoId: string) => {
      await api.patch(
        `/personal/alunos/${alunoId}/conjuntos/${conjuntoId}/ativar`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "aluno", alunoId, "conjuntos"],
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível ativar a periodização.");
    },
  });

  if (loadingAluno || !aluno) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.alunoNome}>{aluno.nome}</Text>
        <Text style={styles.alunoEmail}>{aluno.email}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{aluno.idade ?? "—"}</Text>
            <Text style={styles.statLabel}>anos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {aluno.peso ? `${aluno.peso}` : "—"}
            </Text>
            <Text style={styles.statLabel}>kg</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {aluno.altura ? `${aluno.altura}` : "—"}
            </Text>
            <Text style={styles.statLabel}>m</Text>
          </View>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Periodizações</Text>
    </View>
  );

  const renderFooter = () => (
    <TouchableOpacity
      style={styles.addCard}
      onPress={() => navigation.navigate("CriarConjunto", { alunoId })}
    >
      <Text style={styles.addIcon}>+</Text>
      <Text style={styles.addText}>Nova Periodização</Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Nenhuma periodização criada.</Text>
      <Text style={styles.emptySub}>
        Crie a primeira periodização deste aluno.
      </Text>
    </View>
  );

  const formatDate = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <View style={styles.container}>
      {loadingConjuntos ? (
        <>
          {renderHeader()}
          <ActivityIndicator
            size="large"
            color="#22c55e"
            style={{ marginTop: 32 }}
          />
        </>
      ) : (
        <FlatList
          data={sortedConjuntos}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) =>
            item.ativo ? (
              <TouchableOpacity
                style={styles.cardAtivo}
                onPress={() =>
                  navigation.navigate("Treinos", {
                    conjuntoId: item.id,
                    conjuntoNome: item.nome,
                    alunoNome: aluno.nome,
                  })
                }
              >
                <View style={styles.ativoHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ativoNome}>{item.nome}</Text>
                    {(item.data_inicio || item.data_fim) && (
                      <Text style={styles.ativoDatas}>
                        {formatDate(item.data_inicio)}
                        {item.data_inicio && item.data_fim ? " → " : ""}
                        {formatDate(item.data_fim)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badge}>ATIVA</Text>
                  </View>
                </View>
                <View style={styles.ativoCta}>
                  <Text style={styles.ativoCtaText}>Ver treinos →</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cardInativo}
                onPress={() =>
                  navigation.navigate("Treinos", {
                    conjuntoId: item.id,
                    conjuntoNome: item.nome,
                    alunoNome: aluno.nome,
                  })
                }
              >
                <View style={styles.inativoRow}>
                  <Text style={styles.inativoNome}>{item.nome}</Text>
                  <TouchableOpacity
                    style={styles.ativarBtn}
                    onPress={() => ativarMutation.mutate(item.id)}
                  >
                    <Text style={styles.ativarText}>Ativar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          }
        />
      )}
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
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  alunoNome: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  alunoEmail: { color: "#888", fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: 16, gap: 24 },
  stat: { alignItems: "center" },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  statLabel: { color: "#888", fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },

  // --- Card Ativo (grande, destaque) ---
  cardAtivo: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#22c55e",
  },
  ativoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ativoNome: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  ativoDatas: { color: "#888", fontSize: 13, marginTop: 4 },
  badgeContainer: {
    backgroundColor: "#22c55e",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badge: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  ativoCta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  ativoCtaText: { color: "#22c55e", fontSize: 14, fontWeight: "600" },

  // --- Card Inativo (compacto) ---
  cardInativo: {
    backgroundColor: "#141414",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  inativoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inativoNome: { color: "#999", fontSize: 15, flex: 1 },
  ativarBtn: {
    backgroundColor: "#0a1f0a",
    borderWidth: 1,
    borderColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ativarText: { color: "#22c55e", fontSize: 13, fontWeight: "600" },

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
  emptyContainer: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: "#888", fontSize: 16 },
  emptySub: { color: "#555", fontSize: 13, marginTop: 4 },
});
