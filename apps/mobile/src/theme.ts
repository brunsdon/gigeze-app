export const colors = {
  background: "#08070A",
  backgroundElevated: "#151018",
  surface: "#1E1724",
  surfaceAlt: "#211A28",
  surfaceSubtle: "#100C13",
  border: "rgba(255, 255, 255, 0.12)",
  borderStrong: "rgba(255, 176, 0, 0.32)",
  text: "#FFF7EA",
  textSoft: "#D8CEDF",
  textMuted: "#B8AFC0",
  primary: "#FF2E63",
  primaryDark: "#D91F52",
  accent: "#FFB000",
  success: "#00E5A8",
  info: "#22D3EE",
  danger: "#FF2E63",
  white: "#FFFFFF",
  black: "#08070A",
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

export const shadows = {
  surface: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 8,
  },
  glowPrimary: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
};
