import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-url-polyfill/auto";
import "./src/features/trips/mobile-tracking/android-background-task";
import { StartupErrorBoundary } from "./src/components/StartupErrorBoundary";
import { AppProviders } from "./src/lib/providers/AppProviders";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <StartupErrorBoundary>
        <AppProviders>
          <StatusBar style="dark" />
          <AppNavigator />
        </AppProviders>
      </StartupErrorBoundary>
    </SafeAreaProvider>
  );
}
