import { Pressable, StyleSheet, Text } from "react-native";

type PrimaryActionButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

export function PrimaryActionButton({ label, onPress, variant = "primary", disabled = false }: PrimaryActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.label, variant === "secondary" && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primary: {
    backgroundColor: "#1d5c49",
    borderColor: "#1d5c49",
  },
  secondary: {
    backgroundColor: "#ffffff",
    borderColor: "#b7c7c0",
  },
  danger: {
    backgroundColor: "#9f3a2f",
    borderColor: "#9f3a2f",
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryLabel: {
    color: "#1d5c49",
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
});
