import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { keys } from "../../api/queryKeys";
import { personalService } from "../../api/services/personal";
import type {
  AlunoFicha,
  ConjuntoTreino,
  RegistroPeso,
  RegistroPesoCreate,
} from "@ecg/types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<PersonalStackParamList, "AlunoFicha">;

export function AlunoFichaScreen({ route, navigation }: Props) {
  const { alunoId } = route.params;
  const queryClient = useQueryClient();
  const [novoPeso, setNovoPeso] = useState("");
  const [modalPesoVisivel, setModalPesoVisivel] = useState(false);

  const { data: aluno, isLoading: loadingAluno } = useQuery<AlunoFicha>({
    queryKey: keys.personal.aluno(alunoId),
    queryFn: () => personalService.fichaAluno(alunoId),
  });

  const { data: conjuntos, isLoading: loadingConjuntos } = useQuery<
    ConjuntoTreino[]
  >({
    queryKey: keys.personal.alunoConjuntos(alunoId),
    queryFn: () => personalService.alunoConjuntos(alunoId),
  });

  const { data: registrosPeso, isLoading: loadingPeso } = useQuery<
    RegistroPeso[]
  >({
    queryKey: keys.personal.alunoPeso(alunoId),
    queryFn: () => personalService.alunoPeso(alunoId),
  });

  const sortedConjuntos = useMemo(() => {
    if (!conjuntos) return [];

    const toTime = (value: string | null) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
    };

    return [...conjuntos].sort((a, b) => {
      if (a.ativo && !b.ativo) return -1;
      if (!a.ativo && b.ativo) return 1;

      const inicioDiff = toTime(a.data_inicio) - toTime(b.data_inicio);
      if (inicioDiff !== 0) return inicioDiff;

      return toTime(a.data_fim) - toTime(b.data_fim);
    });
  }, [conjuntos]);

  const conjuntoAtivo = useMemo(
    () => conjuntos?.find((conjunto) => conjunto.ativo) ?? null,
    [conjuntos],
  );

  const ultimoRegistroPeso = useMemo(
    () => (registrosPeso && registrosPeso.length > 0 ? registrosPeso[0] : null),
    [registrosPeso],
  );

  const ativarMutation = useMutation({
    mutationFn: async (conjuntoId: string) => {
      await personalService.ativarConjunto(alunoId, conjuntoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keys.personal.alunoConjuntos(alunoId),
      });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível ativar a periodização.",
      );
    },
  });

  const registrarPesoMutation = useMutation({
    mutationFn: async (payload: RegistroPesoCreate) => {
      await personalService.registrarPeso(alunoId, payload.peso);
    },
    onSuccess: () => {
      setNovoPeso("");
      setModalPesoVisivel(false);
      queryClient.invalidateQueries({
        queryKey: keys.personal.aluno(alunoId),
      });
      queryClient.invalidateQueries({
        queryKey: keys.personal.alunoPeso(alunoId),
      });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível registrar o peso.",
      );
    },
  });

  if (loadingAluno || !aluno) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleRegistrarNovoPeso = () => {
    const normalizado = novoPeso.trim().replace(",", ".");
    if (!normalizado) {
      Alert.alert("Atenção", "Informe um peso para registrar.");
      return;
    }

    const valor = Number(normalizado);
    if (!Number.isFinite(valor) || valor <= 0) {
      Alert.alert("Atenção", "Informe um valor válido de peso.");
      return;
    }

    registrarPesoMutation.mutate({ peso: valor });
  };

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
              {aluno.altura ? `${aluno.altura}` : "—"}
            </Text>
            <Text style={styles.statLabel}>m</Text>
          </View>
        </View>

        <View style={styles.pesoBox}>
          <View style={styles.pesoHeader}>
            <Text style={styles.pesoTitulo}>Peso do aluno</Text>
            <TouchableOpacity
              style={styles.pesoAddButton}
              onPress={() => setModalPesoVisivel(true)}
            >
              <Text style={styles.pesoAddButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          {loadingPeso ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginTop: 8 }}
            />
          ) : (
            <>
              <Text style={styles.pesoAtual}>
                {ultimoRegistroPeso?.peso ?? aluno.peso ?? "—"} kg
              </Text>
              <Text style={styles.pesoData}>
                {ultimoRegistroPeso
                  ? `Último registro em ${new Date(
                      ultimoRegistroPeso.registrado_em,
                    ).toLocaleDateString("pt-BR")}`
                  : "Sem registro de peso até agora."}
              </Text>
            </>
          )}
        </View>

        <View style={styles.recursosBox}>
          <Text style={styles.recursosTitle}>
            Disponibilidade de equipamentos
          </Text>
          <Text style={styles.condominioResumo}>
            Este aluno{" "}
            {aluno.treina_em_academia_condominio ? "TREINA" : "NÃO TREINA"} em
            condomínio
          </Text>

          <TouchableOpacity
            style={styles.gerirRecursosButton}
            onPress={() =>
              navigation.navigate("GerirRecursosAluno", {
                alunoId,
                alunoNome: aluno.nome,
              })
            }
          >
            <Text style={styles.gerirRecursosButtonText}>
              Gerir disponibilidade de equipamentos
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Periodizações</Text>
    </View>
  );

  const renderFooter = () => (
    <TouchableOpacity
      style={styles.addCard}
      onPress={() =>
        navigation.navigate("CriarConjunto", { alunoId, alunoNome: aluno.nome })
      }
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
    if (!d) return "—";
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
            color={colors.primary}
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
                    alunoId,
                    conjuntoId: item.id,
                    conjuntoNome: item.nome,
                    alunoNome: aluno.nome,
                  })
                }
              >
                <View style={styles.ativoHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ativoNome}>{item.nome}</Text>
                    <View style={styles.datasContainer}>
                      <Text style={styles.ativoDatas}>
                        Início em: {formatDate(item.data_inicio)}
                      </Text>
                    </View>
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
                    alunoId,
                    conjuntoId: item.id,
                    conjuntoNome: item.nome,
                    alunoNome: aluno.nome,
                  })
                }
              >
                <View style={styles.inativoRow}>
                  <View style={styles.inativoInfo}>
                    <Text style={styles.inativoNome}>{item.nome}</Text>
                    <View style={styles.datasContainer}>
                      <Text style={styles.inativoDatas}>
                        Início em: {formatDate(item.data_inicio)}
                      </Text>
                      <Text style={styles.inativoDatas}>
                        Término em: {formatDate(item.data_fim)}
                      </Text>
                    </View>
                  </View>
                  {item.data_fim ? (
                    <View style={styles.concluidaBadge}>
                      <Text style={styles.concluidaText}>Concluída</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.ativarBtn}
                      onPress={() => {
                        if (!conjuntoAtivo || conjuntoAtivo.id === item.id) {
                          ativarMutation.mutate(item.id);
                          return;
                        }

                        Alert.alert(
                          "Confirmar ativação",
                          `Ao ativar a periodização ${item.nome}, a periodização ${conjuntoAtivo.nome} será marcada como concluída. Tem certeza?`,
                          [
                            { text: "Cancelar", style: "cancel" },
                            {
                              text: "Ativar periodização",
                              onPress: () => ativarMutation.mutate(item.id),
                            },
                          ],
                        );
                      }}
                    >
                      <Text style={styles.ativarText}>Ativar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )
          }
        />
      )}

      <Modal
        visible={modalPesoVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPesoVisivel(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalPesoVisivel(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Novo registro de peso</Text>
            <TextInput
              value={novoPeso}
              onChangeText={setNovoPeso}
              placeholder="Peso em kg"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setModalPesoVisivel(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleRegistrarNovoPeso}
                disabled={registrarPesoMutation.isPending}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {registrarPesoMutation.isPending
                    ? "Salvando..."
                    : "Registrar"}
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
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  alunoNome: { color: colors.text, fontSize: 22, fontWeight: "bold" },
  alunoEmail: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: 16, gap: 24 },
  stat: { alignItems: "center" },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "bold" },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  pesoBox: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    paddingTop: 12,
  },
  pesoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pesoTitulo: { color: colors.text, fontSize: 13, fontWeight: "600" },
  pesoAddButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pesoAddButtonText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  pesoAtual: { color: colors.text, fontSize: 19, fontWeight: "700", marginTop: 8 },
  pesoData: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  recursosBox: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    paddingTop: 12,
  },
  recursosTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  condominioResumo: {
    color: colors.primary,
    fontSize: 13,
    marginTop: 8,
  },
  gerirRecursosButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    alignItems: "center",
  },
  gerirRecursosButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },

  // --- Card Ativo (grande, destaque) ---
  cardAtivo: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  ativoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ativoNome: { color: colors.text, fontSize: 20, fontWeight: "bold" },
  datasContainer: { marginTop: 4 },
  ativoDatas: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  badgeContainer: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badge: { color: colors.text, fontSize: 11, fontWeight: "bold" },
  ativoCta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  ativoCtaText: { color: colors.primary, fontSize: 14, fontWeight: "600" },

  // --- Card Inativo (compacto) ---
  cardInativo: {
    backgroundColor: colors.surface,
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
  inativoInfo: { flex: 1, paddingRight: 12 },
  inativoNome: { color: colors.textMuted, fontSize: 15 },
  inativoDatas: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  ativarBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ativarText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  concluidaBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  concluidaText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  // --- Footer / Empty ---
  addCard: {
    borderWidth: 1,
    borderColor: colors.surface,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addIcon: { color: colors.primary, fontSize: 20, fontWeight: "bold" },
  addText: { color: colors.textMuted, fontSize: 15 },
  emptyContainer: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  emptySub: { color: colors.border, fontSize: 13, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderColor: colors.surface,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalButtonSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  modalButtonSecondaryText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  modalButtonPrimary: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modalButtonPrimaryText: { color: colors.text, fontWeight: "700", fontSize: 13 },
});
