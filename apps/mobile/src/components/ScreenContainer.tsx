import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Props = ViewProps & { useSafeArea?: boolean };

export function ScreenContainer({
  children,
  style,
  useSafeArea = true,
  ...rest
}: Props) {
  const Container = useSafeArea ? SafeAreaView : View;
  return (
    <Container style={[styles.container, style]} {...rest}>
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
});
