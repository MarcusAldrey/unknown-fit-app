import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import type { AlunoResumo } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "AlunosList">;

export function AlunosListScreen({ navigation }: Props) {
  const { logout } = useAuth();

  const { data: alunos, isLoading } = useQuery<AlunoResumo[]>({
    queryKey: ["personal", "alunos"],
    queryFn: async () => {
      const res = await api.get("/personal/alunos");
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

  return (
    <View style={styles.container}>
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

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
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
    padding: 16,
    marginBottom: 12,
  },
  nome: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  email: { color: "#888", fontSize: 14, marginTop: 4 },
  empty: { color: "#888", textAlign: "center", marginTop: 32, fontSize: 16 },
  logoutBtn: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  logoutText: { color: "#22c55e", fontSize: 16 },
});
