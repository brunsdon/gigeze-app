import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenSection } from "../components/ScreenSection";
import { useAuth } from "../features/auth/auth-context";
import { colors, radii } from "../theme";

type SignInScreenProps = {
  isLoading?: boolean;
};

export function SignInScreen({ isLoading = false }: SignInScreenProps) {
  const { signIn, error, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = isConfigured && email.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function handleSignIn() {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn({
        email: email.trim(),
        password,
      });
    } catch {
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer title="GigEze">
      <ScreenSection title="Welcome" caption="Sign in with your GigEze account to record trips and keep them backed up.">
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.body}>Checking for a saved session.</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {!isConfigured ? (
              <Text style={styles.error}>Sign-in is not configured for this app build. Please check the mobile app setup.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />
            <PrimaryActionButton label={isSubmitting ? "Signing in..." : "Sign in"} onPress={handleSignIn} disabled={!canSubmit} />
          </View>
        )}
      </ScreenSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  loading: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
  },
  body: {
    color: colors.textSoft,
    fontSize: 16,
    lineHeight: 23,
  },
  error: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  input: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
