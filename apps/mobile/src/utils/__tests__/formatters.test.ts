import {
  formatarImplementoExecucao,
  formatarDuracaoSegundos,
  formatarIntervaloDescanso,
} from "../formatters";

describe("formatarImplementoExecucao", () => {
  it("traduz valores conhecidos", () => {
    expect(formatarImplementoExecucao("BARRA")).toBe("Barra");
    expect(formatarImplementoExecucao("PESO_CORPO")).toBe("Peso corporal");
  });

  it("retorna o próprio valor para desconhecidos", () => {
    expect(formatarImplementoExecucao("X" as never)).toBe("X");
  });
});

describe("formatarDuracaoSegundos", () => {
  it("formata segundos", () => {
    expect(formatarDuracaoSegundos(30)).toBe("30s");
  });

  it("formata minutos", () => {
    expect(formatarDuracaoSegundos(60)).toBe("1min");
    expect(formatarDuracaoSegundos(90)).toBe("1min 30s");
  });
});

describe("formatarIntervaloDescanso", () => {
  it("retorna - quando não há descanso", () => {
    expect(formatarIntervaloDescanso(null, null, null)).toBe("-");
  });

  it("usa o legado quando min/max ausentes", () => {
    expect(formatarIntervaloDescanso(null, null, 90)).toBe("1min 30s");
  });

  it("formata intervalo", () => {
    expect(formatarIntervaloDescanso(60, 120, null)).toBe("1min a 2min");
  });

  it("retorna - quando min > max", () => {
    expect(formatarIntervaloDescanso(120, 60, null)).toBe("-");
  });
});
