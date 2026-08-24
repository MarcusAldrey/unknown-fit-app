import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { spacing } from "../theme/spacing";

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
});
