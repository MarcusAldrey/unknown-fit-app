import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AxiosError } from "axios";

import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import type { ExercicioBase, Usuario } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "CatalogoExercicios"
>;

export function CatalogoExerciciosScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [menuAberto, setMenuAberto] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("Todos");

  const { data: usuario } = useQuery<Usuario>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await api.get("/auth/me");
      return res.data;
    },
  });

  const {
    data: exerciciosBase,
    isLoading,
    isError,
    error,
  } = useQuery<ExercicioBase[], AxiosError<{ detail?: string }>>({
    queryKey: ["catalogo", "exercicios-base"],
    queryFn: async () => {
      const res = await api.get("/catalogo/exercicios-base");
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const grupos = useMemo(() => {
    const base = exerciciosBase ?? [];
    const unicos = Array.from(
      new Set(base.map((ex) => ex.grupo_muscular)),
    ).sort((a, b) => a.localeCompare(b));
    return ["Todos", ...unicos];
  }, [exerciciosBase]);

  const exerciciosFiltrados = useMemo(() => {
    const base = exerciciosBase ?? [];
    const termo = searchText.trim().toLowerCase();

    const recursosTexto = (ex: ExercicioBase) =>
      ex.requisitos_alternativos_recurso
        .map((recurso) => recurso.nome)
        .join(", ");

    return base.filter((ex) => {
      const matchGrupo =
        grupoFiltro === "Todos" || ex.grupo_muscular === grupoFiltro;
      const matchBusca =
        !termo ||
        ex.nome.toLowerCase().includes(termo) ||
        ex.grupo_muscular.toLowerCase().includes(termo) ||
        ex.implemento_execucao.toLowerCase().includes(termo) ||
        recursosTexto(ex).toLowerCase().includes(termo);
      return matchGrupo && matchBusca;
    });
  }, [exerciciosBase, searchText, grupoFiltro]);

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
        <Text style={styles.errorTitle}>Erro ao carregar exercícios</Text>
        <Text style={styles.errorText}>
          {error.response?.data?.detail ??
            "Verifique conexão com a API e login."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topBar}>
        <Text style={styles.topBarNome}>{usuario?.nome ?? "Exercícios"}</Text>
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

      <Text style={styles.sectionTitle}>Exercícios</Text>
      <View style={styles.sectionSeparator} />

      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Buscar exercício, grupo, implemento ou recurso"
        placeholderTextColor="#666"
      />

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={grupos}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                grupoFiltro === item && styles.filterChipActive,
              ]}
              onPress={() => setGrupoFiltro(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  grupoFiltro === item && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={exerciciosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum exercício encontrado.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("EditarExercicioBase", {
                exercicio: item,
              })
            }
          >
            {item.requisitos_alternativos_recurso.length > 0 ? (
              <Text style={styles.resourceInfo}>
                Requisitos:{" "}
                {item.requisitos_alternativos_recurso
                  .map((r) => r.nome)
                  .join(" ou ")}
              </Text>
            ) : null}
            <Text style={styles.nome}>{item.nome}</Text>
            <Text style={styles.subInfo}>
              {item.grupo_muscular}
              {item.implemento_execucao ? ` · ${item.implemento_execucao}` : ""}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d", paddingHorizontal: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
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
  searchInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#282828",
  },
  filterRow: {
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: "#132817",
    borderColor: "#245132",
  },
  filterChipText: { color: "#888", fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: "#9fe6b4" },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nome: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  resourceInfo: {
    color: "#9fe6b4",
    fontSize: 12,
    marginBottom: 6,
  },
  subInfo: { color: "#888", fontSize: 14, marginTop: 4 },
  empty: { color: "#888", textAlign: "center", marginTop: 32, fontSize: 16 },
  errorTitle: {
    color: "#fca5a5",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
