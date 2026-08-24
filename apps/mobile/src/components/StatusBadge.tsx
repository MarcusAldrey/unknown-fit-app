import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { spacing } from "../theme/spacing";

type Props = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

const TONE_COLORS: Record<NonNullable<Props["tone"]>, string> = {
  neutral: colors.surface,
  success: "#1f8a4c",
  warning: colors.warning,
  danger: colors.danger,
};

export function StatusBadge({ label, tone = "neutral" }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: TONE_COLORS[tone] }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  text: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
});
