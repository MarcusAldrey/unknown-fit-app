export function formatarDuracaoSegundos(totalSegundos: number): string {
  if (totalSegundos < 60) return `${totalSegundos}s`;

  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return segundos > 0 ? `${minutos}min ${segundos}s` : `${minutos}min`;
}

export function formatarIntervaloDescanso(
  descansoMin: number | null | undefined,
  descansoMax: number | null | undefined,
  descansoLegado: number | null | undefined,
): string {
  const minimo = descansoMin ?? descansoLegado ?? null;
  const maximo = descansoMax ?? descansoLegado ?? null;

  if (minimo == null || maximo == null || minimo > maximo) {
    return "-";
  }

  if (minimo === maximo) {
    return formatarDuracaoSegundos(minimo);
  }

  return `${formatarDuracaoSegundos(minimo)} a ${formatarDuracaoSegundos(maximo)}`;
}
