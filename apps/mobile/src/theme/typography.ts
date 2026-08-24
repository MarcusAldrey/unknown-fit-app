export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 32,
} as const;

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const typography = {
  caption: { fontSize: fontSizes.xs, fontWeight: fontWeights.regular },
  body: { fontSize: fontSizes.md, fontWeight: fontWeights.regular },
  bodySmall: { fontSize: fontSizes.sm, fontWeight: fontWeights.regular },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold },
  heading: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold },
} as const;
