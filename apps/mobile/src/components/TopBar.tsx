import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { spacing } from "../theme/spacing";

type Props = {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function TopBar({ title, onBack, right }: Props) {
  return (
    <View style={styles.container}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.side}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.side} />
      )}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  side: {
    width: 44,
  },
  right: {
    alignItems: "flex-end",
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  backText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 30,
    borderRadius: radii.sm,
  },
});
