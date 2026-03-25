import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ConjuntoAtivoScreen } from "../screens/aluno/ConjuntoAtivoScreen";
import { SessaoTreinoScreen } from "../screens/aluno/SessaoTreinoScreen";

export type AlunoStackParamList = {
  ConjuntoAtivo: undefined;
  SessaoTreino: { treinoId: string; treinoCodigo: string };
};

const Stack = createNativeStackNavigator<AlunoStackParamList>();

export function AlunoStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d0d0d" },
        headerTintColor: "#fff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="ConjuntoAtivo"
        component={ConjuntoAtivoScreen}
        options={{ title: "Meu Treino" }}
      />
      <Stack.Screen
        name="SessaoTreino"
        component={SessaoTreinoScreen}
        options={{ title: "Sessão de Treino" }}
      />
    </Stack.Navigator>
  );
}
