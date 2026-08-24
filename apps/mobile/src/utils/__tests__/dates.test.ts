import { formatDate, formatDuration, formatTime, parseApiDateToMs } from "../dates";

describe("parseApiDateToMs", () => {
  it("converte ISO em ms", () => {
    expect(parseApiDateToMs("2026-02-08T12:00:00.000Z")).toBe(
      Date.parse("2026-02-08T12:00:00.000Z"),
    );
  });

  it("retorna 0 para valor inválido", () => {
    expect(parseApiDateToMs("não-data")).toBe(0);
  });
});

describe("formatTime", () => {
  it("retorna - para valor inválido", () => {
    expect(formatTime("não-data")).toBe("-");
  });
});

describe("formatDate", () => {
  it("retorna - para valor inválido", () => {
    expect(formatDate("não-data")).toBe("-");
  });

  it("formata data em pt-BR", () => {
    expect(formatDate("2026-02-08T12:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("formatDuration", () => {
  it("formata segundos", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(90)).toBe("1min 30s");
  });

  it("retorna - para valores inválidos", () => {
    expect(formatDuration(-5)).toBe("-");
  });
});
