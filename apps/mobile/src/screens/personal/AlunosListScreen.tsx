import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AxiosError } from "axios";

import { hasAdminApiKey } from "../../api/client";
import { keys } from "../../api/queryKeys";
import { authService } from "../../api/services/auth";
import { personalService } from "../../api/services/personal";
import { useAuth } from "../../contexts/AuthContext";
import type { AlunoResumo, Usuario } from "@kine/types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<PersonalStackParamList, "AlunosList">;

export function AlunosListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuAberto, setMenuAberto] = useState(false);

  const { data: usuario } = useQuery<Usuario>({
    queryKey: keys.auth.me(),
    queryFn: () => authService.me(),
  });

  const {
    data: alunos,
    isLoading,
    isError,
    error,
  } = useQuery<AlunoResumo[], AxiosError<{ detail?: string }>>({
    queryKey: keys.personal.alunos(),
    queryFn: () => personalService.alunos(),
  });

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Erro ao carregar alunos</Text>
        <Text style={styles.errorText}>
          {error.response?.data?.detail ??
            "Verifique conexão com a API e login."}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {menuAberto ? (
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuAberto(false)}
        />
      ) : null}

      <View style={styles.topBar}>
        <Text style={styles.topBarNome}>{usuario?.nome ?? "Meus Alunos"}</Text>
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
              {hasAdminApiKey ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuAberto(false);
                    navigation.navigate("AdminUsuarios");
                  }}
                >
                  <Text style={styles.menuItemTextNeutral}>
                    Gestão Usuários
                  </Text>
                </TouchableOpacity>
              ) : null}
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

      <Text style={styles.sectionTitle}>Meus Alunos</Text>
      <View style={styles.sectionSeparator} />

      <FlatList
        data={alunos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum aluno vinculado.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("AlunoFicha", { alunoId: item.id })
            }
          >
            <Text style={styles.nome}>{item.nome}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    position: "relative",
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.001)",
    elevation: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
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
  menuItemTextNeutral: {
    color: colors.text,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nome: { color: colors.text, fontSize: 18, fontWeight: "bold" },
  email: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 32, fontSize: 16 },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
