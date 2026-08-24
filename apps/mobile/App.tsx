import React from "react";
import { StatusBar } from "expo-status-bar";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthProvider } from "./src/contexts/AuthContext";
import { RootNavigator } from "./src/navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 60 * 24, // 24h
      retry: 2,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey;
            const isSessaoAtiva = key.includes("sessao-ativa");
            const isAdmin = key[0] === "admin";
            return !isSessaoAtiva && !isAdmin;
          },
        },
      }}
    >
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
