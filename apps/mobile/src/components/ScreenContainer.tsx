import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenContainerProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
}>;

export function ScreenContainer({ title, children }: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 120) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    gap: 4,
  },
  title: {
    color: "#17201c",
    fontSize: 30,
    fontWeight: "900",
  },
});
