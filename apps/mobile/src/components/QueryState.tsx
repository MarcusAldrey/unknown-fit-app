import React from "react";

import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingScreen } from "./LoadingScreen";

type Props = {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  children: React.ReactNode;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
};

export function QueryState({
  isLoading,
  isError,
  isEmpty,
  children,
  errorMessage,
  emptyMessage,
  onRetry,
}: Props) {
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <EmptyState message={emptyMessage} />;
  }

  return <>{children}</>;
}
