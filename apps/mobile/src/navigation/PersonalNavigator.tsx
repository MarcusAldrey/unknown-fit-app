import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AlunosListScreen } from "../screens/personal/AlunosListScreen";
import { AlunoFichaScreen } from "../screens/personal/AlunoFichaScreen";
import { CriarConjuntoScreen } from "../screens/personal/CriarConjuntoScreen";
import { TreinosScreen } from "../screens/personal/TreinosScreen";
import { CriarTreinoScreen } from "../screens/personal/CriarTreinoScreen";
import { ExerciciosScreen } from "../screens/personal/ExerciciosScreen";
import { CriarExercicioScreen } from "../screens/personal/CriarExercicioScreen";

import type { ExercicioTreino } from "../types";

export type PersonalStackParamList = {
  AlunosList: undefined;
  AlunoFicha: { alunoId: string };
  CriarConjunto: { alunoId: string };
  Treinos: { conjuntoId: string; conjuntoNome: string; alunoNome: string };
  CriarTreino: { conjuntoId: string; conjuntoNome: string; alunoNome: string };
  Exercicios: { treinoId: string; treinoCodigo: string; treinoNome: string };
  CriarExercicio: {
    treinoId: string;
    exercicioData?: ExercicioTreino;
  };
};

const Stack = createNativeStackNavigator<PersonalStackParamList>();

export function PersonalStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d0d0d" },
        headerTintColor: "#fff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="AlunosList"
        component={AlunosListScreen}
        options={{ title: "Meus Alunos" }}
      />
      <Stack.Screen
        name="AlunoFicha"
        component={AlunoFichaScreen}
        options={{ title: "Ficha do Aluno" }}
      />
      <Stack.Screen
        name="CriarConjunto"
        component={CriarConjuntoScreen}
        options={{ title: "Nova Periodização" }}
      />
      <Stack.Screen
        name="Treinos"
        component={TreinosScreen}
        options={{ title: "Treinos" }}
      />
      <Stack.Screen
        name="CriarTreino"
        component={CriarTreinoScreen}
        options={({ route }) => ({
          title: "Novo Treino",
          headerRight: undefined,
        })}
      />
      <Stack.Screen
        name="Exercicios"
        component={ExerciciosScreen}
        options={{ title: "Exercícios" }}
      />
      <Stack.Screen
        name="CriarExercicio"
        component={CriarExercicioScreen}
        options={({ route }) => ({
          title: route.params?.exercicioData
            ? "Editar Exercício"
            : "Novo Exercício",
        })}
      />
    </Stack.Navigator>
  );
}
