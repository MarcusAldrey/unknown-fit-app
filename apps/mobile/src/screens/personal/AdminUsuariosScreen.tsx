import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api, { hasAdminApiKey } from "../../api/client";
import type {
  AlunoAdmin,
  AlunoAdminCreateRequest,
  PersonalAdmin,
  PersonalAdminCreateRequest,
} from "../../types";

type Aba = "personais" | "alunos";

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("invalid_number");
  }

  return parsed;
}

function parseOptionalInteger(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    throw new Error("invalid_integer");
  }

  return parsed;
}

export function AdminUsuariosScreen() {
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("personais");

  const [personalNome, setPersonalNome] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalSenha, setPersonalSenha] = useState("");

  const [alunoNome, setAlunoNome] = useState("");
  const [alunoEmail, setAlunoEmail] = useState("");
  const [alunoSenha, setAlunoSenha] = useState("");
  const [alunoIdade, setAlunoIdade] = useState("");
  const [alunoPeso, setAlunoPeso] = useState("");
  const [alunoAltura, setAlunoAltura] = useState("");
  const [alunoPersonalId, setAlunoPersonalId] = useState("");
  const [treinaCondominio, setTreinaCondominio] = useState(false);

  const personaisQuery = useQuery<PersonalAdmin[]>({
    queryKey: ["admin", "personais"],
    queryFn: async () => {
      const res = await api.get("/admin/personais");
      return res.data;
    },
    enabled: hasAdminApiKey && aba === "personais",
  });

  const alunosQuery = useQuery<AlunoAdmin[]>({
    queryKey: ["admin", "alunos"],
    queryFn: async () => {
      const res = await api.get("/admin/alunos");
      return res.data;
    },
    enabled: hasAdminApiKey && aba === "alunos",
  });

  const createPersonalMutation = useMutation({
    mutationFn: async (payload: PersonalAdminCreateRequest) => {
      const res = await api.post<PersonalAdmin>("/admin/personais", payload);
      return res.data;
    },
    onSuccess: () => {
      setPersonalNome("");
      setPersonalEmail("");
      setPersonalSenha("");
      queryClient.invalidateQueries({ queryKey: ["admin", "personais"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível criar o personal.",
      );
    },
  });

  const createAlunoMutation = useMutation({
    mutationFn: async (payload: AlunoAdminCreateRequest) => {
      const res = await api.post<AlunoAdmin>("/admin/alunos", payload);
      return res.data;
    },
    onSuccess: () => {
      setAlunoNome("");
      setAlunoEmail("");
      setAlunoSenha("");
      setAlunoIdade("");
      setAlunoPeso("");
      setAlunoAltura("");
      setAlunoPersonalId("");
      setTreinaCondominio(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "alunos"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string" ? detail : "Não foi possível criar o aluno.",
      );
    },
  });

  const updatePersonalMutation = useMutation({
    mutationFn: async ({
      personalId,
      ativo,
    }: {
      personalId: string;
      ativo: boolean;
    }) => {
      await api.patch(`/admin/personais/${personalId}`, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "personais"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível atualizar o personal.",
      );
    },
  });

  const updateAlunoMutation = useMutation({
    mutationFn: async ({
      alunoId,
      ativo,
    }: {
      alunoId: string;
      ativo: boolean;
    }) => {
      await api.patch(`/admin/alunos/${alunoId}`, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "alunos"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível atualizar o aluno.",
      );
    },
  });

  const deletePersonalMutation = useMutation({
    mutationFn: async (personalId: string) => {
      await api.delete(`/admin/personais/${personalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "personais"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível excluir o personal.",
      );
    },
  });

  const deleteAlunoMutation = useMutation({
    mutationFn: async (alunoId: string) => {
      await api.delete(`/admin/alunos/${alunoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "alunos"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível excluir o aluno.",
      );
    },
  });

  const listaAtual = useMemo(() => {
    return aba === "personais"
      ? (personaisQuery.data ?? [])
      : (alunosQuery.data ?? []);
  }, [aba, personaisQuery.data, alunosQuery.data]);

  const loadingAtual =
    aba === "personais" ? personaisQuery.isLoading : alunosQuery.isLoading;

  function handleCreatePersonal() {
    if (
      !personalNome.trim() ||
      !personalEmail.trim() ||
      !personalSenha.trim()
    ) {
      Alert.alert("Erro", "Preencha nome, e-mail e senha do personal.");
      return;
    }

    createPersonalMutation.mutate({
      nome: personalNome.trim(),
      email: personalEmail.trim().toLowerCase(),
      senha: personalSenha,
    });
  }

  function handleCreateAluno() {
    if (!alunoNome.trim() || !alunoEmail.trim() || !alunoSenha.trim()) {
      Alert.alert("Erro", "Preencha nome, e-mail e senha do aluno.");
      return;
    }

    try {
      const idade = parseOptionalInteger(alunoIdade);
      const peso = parseOptionalNumber(alunoPeso);
      const altura = parseOptionalNumber(alunoAltura);

      createAlunoMutation.mutate({
        nome: alunoNome.trim(),
        email: alunoEmail.trim().toLowerCase(),
        senha: alunoSenha,
        idade,
        peso,
        altura,
        personal_id: alunoPersonalId.trim() || undefined,
        treina_em_academia_condominio: treinaCondominio,
      });
    } catch {
      Alert.alert(
        "Erro",
        "Campos numéricos inválidos. Revise idade, peso e altura.",
      );
    }
  }

  function confirmarExclusaoPersonal(personal: PersonalAdmin) {
    Alert.alert(
      "Excluir personal",
      `Confirma excluir ${personal.nome}? Esta ação é irreversível.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => deletePersonalMutation.mutate(personal.personal_id),
        },
      ],
    );
  }

  function confirmarExclusaoAluno(aluno: AlunoAdmin) {
    Alert.alert(
      "Excluir aluno",
      `Confirma excluir ${aluno.nome}? Esta ação remove todos os dados relacionados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => deleteAlunoMutation.mutate(aluno.aluno_id),
        },
      ],
    );
  }

  if (!hasAdminApiKey) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorTitle}>Gestão admin indisponível</Text>
        <Text style={styles.errorText}>
          Defina EXPO_PUBLIC_ADMIN_API_KEY no ambiente para habilitar esta tela.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            aba === "personais" && styles.tabButtonActive,
          ]}
          onPress={() => setAba("personais")}
        >
          <Text
            style={[
              styles.tabText,
              aba === "personais" && styles.tabTextActive,
            ]}
          >
            Personais
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, aba === "alunos" && styles.tabButtonActive]}
          onPress={() => setAba("alunos")}
        >
          <Text
            style={[styles.tabText, aba === "alunos" && styles.tabTextActive]}
          >
            Alunos
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.formSection}
        contentContainerStyle={styles.formContent}
      >
        {aba === "personais" ? (
          <>
            <Text style={styles.sectionTitle}>Novo personal</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor="#777"
              value={personalNome}
              onChangeText={setPersonalNome}
            />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#777"
              autoCapitalize="none"
              keyboardType="email-address"
              value={personalEmail}
              onChangeText={setPersonalEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#777"
              secureTextEntry
              value={personalSenha}
              onChangeText={setPersonalSenha}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreatePersonal}
              disabled={createPersonalMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {createPersonalMutation.isPending
                  ? "Criando..."
                  : "Criar personal"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Novo aluno</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor="#777"
              value={alunoNome}
              onChangeText={setAlunoNome}
            />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#777"
              autoCapitalize="none"
              keyboardType="email-address"
              value={alunoEmail}
              onChangeText={setAlunoEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#777"
              secureTextEntry
              value={alunoSenha}
              onChangeText={setAlunoSenha}
            />
            <TextInput
              style={styles.input}
              placeholder="Idade (opcional)"
              placeholderTextColor="#777"
              keyboardType="numeric"
              value={alunoIdade}
              onChangeText={setAlunoIdade}
            />
            <TextInput
              style={styles.input}
              placeholder="Peso (opcional)"
              placeholderTextColor="#777"
              keyboardType="numeric"
              value={alunoPeso}
              onChangeText={setAlunoPeso}
            />
            <TextInput
              style={styles.input}
              placeholder="Altura (opcional)"
              placeholderTextColor="#777"
              keyboardType="numeric"
              value={alunoAltura}
              onChangeText={setAlunoAltura}
            />
            <TextInput
              style={styles.input}
              placeholder="Personal ID (opcional)"
              placeholderTextColor="#777"
              autoCapitalize="none"
              value={alunoPersonalId}
              onChangeText={setAlunoPersonalId}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Treina em academia de condomínio
              </Text>
              <Switch
                value={treinaCondominio}
                onValueChange={setTreinaCondominio}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateAluno}
              disabled={createAlunoMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {createAlunoMutation.isPending ? "Criando..." : "Criar aluno"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Registros</Text>

        {loadingAtual ? (
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="small" color="#22c55e" />
          </View>
        ) : (
          <FlatList
            data={listaAtual}
            keyExtractor={(item: any) =>
              aba === "personais" ? item.personal_id : item.aluno_id
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhum registro encontrado.</Text>
            }
            renderItem={({ item }) => {
              if (aba === "personais") {
                const personal = item as PersonalAdmin;
                return (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{personal.nome}</Text>
                    <Text style={styles.cardSubtitle}>{personal.email}</Text>
                    <Text style={styles.cardMeta}>
                      ID: {personal.personal_id}
                    </Text>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[
                          styles.secondaryButton,
                          personal.ativo ? styles.warnButton : styles.okButton,
                        ]}
                        onPress={() =>
                          updatePersonalMutation.mutate({
                            personalId: personal.personal_id,
                            ativo: !personal.ativo,
                          })
                        }
                      >
                        <Text style={styles.secondaryButtonText}>
                          {personal.ativo ? "Desativar" : "Ativar"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.secondaryButton, styles.dangerButton]}
                        onPress={() => confirmarExclusaoPersonal(personal)}
                      >
                        <Text style={styles.secondaryButtonText}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              const aluno = item as AlunoAdmin;
              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{aluno.nome}</Text>
                  <Text style={styles.cardSubtitle}>{aluno.email}</Text>
                  <Text style={styles.cardMeta}>ID: {aluno.aluno_id}</Text>
                  <Text style={styles.cardMeta}>
                    Personal: {aluno.personal_id ?? "sem vínculo"}
                  </Text>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        aluno.ativo ? styles.warnButton : styles.okButton,
                      ]}
                      onPress={() =>
                        updateAlunoMutation.mutate({
                          alunoId: aluno.aluno_id,
                          ativo: !aluno.ativo,
                        })
                      }
                    >
                      <Text style={styles.secondaryButtonText}>
                        {aluno.ativo ? "Desativar" : "Ativar"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.dangerButton]}
                      onPress={() => confirmarExclusaoAluno(aluno)}
                    >
                      <Text style={styles.secondaryButtonText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: "#fca5a5",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: "#a3a3a3",
    textAlign: "center",
    lineHeight: 20,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#141414",
  },
  tabButtonActive: {
    backgroundColor: "#1f2937",
    borderColor: "#334155",
  },
  tabText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#e5e7eb",
  },
  formSection: {
    maxHeight: 330,
    marginTop: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#1f1f1f",
  },
  formContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#161616",
    borderColor: "#2b2b2b",
    borderWidth: 1,
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#151515",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchLabel: {
    color: "#d1d5db",
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  loaderWrapper: {
    marginTop: 20,
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  emptyText: {
    color: "#777",
    textAlign: "center",
    marginTop: 24,
  },
  card: {
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#9ca3af",
    marginTop: 2,
    marginBottom: 6,
  },
  cardMeta: {
    color: "#7c7c7c",
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  warnButton: {
    backgroundColor: "#a16207",
  },
  okButton: {
    backgroundColor: "#15803d",
  },
  dangerButton: {
    backgroundColor: "#b91c1c",
  },
});
