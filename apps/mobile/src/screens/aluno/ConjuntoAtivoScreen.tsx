import React, { useEffect, useState } from "react";
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
import type { ConjuntoTreino, Treino, SessaoAtiva } from "../../types";
import type { AlunoTreinoStackParamList } from "../../navigation/AlunoNavigator";

type Props = NativeStackScreenProps<AlunoTreinoStackParamList, "ConjuntoAtivo">;

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export function ConjuntoAtivoScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  const { data: sessaoAtiva, isLoading: loadingSessaoAtiva } =
    useQuery<SessaoAtiva | null>({
      queryKey: ["aluno", "sessao-ativa"],
      queryFn: async () => {
        try {
          const res = await api.get("/aluno/sessoes/ativa");
          return res.data;
        } catch (err: any) {
          if (err.response?.status === 404) return null;
          throw err;
        }
      },
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    });

  // Cronômetro para sessão ativa
  useEffect(() => {
    if (!sessaoAtiva) {
      setElapsedSeconds(0);
      return;
    }

    const iniciadoEm = new Date(sessaoAtiva.iniciado_em).getTime();
    const calcElapsed = () =>
      Math.max(0, Math.floor((Date.now() - iniciadoEm) / 1000));

    setElapsedSeconds(calcElapsed());

    const timer = setInterval(() => {
      setElapsedSeconds(calcElapsed());
    }, 1000);

    return () => clearInterval(timer);
  }, [sessaoAtiva]);

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

      {/* Continuar Treino */}
      {sessaoAtiva && (
        <TouchableOpacity
          style={styles.continueCard}
          onPress={() =>
            navigation.navigate("SessaoTreino", {
              treinoId: sessaoAtiva.treino_id,
              treinoCodigo: sessaoAtiva.treino_codigo,
              sessaoAtiva,
            })
          }
        >
          <View style={styles.continueLeft}>
            <Text style={styles.continueBadge}>EM ANDAMENTO</Text>
            <Text style={styles.continueTitle}>
              Continuar Treino {sessaoAtiva.treino_codigo}
            </Text>
            <Text style={styles.continueSub}>{sessaoAtiva.treino_nome}</Text>
          </View>
          <View style={styles.continueRight}>
            <Text style={styles.continueTimer}>
              {formatTime(elapsedSeconds)}
            </Text>
            <Text style={styles.continueArrow}>→</Text>
          </View>
        </TouchableOpacity>
      )}

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
  // Continuar Treino
  continueCard: {
    backgroundColor: "#132a1a",
    borderColor: "#22c55e",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  continueLeft: {
    flex: 1,
  },
  continueBadge: {
    color: "#22c55e",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  continueTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  continueSub: {
    color: "#a3a3a3",
    fontSize: 14,
    marginTop: 2,
  },
  continueRight: {
    alignItems: "center",
    marginLeft: 12,
  },
  continueTimer: {
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  continueArrow: {
    color: "#22c55e",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 4,
  },
  // Lista de treinos
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
