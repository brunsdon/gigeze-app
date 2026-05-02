import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import { SafeAreaView, StyleSheet, Text } from "react-native";

type StartupErrorBoundaryState = {
  error: Error | null;
};

export class StartupErrorBoundary extends Component<PropsWithChildren, StartupErrorBoundaryState> {
  state: StartupErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[gigeze/mobile] startup render failed", error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>GigEze could not start</Text>
          <Text style={styles.body}>Startup phase: React app initialization</Text>
          <Text style={styles.error}>{this.state.error.message}</Text>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f7f8f4",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 22,
  },
  title: {
    color: "#17201c",
    fontSize: 24,
    fontWeight: "900",
  },
  body: {
    color: "#32453d",
    fontSize: 16,
    lineHeight: 23,
  },
  error: {
    color: "#9f3a2f",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
});
