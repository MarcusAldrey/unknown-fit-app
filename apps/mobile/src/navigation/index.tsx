import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";

import { useAuth } from "../contexts/AuthContext";
import { PersonalStack } from "./PersonalNavigator";
import { AlunoStack } from "./AlunoNavigator";
import { AuthStack } from "./AuthNavigator";

export function RootNavigator() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1a1a2e",
        }}
      >
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : role === "PERSONAL" ? (
        <PersonalStack />
      ) : (
        <AlunoStack />
      )}
    </NavigationContainer>
  );
}
