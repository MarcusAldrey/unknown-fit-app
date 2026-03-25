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
import type { ConjuntoTreino, Treino } from "../../types";
import type { AlunoStackParamList } from "../../navigation/AlunoNavigator";

type Props = NativeStackScreenProps<AlunoStackParamList, "ConjuntoAtivo">;

export function ConjuntoAtivoScreen({ navigation }: Props) {
  const { logout } = useAuth();

  const { data: conjunto, isLoading: loadingConjunto } =
    useQuery<ConjuntoTreino>({
      queryKey: ["aluno", "conjunto-ativo"],
      queryFn: async () => {
        const res = await api.get("/aluno/me/conjunto-ativo");
        return res.data;
      },
    });

  const { data: treinos, isLoading: loadingTreinos } = useQuery<Treino[]>({
    queryKey: ["aluno", "conjunto-ativo", "treinos"],
    queryFn: async () => {
      const res = await api.get("/aluno/me/conjunto-ativo/treinos");
      return res.data;
    },
    enabled: !!conjunto,
  });

  if (loadingConjunto) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!conjunto) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Nenhuma periodização ativa.</Text>
        <Text style={styles.emptySub}>
          Peça ao seu personal para ativar uma periodização.
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.conjuntoNome}>{conjunto.nome}</Text>
        <Text style={styles.conjuntoSub}>Periodização ativa</Text>
      </View>

      {loadingTreinos ? (
        <ActivityIndicator
          size="large"
          color="#22c55e"
          style={{ marginTop: 32 }}
        />
      ) : (
        <FlatList
          data={treinos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("SessaoTreino", {
                  treinoId: item.id,
                  treinoCodigo: item.codigo,
                })
              }
            >
              <Text style={styles.codigo}>{item.codigo}</Text>
              <Text style={styles.nome}>{item.nome}</Text>
            </TouchableOpacity>
          )}
        />
      )}

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
    padding: 32,
  },
  header: { marginBottom: 24 },
  conjuntoNome: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  conjuntoSub: { color: "#888", fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  codigo: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "bold",
    width: 48,
    textAlign: "center",
  },
  nome: { color: "#fff", fontSize: 18, flex: 1 },
  empty: { color: "#888", textAlign: "center", fontSize: 18 },
  emptySub: { color: "#555", textAlign: "center", fontSize: 14, marginTop: 8 },
  logoutBtn: { alignItems: "center", paddingVertical: 12, marginTop: 16 },
  logoutText: { color: "#22c55e", fontSize: 16 },
});
