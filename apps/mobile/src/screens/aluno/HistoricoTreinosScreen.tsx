import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import type { SessaoResumo, Usuario } from "../../types";
import type { AlunoHistoricoStackParamList } from "../../navigation/AlunoNavigator";

type Props = NativeStackScreenProps<
  AlunoHistoricoStackParamList,
  "HistoricoTreinos"
>;

function formatDate(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDuration(startIso: string, endIso: string | null) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));

  const minutes = Math.floor(diffSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(diffSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function HistoricoTreinosScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuAberto, setMenuAberto] = useState(false);

  const { data: usuario } = useQuery<Usuario>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await api.get("/auth/me");
      return res.data;
    },
  });

  const { data, isLoading, isError } = useQuery<SessaoResumo[]>({
    queryKey: ["aluno", "sessoes", "historico"],
    queryFn: async () => {
      const res = await api.get("/aluno/sessoes");
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Erro ao carregar histórico.</Text>
      </View>
    );
  }

  const sessoes = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.pagePadding}>
        <View style={styles.topBar}>
          <Text style={styles.topBarNome}>{usuario?.nome ?? "Perfil"}</Text>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setMenuAberto((current) => !current)}
            >
              <View style={styles.kebabIcon}>
                <View style={styles.kebabDot} />
                <View style={styles.kebabDot} />
                <View style={styles.kebabDot} />
              </View>
            </TouchableOpacity>

            {menuAberto ? (
              <View style={styles.settingsMenu}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={async () => {
                    setMenuAberto(false);
                    await logout();
                  }}
                >
                  <Text style={styles.menuItemText}>Sair</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Treinamentos</Text>
        <View style={styles.sectionSeparator} />
      </View>

      {!sessoes.length ? (
        <View style={styles.centerBody}>
          <Text style={styles.empty}>Você ainda não finalizou treinos.</Text>
        </View>
      ) : (
        <FlatList
          data={sessoes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("DetalheTreinoRealizado", { sessao: item })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.codigo}>{item.treino_codigo}</Text>
                <Text
                  style={
                    item.status === "FINALIZADO"
                      ? styles.statusDone
                      : styles.statusOpen
                  }
                >
                  {item.status === "FINALIZADO" ? "Finalizado" : "Em andamento"}
                </Text>
              </View>
              <Text style={styles.nome}>{item.treino_nome}</Text>
              <Text style={styles.meta}>
                Data: {formatDate(item.iniciado_em)} · Duração:{" "}
                {formatDuration(item.iniciado_em, item.finalizado_em)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  pagePadding: {
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0d0d",
    padding: 24,
  },
  centerBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarNome: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  topBarRight: {
    position: "relative",
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2b2b2b",
    backgroundColor: "#151515",
  },
  kebabIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  kebabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d4d4d4",
  },
  settingsMenu: {
    position: "absolute",
    top: 42,
    right: 0,
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#151515",
    overflow: "hidden",
    zIndex: 50,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#d4d4d4",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 18,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: "#252525",
    marginTop: 8,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: { color: "#8d8d8d", fontSize: 16, textAlign: "center" },
  error: { color: "#f87171", fontSize: 16, textAlign: "center" },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#242424",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  codigo: { color: "#22c55e", fontWeight: "700", fontSize: 16 },
  nome: { color: "#fff", fontSize: 16, fontWeight: "600" },
  meta: { color: "#9a9a9a", marginTop: 6, fontSize: 13 },
  statusDone: { color: "#22c55e", fontSize: 12, fontWeight: "700" },
  statusOpen: { color: "#facc15", fontSize: 12, fontWeight: "700" },
});
