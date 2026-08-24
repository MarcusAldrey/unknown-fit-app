import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Props = {
  message?: string;
  icon?: React.ReactNode;
};

export function EmptyState({ message = "Nada por aqui ainda.", icon }: Props) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  message: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
