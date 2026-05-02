import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

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
    backgroundColor: "#ffffff",
    borderColor: "#dce2de",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  title: {
    color: "#17201c",
    fontSize: 20,
    fontWeight: "800"
  },
  caption: {
    color: "#596960",
    fontSize: 15,
    lineHeight: 22
  }
});
