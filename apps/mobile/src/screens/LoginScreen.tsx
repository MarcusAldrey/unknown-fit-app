import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !senha.trim()) {
      Alert.alert("Erro", "Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      console.log("[LoginScreen] Tentando login com:", email);
      await login({ email: email.trim(), senha });
      console.log("[LoginScreen] Login bem-sucedido");
    } catch (error: any) {
      console.error("[LoginScreen] Erro de login:", error);
      console.error("[LoginScreen] Error message:", error.message);
      console.error("[LoginScreen] Error code:", error.code);
      console.error(
        "[LoginScreen] Error response:",
        error.response?.status,
        error.response?.data,
      );

      if (axios.isAxiosError(error)) {
        if (!error.response) {
          Alert.alert(
            "Erro de Conexão",
            `Não conseguiu conectar ao servidor: ${error.message}`,
          );
        } else if (error.response.status === 422) {
          Alert.alert("Erro", "Email ou senha incorretos.");
        } else {
          Alert.alert(
            "Erro",
            `Erro ${error.response.status}: ${error.response.data?.detail || error.message}`,
          );
        }
      } else {
        Alert.alert("Erro", error.message || "Erro desconhecido");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>ECG</Text>
        <Text style={styles.subtitle}>Elite Training Gym</Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 48,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
});
