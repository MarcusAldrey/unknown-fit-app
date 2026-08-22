import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";

import { useAuth } from "../contexts/AuthContext";
import { PersonalStack } from "./PersonalNavigator";
import { AlunoStack } from "./AlunoNavigator";
import { AuthStack } from "./AuthNavigator";
import { colors } from "../theme/colors";

export function RootNavigator() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
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
