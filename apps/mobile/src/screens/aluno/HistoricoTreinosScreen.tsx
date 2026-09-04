import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { keys } from "../../api/queryKeys";
import { authService } from "../../api/services/auth";
import { alunoService } from "../../api/services/aluno";
import { useAuth } from "../../contexts/AuthContext";
import type { SessaoResumo, Usuario } from "@kine/types";
import type { AlunoHistoricoStackParamList } from "../../navigation/AlunoNavigator";
import { colors } from "../../theme/colors";

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
    queryKey: keys.auth.me(),
    queryFn: () => authService.me(),
  });

  const { data, isLoading, isError } = useQuery<SessaoResumo[]>({
    queryKey: keys.aluno.sessoes(),
    queryFn: () => alunoService.sessoes(),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
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
      {menuAberto ? (
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuAberto(false)}
        />
      ) : null}

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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    position: "relative",
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.001)",
    elevation: 4,
  },
  pagePadding: {
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
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
    zIndex: 20,
  },
  topBarNome: {
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.text,
  },
  settingsMenu: {
    position: "absolute",
    top: 42,
    right: 0,
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    zIndex: 50,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 18,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: { color: colors.textMuted, fontSize: 16, textAlign: "center" },
  error: { color: colors.danger, fontSize: 16, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  codigo: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  nome: { color: colors.text, fontSize: 16, fontWeight: "600" },
  meta: { color: colors.textMuted, marginTop: 6, fontSize: 13 },
  statusDone: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  statusOpen: { color: colors.warning, fontSize: 12, fontWeight: "700" },
});
