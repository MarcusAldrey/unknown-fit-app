import React from "react";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ConjuntoAtivoScreen } from "../screens/aluno/ConjuntoAtivoScreen";
import { SessaoTreinoScreen } from "../screens/aluno/SessaoTreinoScreen";
import { HistoricoTreinosScreen } from "../screens/aluno/HistoricoTreinosScreen";
import { DetalheTreinoRealizadoScreen } from "../screens/aluno/DetalheTreinoRealizadoScreen";
import type { SessaoAtiva, SessaoResumo } from "../types";

export type AlunoTreinoStackParamList = {
  ConjuntoAtivo: undefined;
  SessaoTreino: {
    treinoId: string;
    treinoCodigo: string;
    treinoNome?: string;
    sessaoAtiva?: SessaoAtiva;
  };
};

export type AlunoHistoricoStackParamList = {
  HistoricoTreinos: undefined;
  DetalheTreinoRealizado: { sessao: SessaoResumo };
};

export type AlunoTabParamList = {
  MeuTreino: NavigatorScreenParams<AlunoTreinoStackParamList>;
  Perfil: NavigatorScreenParams<AlunoHistoricoStackParamList>;
};

const TreinoStack = createNativeStackNavigator<AlunoTreinoStackParamList>();
const HistoricoStack =
  createNativeStackNavigator<AlunoHistoricoStackParamList>();
const Tab = createBottomTabNavigator<AlunoTabParamList>();

function MeuTreinoStackNavigator() {
  return (
    <TreinoStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d0d0d" },
        headerTintColor: "#fff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <TreinoStack.Screen
        name="ConjuntoAtivo"
        component={ConjuntoAtivoScreen}
        options={{ title: "Meu Treino" }}
      />
      <TreinoStack.Screen
        name="SessaoTreino"
        component={SessaoTreinoScreen}
        options={{ title: "Sessão de Treino" }}
      />
    </TreinoStack.Navigator>
  );
}

function HistoricoStackNavigator() {
  return (
    <HistoricoStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d0d0d" },
        headerTintColor: "#fff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <HistoricoStack.Screen
        name="HistoricoTreinos"
        component={HistoricoTreinosScreen}
        options={{ headerShown: false }}
      />
      <HistoricoStack.Screen
        name="DetalheTreinoRealizado"
        component={DetalheTreinoRealizadoScreen}
        options={{ title: "Treino Realizado" }}
      />
    </HistoricoStack.Navigator>
  );
}

export function AlunoStack() {
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
        name="MeuTreino"
        component={MeuTreinoStackNavigator}
        options={{ title: "Meu Treino" }}
      />
      <Tab.Screen
        name="Perfil"
        component={HistoricoStackNavigator}
        options={{ title: "Perfil" }}
      />
    </Tab.Navigator>
  );
}
