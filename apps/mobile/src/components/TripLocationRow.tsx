import { StyleSheet, Text, View } from "react-native";

type TripLocationRowProps = {
  label: string;
  title: string;
  secondary: string;
  dateTime: string;
};

export function TripLocationRow({ label, title, secondary, dateTime }: TripLocationRowProps) {
  return (
    <View style={styles.pointRow}>
      <View style={styles.pointBadge}>
        <Text style={styles.pointBadgeText}>{label.slice(0, 1)}</Text>
      </View>
      <View style={styles.pointCopy}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointSecondary}>{secondary}</Text>
      </View>
      <Text style={styles.pointTime}>{dateTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pointRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  pointBadge: {
    alignItems: "center",
    backgroundColor: "#eef4f0",
    borderColor: "#d4ddd7",
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  pointBadgeText: {
    color: "#1d5c49",
    fontSize: 13,
    fontWeight: "900",
  },
  pointCopy: {
    flex: 1,
    gap: 3,
  },
  pointTitle: {
    color: "#17201c",
    fontSize: 16,
    fontWeight: "900",
  },
  pointSecondary: {
    color: "#6a7771",
    fontSize: 14,
    fontWeight: "600",
  },
  pointTime: {
    color: "#42534c",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    width: 92,
  },
});
