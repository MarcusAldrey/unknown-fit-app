import React from "react";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AlunosListScreen } from "../screens/personal/AlunosListScreen";
import { AlunoFichaScreen } from "../screens/personal/AlunoFichaScreen";
import { GerirRecursosAlunoScreen } from "../screens/personal/GerirRecursosAlunoScreen";
import { CriarConjuntoScreen } from "../screens/personal/CriarConjuntoScreen";
import { TreinosScreen } from "../screens/personal/TreinosScreen";
import { CriarTreinoScreen } from "../screens/personal/CriarTreinoScreen";
import { ExerciciosScreen } from "../screens/personal/ExerciciosScreen";
import { CriarExercicioScreen } from "../screens/personal/CriarExercicioScreen";
import { EditarExercicioBaseScreen } from "../screens/personal/EditarExercicioBaseScreen";
import { CatalogoExerciciosScreen } from "../screens/personal/CatalogoExerciciosScreen";
import { HistoricoTreinosAlunoScreen } from "../screens/personal/HistoricoTreinosAlunoScreen";
import { DetalheTreinoRealizadoAlunoScreen } from "../screens/personal/DetalheTreinoRealizadoAlunoScreen";

import type { ExercicioTreino, ExercicioBase, SessaoResumo } from "../types";

export type PersonalStackParamList = {
  AlunosList: undefined;
  CatalogoExercicios: undefined;
  AlunoFicha: { alunoId: string };
  GerirRecursosAluno: { alunoId: string; alunoNome: string };
  CriarConjunto: { alunoId: string; alunoNome: string };
  Treinos: {
    alunoId: string;
    conjuntoId: string;
    conjuntoNome: string;
    alunoNome: string;
  };
  HistoricoTreinosAluno: {
    alunoId: string;
    conjuntoId: string;
    conjuntoNome: string;
    alunoNome: string;
  };
  DetalheTreinoRealizadoAluno: {
    alunoId: string;
    sessao: SessaoResumo;
  };
  CriarTreino: {
    alunoId: string;
    conjuntoId: string;
    conjuntoNome: string;
    alunoNome: string;
  };
  Exercicios: {
    alunoId: string;
    treinoId: string;
    treinoCodigo: string;
    treinoNome: string;
  };
  CriarExercicio: {
    alunoId: string;
    treinoId: string;
    exercicioData?: ExercicioTreino;
  };
  EditarExercicioBase: {
    exercicio: ExercicioBase;
  };
};

export type PersonalAlunosStackParamList = {
  AlunosFlow: NavigatorScreenParams<PersonalStackParamList>;
};

export type PersonalCatalogoStackParamList = {
  CatalogoFlow: NavigatorScreenParams<PersonalStackParamList>;
};

export type PersonalTabParamList = {
  MeusAlunos: undefined;
  Exercicios: undefined;
};

const AlunosStack = createNativeStackNavigator<PersonalStackParamList>();
const CatalogoStack = createNativeStackNavigator<PersonalStackParamList>();
const Tab = createBottomTabNavigator<PersonalTabParamList>();

function MeusAlunosStackNavigator() {
  return (
    <AlunosStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d0d0d" },
        headerTintColor: "#fff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <AlunosStack.Screen
        name="AlunosList"
        component={AlunosListScreen}
        options={{ headerShown: false }}
      />
      <AlunosStack.Screen
        name="AlunoFicha"
        component={AlunoFichaScreen}
        options={{ title: "Ficha do Aluno" }}
      />
      <AlunosStack.Screen
        name="GerirRecursosAluno"
        component={GerirRecursosAlunoScreen}
        options={{ title: "Recursos do Aluno" }}
      />
      <AlunosStack.Screen
        name="CriarConjunto"
        component={CriarConjuntoScreen}
        options={{ title: "Nova Periodização" }}
      />
      <AlunosStack.Screen
        name="Treinos"
        component={TreinosScreen}
        options={{ title: "Treinos" }}
      />
      <AlunosStack.Screen
        name="HistoricoTreinosAluno"
        component={HistoricoTreinosAlunoScreen}
        options={{ title: "Treinos Realizados" }}
      />
      <AlunosStack.Screen
        name="DetalheTreinoRealizadoAluno"
        component={DetalheTreinoRealizadoAlunoScreen}
        options={{ title: "Detalhe do Treino" }}
      />
      <AlunosStack.Screen
        name="CriarTreino"
        component={CriarTreinoScreen}
        options={{
          title: "Novo Treino",
          headerRight: undefined,
        }}
      />
      <AlunosStack.Screen
        name="Exercicios"
        component={ExerciciosScreen}
        options={{ title: "Exercícios" }}
      />
      <AlunosStack.Screen
        name="CriarExercicio"
        component={CriarExercicioScreen}
        options={({ route }) => ({
          title: route.params?.exercicioData
            ? "Editar Exercício"
            : "Novo Exercício",
        })}
      />
    </AlunosStack.Navigator>
  );
}

function CatalogoStackNavigator() {
  return (
    <CatalogoStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d0d0d" },
        headerTintColor: "#fff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <CatalogoStack.Screen
        name="CatalogoExercicios"
        component={CatalogoExerciciosScreen}
        options={{ headerShown: false }}
      />
      <CatalogoStack.Screen
        name="EditarExercicioBase"
        component={EditarExercicioBaseScreen}
        options={{ title: "Editar Exercício" }}
      />
    </CatalogoStack.Navigator>
  );
}

export function PersonalStack() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0d0d0d", borderTopColor: "#202020" },
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#7a7a7a",
      }}
    >
      <Tab.Screen
        name="MeusAlunos"
        component={MeusAlunosStackNavigator}
        options={{ title: "Meus Alunos" }}
      />
      <Tab.Screen
        name="Exercicios"
        component={CatalogoStackNavigator}
        options={{ title: "Exercícios" }}
      />
    </Tab.Navigator>
  );
}
