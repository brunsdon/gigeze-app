import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows } from "../theme";

type ScreenSectionProps = PropsWithChildren<{
  title: string;
  caption?: string;
}>;

export function ScreenSection({ title, caption, children }: ScreenSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 10,
    padding: 16,
    ...shadows.surface,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  caption: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22
  }
});
