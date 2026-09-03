import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { keys } from "../../api/queryKeys";
import { catalogoService } from "../../api/services/catalogo";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";
import type {
  ExercicioBase,
  ImplementoExecucao,
  RecursoTreino,
} from "@ecg/types";
import { colors } from "../../theme/colors";

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "EditarExercicioBase"
>;

interface FormData {
  nome: string;
  grupo_muscular: string;
  implemento_execucao: string;
  pode_ser_feito_em_casa: boolean;
}

export function EditarExercicioBaseScreen({ route, navigation }: Props) {
  const { exercicio } = route.params;
  const queryClient = useQueryClient();

  const [showGrupoDropdown, setShowGrupoDropdown] = useState(false);
  const [requisitosSelecionados, setRequisitosSelecionados] = useState<string[]>(
    exercicio.requisitos_alternativos_recurso.map((recurso) => recurso.id),
  );
  const [modalTipo, setModalTipo] = useState<"implemento" | "recurso" | null>(
    null,
  );
  const [novoNome, setNovoNome] = useState("");

  const { control, handleSubmit, setValue, watch } = useForm<FormData>({
    defaultValues: {
      nome: exercicio.nome,
      grupo_muscular: exercicio.grupo_muscular,
      implemento_execucao: exercicio.implemento_execucao,
      pode_ser_feito_em_casa: exercicio.pode_ser_feito_em_casa,
    },
  });

  const grupoMuscular = watch("grupo_muscular");

  const { data: exerciciosBase } = useQuery<ExercicioBase[]>({
    queryKey: keys.catalogo.exerciciosBase(),
    queryFn: () => catalogoService.exerciciosBase(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: recursos } = useQuery<RecursoTreino[]>({
    queryKey: keys.catalogo.recursosTreino(),
    queryFn: () => catalogoService.recursosTreino(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: implementos } = useQuery<ImplementoExecucao[]>({
    queryKey: keys.catalogo.implementosExecucao(),
    queryFn: () => catalogoService.implementosExecucao(),
    staleTime: 1000 * 60 * 10,
  });

  const grupos = useMemo(() => {
    const base = exerciciosBase ?? [];
    return Array.from(new Set(base.map((ex) => ex.grupo_muscular))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [exerciciosBase]);

  const gruposFiltrados = useMemo(() => {
    const termo = normalizarTexto(grupoMuscular.trim());
    if (!termo) return grupos;
    return grupos.filter((grupo) => normalizarTexto(grupo).includes(termo));
  }, [grupos, grupoMuscular]);

  const toggleRequisito = (recursoId: string) => {
    setRequisitosSelecionados((prev) =>
      prev.includes(recursoId)
        ? prev.filter((id) => id !== recursoId)
        : [...prev, recursoId],
    );
  };

  const criarImplementoMutation = useMutation({
    mutationFn: (nome: string) => catalogoService.criarImplementoExecucao(nome),
  });

  const criarRecursoMutation = useMutation({
    mutationFn: (nome: string) => catalogoService.criarRecursoTreino(nome),
  });

  const salvandoNovo =
    criarImplementoMutation.isPending || criarRecursoMutation.isPending;

  const abrirModalNovo = (tipo: "implemento" | "recurso") => {
    setModalTipo(tipo);
    setNovoNome("");
  };

  const salvarNovoItem = async () => {
    const nome = novoNome.trim();
    if (nome.length < 2) {
      Alert.alert("Atenção", "Informe um nome com pelo menos 2 caracteres.");
      return;
    }

    try {
      if (modalTipo === "implemento") {
        const implemento = await criarImplementoMutation.mutateAsync(nome);
        setValue("implemento_execucao", implemento.nome);
        queryClient.invalidateQueries({
          queryKey: keys.catalogo.implementosExecucao(),
        });
      } else {
        const recurso = await criarRecursoMutation.mutateAsync(nome);
        setRequisitosSelecionados((prev) => [...prev, recurso.id]);
        queryClient.invalidateQueries({
          queryKey: keys.catalogo.recursosTreino(),
        });
      }
      setModalTipo(null);
      setNovoNome("");
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string" ? detail : "Não foi possível salvar.",
      );
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData & { requisitos: string[] }) => {
      await catalogoService.editarExercicioBase(exercicio.id, {
        nome: data.nome.trim(),
        grupo_muscular: data.grupo_muscular.trim(),
        implemento_execucao: data.implemento_execucao,
        pode_ser_feito_em_casa: data.pode_ser_feito_em_casa,
      });
      await catalogoService.atualizarRequisitosRecurso(
        exercicio.id,
        data.requisitos,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keys.catalogo.exerciciosBase(),
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      Alert.alert(
        "Erro",
        typeof detail === "string"
          ? detail
          : "Não foi possível atualizar o exercício.",
      );
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome</Text>
      <Controller
        control={control}
        name="nome"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholder="Nome do exercício"
            placeholderTextColor={colors.textMuted}
          />
        )}
      />

      <Text style={styles.label}>Grupo muscular</Text>
      <Controller
        control={control}
        name="grupo_muscular"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <View style={styles.grupoContainer}>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(text) => {
                onChange(text);
                setShowGrupoDropdown(true);
              }}
              onFocus={() => setShowGrupoDropdown(true)}
              placeholder="Buscar grupo muscular"
              placeholderTextColor={colors.textMuted}
            />
            {showGrupoDropdown && gruposFiltrados.length > 0 ? (
              <View style={styles.grupoDropdown}>
                {gruposFiltrados.map((grupo) => (
                  <TouchableOpacity
                    key={grupo}
                    style={styles.grupoDropdownItem}
                    onPress={() => {
                      onChange(grupo);
                      setShowGrupoDropdown(false);
                    }}
                  >
                    <Text style={styles.grupoDropdownText}>{grupo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        )}
      />

      <View style={styles.labelRow}>
        <Text style={styles.labelRowText}>Implemento de execução</Text>
        <TouchableOpacity onPress={() => abrirModalNovo("implemento")}>
          <Text style={styles.addButtonText}>+ novo</Text>
        </TouchableOpacity>
      </View>
      <Controller
        control={control}
        name="implemento_execucao"
        render={({ field: { onChange, value } }) => (
          <View style={styles.row}>
            {(implementos ?? []).map((implemento) => (
              <TouchableOpacity
                key={implemento.id}
                style={[
                  styles.chip,
                  value === implemento.nome && styles.chipActive,
                ]}
                onPress={() => onChange(implemento.nome)}
              >
                <Text
                  style={[
                    styles.chipText,
                    value === implemento.nome && styles.chipTextActive,
                  ]}
                >
                  {implemento.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
      {(implementos ?? []).length === 0 ? (
        <Text style={styles.emptyText}>Nenhum implemento cadastrado.</Text>
      ) : null}

      <Text style={styles.label}>Pode ser feito em casa</Text>
      <Controller
        control={control}
        name="pode_ser_feito_em_casa"
        render={({ field: { onChange, value } }) => (
          <TouchableOpacity
            style={[
              styles.toggle,
              value ? styles.toggleAtivo : styles.toggleInativo,
            ]}
            onPress={() => onChange(!value)}
          >
            <Text style={styles.toggleText}>{value ? "Sim" : "Não"}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.labelRow}>
        <Text style={styles.labelRowText}>Requisitos de recurso</Text>
        <TouchableOpacity onPress={() => abrirModalNovo("recurso")}>
          <Text style={styles.addButtonText}>+ novo</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        {(recursos ?? []).map((recurso) => {
          const selecionado = requisitosSelecionados.includes(recurso.id);
          return (
            <TouchableOpacity
              key={recurso.id}
              style={[styles.chip, selecionado && styles.chipActive]}
              onPress={() => toggleRequisito(recurso.id)}
            >
              <Text
                style={[styles.chipText, selecionado && styles.chipTextActive]}
              >
                {recurso.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {(recursos ?? []).length === 0 ? (
        <Text style={styles.emptyText}>Nenhum recurso cadastrado.</Text>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit((data) => {
          if (!data.nome.trim() || !data.grupo_muscular.trim()) {
            Alert.alert("Atenção", "Preencha nome e grupo muscular.");
            return;
          }
          mutation.mutate({ ...data, requisitos: requisitosSelecionados });
        })}
      >
        <Text style={styles.buttonText}>
          {mutation.isPending ? "Salvando..." : "Salvar alterações"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalTipo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (salvandoNovo) return;
          setModalTipo(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (salvandoNovo) return;
            setModalTipo(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {modalTipo === "implemento"
                ? "Novo implemento"
                : "Novo recurso"}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={novoNome}
              onChangeText={setNovoNome}
              editable={!salvandoNovo}
              autoFocus
              placeholder={
                modalTipo === "implemento"
                  ? "Nome do implemento"
                  : "Nome do recurso"
              }
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  if (salvandoNovo) return;
                  setModalTipo(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={salvarNovoItem}
                disabled={salvandoNovo}
              >
                <Text style={styles.modalSaveText}>
                  {salvandoNovo ? "Salvando..." : "Salvar"}
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
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  labelRowText: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grupoContainer: {
    position: "relative",
  },
  grupoDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    zIndex: 10,
    elevation: 6,
  },
  grupoDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  grupoDropdownText: {
    color: colors.text,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  toggle: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  toggleAtivo: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  toggleInativo: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  toggleText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface,
    padding: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  modalSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  modalSaveText: {
    color: colors.text,
    fontWeight: "700",
  },
});
