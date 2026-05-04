import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type StatusRowProps = {
  label: string;
  value: string;
};

export function StatusRow({ label, value }: StatusRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 38,
    paddingVertical: 8,
  },
  label: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
  },
  value: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
});
