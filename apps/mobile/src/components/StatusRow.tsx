import { StyleSheet, Text, View } from "react-native";

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
    borderBottomColor: "#edf1ef",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 38,
    paddingVertical: 8,
  },
  label: {
    color: "#596960",
    flex: 1,
    fontSize: 15,
  },
  value: {
    color: "#17201c",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
});
