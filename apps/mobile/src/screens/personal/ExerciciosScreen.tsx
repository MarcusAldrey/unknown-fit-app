import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../../api/client";
import type { ExercicioTreino } from "../../types";
import type { PersonalStackParamList } from "../../navigation/PersonalNavigator";

type Props = NativeStackScreenProps<PersonalStackParamList, "Exercicios">;

type GrupoEquivalenteMeta = {
  groupId: number;
  inicio: boolean;
  fim: boolean;
  tamanho: number;
};

function formatarAlvoCompacto(exercicio: ExercicioTreino) {
  if (exercicio.alvo_tipo === "OUTROS") {
    return exercicio.alvo_outros_texto ?? "sem alvo";
  }

  const minimo = exercicio.alvo_valor_min;
  const maximo = exercicio.alvo_valor_max;
  if (minimo == null || maximo == null) return "sem alvo";

  const unidade =
    exercicio.alvo_tipo === "SEGUNDOS"
      ? "s"
      : exercicio.alvo_tipo === "PASSOS"
        ? " passos"
        : " reps";

  return minimo === maximo
    ? `${minimo}${unidade}`
    : `${minimo}-${maximo}${unidade}`;
}

function formatarRerRmCompacto(exercicio: ExercicioTreino) {
  if (!exercicio.rer_rm_tipo || !exercicio.rer_rm_valor) return null;
  return `${exercicio.rer_rm_tipo} ${exercicio.rer_rm_valor}`;
}

function montarMetadadosGrupoEquivalentes(
  lista: ExercicioTreino[],
): Map<string, GrupoEquivalenteMeta> {
  const metadados = new Map<string, GrupoEquivalenteMeta>();

  const idsNoTreino = new Set(lista.map((exercicio) => exercicio.id));
  const adjacencia = new Map<string, Set<string>>();
  lista.forEach((exercicio) => {
    adjacencia.set(exercicio.id, new Set<string>());
  });

  lista.forEach((exercicio) => {
    (exercicio.equivalentes ?? []).forEach((equivalente) => {
      const equivalenteId = equivalente.exercicio_equivalente_treino_id;
      if (!idsNoTreino.has(equivalenteId)) return;

      adjacencia.get(exercicio.id)?.add(equivalenteId);
      adjacencia.get(equivalenteId)?.add(exercicio.id);
    });
  });

  const visitados = new Set<string>();
  let proximoGroupId = 1;

  for (const exercicio of lista) {
    if (visitados.has(exercicio.id)) continue;

    const fila = [exercicio.id];
    const idsComponente = new Set<string>();

    while (fila.length > 0) {
      const atualId = fila.shift() as string;
      if (idsComponente.has(atualId)) continue;

      idsComponente.add(atualId);
      visitados.add(atualId);

      adjacencia.get(atualId)?.forEach((vizinhoId) => {
        if (!idsComponente.has(vizinhoId)) fila.push(vizinhoId);
      });
    }

    if (idsComponente.size <= 1) continue;

    const ordenadosNoFluxo = lista.filter((item) => idsComponente.has(item.id));

    ordenadosNoFluxo.forEach((item, indice) => {
      metadados.set(item.id, {
        groupId: proximoGroupId,
        inicio: indice === 0,
        fim: indice === ordenadosNoFluxo.length - 1,
        tamanho: ordenadosNoFluxo.length,
      });
    });

    proximoGroupId += 1;
  }

  return metadados;
}

export function ExerciciosScreen({ route, navigation }: Props) {
  const { alunoId, treinoId, treinoCodigo, treinoNome } = route.params;
  const queryClient = useQueryClient();

  // --- State ---
  const [localNome, setLocalNome] = useState(treinoNome);
  const [editNomeVisible, setEditNomeVisible] = useState(false);
  const [editNomeText, setEditNomeText] = useState(treinoNome);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuExercicio, setMenuExercicio] = useState<ExercicioTreino | null>(
    null,
  );
  const [equivalentesVisible, setEquivalentesVisible] = useState(false);
  const [equivalenteBase, setEquivalenteBase] =
    useState<ExercicioTreino | null>(null);
  const [equivalentesSelecionados, setEquivalentesSelecionados] = useState<
    string[]
  >([]);

  const [reorderMode, setReorderMode] = useState(false);
  const [localExercicios, setLocalExercicios] = useState<ExercicioTreino[]>([]);

  // --- Queries ---
  const { data: exercicios, isLoading } = useQuery<ExercicioTreino[]>({
    queryKey: ["personal", "treino", treinoId, "exercicios"],
    queryFn: async () => {
      const res = await api.get(`/personal/treinos/${treinoId}/exercicios`);
      return res.data;
    },
  });

  useEffect(() => {
    if (exercicios) setLocalExercicios(exercicios);
  }, [exercicios]);

  // --- Mutations ---
  const editNomeMutation = useMutation({
    mutationFn: async (nome: string) => {
      await api.patch(`/personal/treinos/${treinoId}`, { nome });
    },
    onSuccess: () => {
      setLocalNome(editNomeText);
      setEditNomeVisible(false);
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId],
      });
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível atualizar o nome.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (exercicioId: string) => {
      await api.delete(`/personal/exercicios/${exercicioId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setMenuVisible(false);
      setMenuExercicio(null);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível deletar o exercício.");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (ex: ExercicioTreino) => {
      const nextOrdem = (exercicios?.length ?? 0) + 1;
      await api.post(`/personal/treinos/${treinoId}/exercicios`, {
        exercicio_base_id: ex.exercicio_base_id,
        ordem: nextOrdem,
        numero_series_prescritas: ex.numero_series_prescritas,
        alvo_tipo: ex.alvo_tipo,
        alvo_valor_min: ex.alvo_valor_min,
        alvo_valor_max: ex.alvo_valor_max,
        alvo_outros_texto: ex.alvo_outros_texto,
        rer_rm_tipo: ex.rer_rm_tipo,
        rer_rm_valor: ex.rer_rm_valor,
        descanso_segundos: ex.descanso_segundos,
        tecnica: ex.tecnica,
        observacoes: ex.observacoes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setMenuVisible(false);
      setMenuExercicio(null);
    },
    onError: () => {
      Alert.alert("Erro", "Não foi possível duplicar o exercício.");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: ExercicioTreino[]) => {
      await Promise.all(
        items.map((ex, idx) =>
          api.patch(`/personal/exercicios/${ex.id}`, { ordem: idx + 1 }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setReorderMode(false);
    },
  });

  const equivalentesMutation = useMutation({
    mutationFn: async (payload: {
      exercicioId: string;
      equivalentesIds: string[];
    }) => {
      const res = await api.put(
        `/personal/exercicios/${payload.exercicioId}/equivalentes`,
        {
          exercicios_equivalentes_ids: payload.equivalentesIds,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personal", "treino", treinoId, "exercicios"],
      });
      setEquivalentesVisible(false);
      setEquivalenteBase(null);
      setEquivalentesSelecionados([]);
      Alert.alert("Sucesso", "Equivalentes atualizados.");
    },
    onError: () => {
      Alert.alert(
        "Erro",
        "Não foi possível salvar os exercícios equivalentes.",
      );
    },
  });

  // --- Reorder helpers ---
  const moveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      if (index < 0 || index >= localExercicios.length) return;

      const metadados = montarMetadadosGrupoEquivalentes(localExercicios);

      const obterSegmento = (idx: number) => {
        const exercicio = localExercicios[idx];
        const meta = metadados.get(exercicio.id);
        if (!meta) return { start: idx, end: idx };

        let start = idx;
        while (start > 0) {
          const anteriorMeta = metadados.get(localExercicios[start - 1].id);
          if (anteriorMeta?.groupId !== meta.groupId) break;
          start -= 1;
        }

        let end = idx;
        while (end < localExercicios.length - 1) {
          const proximoMeta = metadados.get(localExercicios[end + 1].id);
          if (proximoMeta?.groupId !== meta.groupId) break;
          end += 1;
        }

        return { start, end };
      };

      const segmentoAtual = obterSegmento(index);

      if (direction === "up") {
        if (segmentoAtual.start === 0) return;

        const segmentoAnterior = obterSegmento(segmentoAtual.start - 1);
        const reordenado = [
          ...localExercicios.slice(0, segmentoAnterior.start),
          ...localExercicios.slice(segmentoAtual.start, segmentoAtual.end + 1),
          ...localExercicios.slice(segmentoAnterior.start, segmentoAtual.start),
          ...localExercicios.slice(segmentoAtual.end + 1),
        ];

        setLocalExercicios(
          reordenado.map((exercicio, idx) => ({
            ...exercicio,
            ordem: idx + 1,
          })),
        );
        return;
      }

      if (segmentoAtual.end === localExercicios.length - 1) return;

      const segmentoSeguinte = obterSegmento(segmentoAtual.end + 1);
      const reordenado = [
        ...localExercicios.slice(0, segmentoAtual.start),
        ...localExercicios.slice(
          segmentoSeguinte.start,
          segmentoSeguinte.end + 1,
        ),
        ...localExercicios.slice(segmentoAtual.start, segmentoAtual.end + 1),
        ...localExercicios.slice(segmentoSeguinte.end + 1),
      ];

      setLocalExercicios(
        reordenado.map((exercicio, idx) => ({
          ...exercicio,
          ordem: idx + 1,
        })),
      );
    },
    [localExercicios],
  );

  // --- Menu actions ---
  const handleDelete = () => {
    if (!menuExercicio) return;
    Alert.alert(
      "Deletar exercício",
      `Deseja deletar "${menuExercicio.nome_exercicio}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: () => deleteMutation.mutate(menuExercicio.id),
        },
      ],
    );
  };

  const handleDuplicate = () => {
    if (!menuExercicio) return;
    duplicateMutation.mutate(menuExercicio);
  };

  const handleEdit = () => {
    if (!menuExercicio) return;
    setMenuVisible(false);
    navigation.navigate("CriarExercicio", {
      alunoId,
      treinoId,
      exercicioData: menuExercicio,
    });
    setMenuExercicio(null);
  };

  const abrirGerirEquivalentes = (exercicio: ExercicioTreino) => {
    const selecionadosOrdenados = [...(exercicio.equivalentes ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((equivalente) => equivalente.exercicio_equivalente_treino_id);

    setEquivalenteBase(exercicio);
    setEquivalentesSelecionados(selecionadosOrdenados);
    setMenuVisible(false);
    setMenuExercicio(null);
  };

  const handleGerirEquivalentes = () => {
    if (!menuExercicio) return;
    abrirGerirEquivalentes(menuExercicio);
  };

  const toggleEquivalenteSelecionado = (exercicioId: string) => {
    setEquivalentesSelecionados((current) =>
      current.includes(exercicioId)
        ? current.filter((id) => id !== exercicioId)
        : [...current, exercicioId],
    );
  };

  const salvarEquivalentes = () => {
    if (!equivalenteBase) return;
    const idsOrdenados = (exercicios ?? [])
      .filter((exercicio) => equivalentesSelecionados.includes(exercicio.id))
      .map((exercicio) => exercicio.id);

    equivalentesMutation.mutate({
      exercicioId: equivalenteBase.id,
      equivalentesIds: idsOrdenados,
    });
  };

  useEffect(() => {
    if (!equivalenteBase) {
      setEquivalentesVisible(false);
      return;
    }
    setEquivalentesVisible(true);
  }, [equivalenteBase]);

  const displayExercicios = reorderMode ? localExercicios : (exercicios ?? []);

  const metadadosGrupoEquivalentes = useMemo(() => {
    return montarMetadadosGrupoEquivalentes(displayExercicios);
  }, [displayExercicios]);

  // --- Render ---
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const renderHeader = () => (
    <>
      <View style={styles.contextHeader}>
        <View style={styles.contextRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contextTitle}>Treino {treinoCodigo}</Text>
            <TouchableOpacity
              style={styles.editNomeRow}
              onPress={() => {
                setEditNomeText(localNome);
                setEditNomeVisible(true);
              }}
            >
              <Text style={styles.contextSub}>{localNome}</Text>
              <Text style={styles.editIcon}>✎</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {displayExercicios.length > 1 ? (
        <View style={styles.reorderControlsRow}>
          {!reorderMode ? (
            <TouchableOpacity
              style={styles.reorderBtnAfterSeparator}
              onPress={() => setReorderMode(true)}
            >
              <Text style={styles.reorderBtnText}>Reordenar exercícios</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.reorderActionsInline}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setLocalExercicios(exercicios ?? []);
                  setReorderMode(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => reorderMutation.mutate(localExercicios)}
              >
                <Text style={styles.saveBtnText}>
                  {reorderMutation.isPending ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
    </>
  );

  const renderFooter = () =>
    !reorderMode ? (
      <TouchableOpacity
        style={styles.addCard}
        onPress={() =>
          navigation.navigate("CriarExercicio", { alunoId, treinoId })
        }
      >
        <Text style={styles.addIcon}>+</Text>
        <Text style={styles.addText}>Novo Exercício</Text>
      </TouchableOpacity>
    ) : null;

  const renderEmpty = () => (
    <TouchableOpacity
      style={styles.emptyCard}
      onPress={() =>
        navigation.navigate("CriarExercicio", { alunoId, treinoId })
      }
    >
      <Text style={styles.emptyIcon}>+</Text>
      <Text style={styles.emptyText}>
        Adicione o primeiro exercício deste treino
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayExercicios}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          displayExercicios.length > 0 ? renderFooter : undefined
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item, index }) => {
          const proximoExercicio = displayExercicios[index + 1];
          const metadadoAtual = metadadosGrupoEquivalentes.get(item.id);
          const metadadoProximo = proximoExercicio
            ? metadadosGrupoEquivalentes.get(proximoExercicio.id)
            : undefined;
          const mostrarOuEntreCards = Boolean(
            proximoExercicio &&
            metadadoAtual &&
            metadadoProximo &&
            metadadoAtual.groupId === metadadoProximo.groupId,
          );

          return (
            <View
              style={[
                styles.itemGroup,
                metadadoAtual ? styles.grupoEquivalenteItem : undefined,
                metadadoAtual?.inicio
                  ? styles.grupoEquivalenteInicio
                  : undefined,
                metadadoAtual?.fim ? styles.grupoEquivalenteFim : undefined,
              ]}
            >
              <TouchableOpacity
                style={styles.card}
                activeOpacity={reorderMode ? 1 : 0.7}
                onLongPress={
                  reorderMode ? undefined : () => setReorderMode(true)
                }
                onPress={
                  reorderMode
                    ? undefined
                    : () =>
                        navigation.navigate("CriarExercicio", {
                          alunoId,
                          treinoId,
                          exercicioData: item,
                        })
                }
              >
                <Text style={styles.ordem}>{item.ordem}</Text>
                <View style={styles.info}>
                  <Text style={styles.nome}>{item.nome_exercicio}</Text>
                  <View style={styles.detalhesChips}>
                    <View style={styles.detalheChip}>
                      <Text style={styles.detalheChipText}>
                        {`${item.numero_series_prescritas}x ${formatarAlvoCompacto(item)}`}
                      </Text>
                    </View>
                    <View style={styles.detalheChip}>
                      <Text style={styles.detalheChipText}>
                        {`Descanso ${item.descanso_segundos ? `${item.descanso_segundos}s` : "—"}`}
                      </Text>
                    </View>
                    {formatarRerRmCompacto(item) ? (
                      <View style={styles.detalheChip}>
                        <Text style={styles.detalheChipText}>
                          {formatarRerRmCompacto(item)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.tecnica !== "PADRAO" && (
                    <Text style={styles.tecnica}>{item.tecnica}</Text>
                  )}
                  {item.observacoes && (
                    <Text style={styles.obs}>{`Obs: ${item.observacoes}`}</Text>
                  )}
                </View>
                {reorderMode ? (
                  <View style={styles.arrowContainer}>
                    <TouchableOpacity
                      style={[
                        styles.arrowBtn,
                        index === 0 && styles.arrowDisabled,
                      ]}
                      onPress={() => moveItem(index, "up")}
                      disabled={index === 0}
                    >
                      <Text style={styles.arrowText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.arrowBtn,
                        index === displayExercicios.length - 1 &&
                          styles.arrowDisabled,
                      ]}
                      onPress={() => moveItem(index, "down")}
                      disabled={index === displayExercicios.length - 1}
                    >
                      <Text style={styles.arrowText}>↓</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.menuBtn}
                    onPress={() => {
                      setMenuExercicio(item);
                      setMenuVisible(true);
                    }}
                  >
                    <Text style={styles.menuDots}>⋮</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {mostrarOuEntreCards ? (
                <View style={styles.ouEntreCardsWrap}>
                  <TouchableOpacity
                    style={styles.ouEntreCardsBtn}
                    onPress={() => abrirGerirEquivalentes(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ouEntreCardsText}>OU</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      {/* Modal: Editar Nome do Treino */}
      <Modal
        visible={editNomeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNomeVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditNomeVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Editar nome do treino</Text>
            <TextInput
              style={styles.modalInput}
              value={editNomeText}
              onChangeText={setEditNomeText}
              autoFocus
              placeholderTextColor="#555"
              placeholder="Nome do treino"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditNomeVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => editNomeMutation.mutate(editNomeText)}
              >
                <Text style={styles.modalSaveText}>
                  {editNomeMutation.isPending ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Menu de Ações do Exercício */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMenuVisible(false);
          setMenuExercicio(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setMenuVisible(false);
            setMenuExercicio(null);
          }}
        >
          <Pressable style={styles.menuContent} onPress={() => {}}>
            <Text style={styles.menuTitle}>
              {menuExercicio?.nome_exercicio}
            </Text>

            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Text style={styles.menuItemIcon}>✎</Text>
              <Text style={styles.menuItemText}>Editar exercício</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleDuplicate}>
              <Text style={styles.menuItemIcon}>⧉</Text>
              <Text style={styles.menuItemText}>Duplicar exercício</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleGerirEquivalentes}
            >
              <Text style={styles.menuItemIcon}>⇄</Text>
              <Text style={styles.menuItemText}>Gerir equivalentes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDelete}
            >
              <Text style={[styles.menuItemIcon, { color: "#ef4444" }]}>✕</Text>
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>
                Deletar exercício
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={equivalentesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEquivalentesVisible(false);
          setEquivalenteBase(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setEquivalentesVisible(false);
            setEquivalenteBase(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Gerir equivalentes</Text>
            <Text style={styles.modalSubTitle}>
              {equivalenteBase?.nome_exercicio}
            </Text>

            <View style={styles.equivalentesList}>
              {(exercicios ?? [])
                .filter((exercicio) => exercicio.id !== equivalenteBase?.id)
                .map((exercicio) => {
                  const selecionado = equivalentesSelecionados.includes(
                    exercicio.id,
                  );
                  return (
                    <TouchableOpacity
                      key={exercicio.id}
                      style={[
                        styles.equivalenteRow,
                        selecionado && styles.equivalenteRowSelecionado,
                      ]}
                      onPress={() => toggleEquivalenteSelecionado(exercicio.id)}
                    >
                      <Text style={styles.equivalenteNome}>
                        {exercicio.nome_exercicio}
                      </Text>
                      <Text
                        style={[
                          styles.equivalenteCheck,
                          selecionado && styles.equivalenteCheckSelecionado,
                        ]}
                      >
                        {selecionado ? "✓" : "+"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setEquivalentesVisible(false);
                  setEquivalenteBase(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={salvarEquivalentes}
                disabled={equivalentesMutation.isPending}
              >
                <Text style={styles.modalSaveText}>
                  {equivalentesMutation.isPending ? "Salvando..." : "Salvar"}
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
  container: { flex: 1, backgroundColor: "#0d0d0d", padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
  },

  // --- Header ---
  contextHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  contextRow: { flexDirection: "row", alignItems: "center" },
  contextTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  contextSub: { color: "#888", fontSize: 14 },
  editNomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  editIcon: { color: "#555", fontSize: 14 },

  // --- Reorder bar ---
  reorderBtnAfterSeparator: {
    alignSelf: "flex-end",
    marginBottom: 0,
    minHeight: 34,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
  },
  reorderControlsRow: {
    minHeight: 36,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  reorderActionsInline: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    minHeight: 34,
  },
  reorderBtnText: { color: "#888", fontSize: 13 },
  reorderBar: {
    marginTop: 8,
    marginBottom: 14,
    backgroundColor: "#151d17",
    borderWidth: 1,
    borderColor: "#23422f",
    borderRadius: 10,
    padding: 12,
  },
  reorderLabel: { color: "#9ccfb0", fontSize: 13, marginBottom: 10 },
  reorderActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: "center",
  },
  cancelBtnText: { color: "#888", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },

  // --- Exercise card ---
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 0,
    flexDirection: "row",
    gap: 12,
  },
  itemGroup: {
    marginBottom: 12,
  },
  grupoEquivalenteItem: {
    marginBottom: 0,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#2d6a48",
    backgroundColor: "#111111",
  },
  grupoEquivalenteInicio: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 0,
    marginTop: 0,
  },
  grupoEquivalenteFim: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingBottom: 0,
    marginBottom: 12,
  },
  ordem: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "bold",
    width: 30,
    textAlign: "center",
    alignSelf: "center",
  },
  info: { flex: 1 },
  nome: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  detalhesChips: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  detalheChip: {
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detalheChipText: { color: "#b7b7b7", fontSize: 12, fontWeight: "600" },
  tecnica: { color: "#22c55e", fontSize: 12, marginTop: 4, fontWeight: "bold" },
  obs: { color: "#666", fontSize: 12, marginTop: 4, fontStyle: "italic" },
  ouEntreCardsWrap: {
    marginTop: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ouEntreCardsBtn: {
    borderWidth: 1,
    borderColor: "#2d6a48",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "#13281d",
  },
  ouEntreCardsText: {
    color: "#9fe6b4",
    fontSize: 11,
    fontWeight: "700",
  },
  menuBtn: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuDots: { color: "#888", fontSize: 22, fontWeight: "bold" },

  // --- Arrows ---
  arrowContainer: { flexDirection: "column", gap: 4, alignSelf: "center" },
  arrowBtn: {
    backgroundColor: "#2a2a2a",
    borderRadius: 6,
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: { opacity: 0.25 },
  arrowText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  // --- Footer / Empty ---
  addCard: {
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addIcon: { color: "#22c55e", fontSize: 20, fontWeight: "bold" },
  addText: { color: "#888", fontSize: 15 },
  emptyCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginTop: 8,
  },
  emptyIcon: { color: "#22c55e", fontSize: 32, fontWeight: "bold" },
  emptyText: {
    color: "#888",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },

  // --- Modal Edit Nome ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 20,
    width: "100%",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 16,
  },
  modalSubTitle: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: "#0d0d0d",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: { color: "#888", fontSize: 14 },
  modalSaveBtn: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSaveText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  equivalentesList: {
    maxHeight: 300,
    gap: 8,
  },
  equivalenteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#121212",
  },
  equivalenteRowSelecionado: {
    borderColor: "#2e7d4f",
    backgroundColor: "#12281c",
  },
  equivalenteNome: {
    color: "#e5e7eb",
    fontSize: 14,
    flex: 1,
  },
  equivalenteCheck: {
    color: "#9ca3af",
    fontSize: 18,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  equivalenteCheckSelecionado: {
    color: "#22c55e",
  },

  // --- Modal Menu ---
  menuContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 8,
    width: "100%",
  },
  menuTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  menuItemIcon: { color: "#ccc", fontSize: 18 },
  menuItemText: { color: "#ccc", fontSize: 15 },
});
