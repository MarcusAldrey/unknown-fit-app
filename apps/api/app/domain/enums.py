import enum


class Tecnica(str, enum.Enum):
    PADRAO = "PADRAO"
    ISOMETRIA = "ISOMETRIA"
    INSTABILIDADE = "INSTABILIDADE"


class AlvoTipo(str, enum.Enum):
    SEGUNDOS = "SEGUNDOS"
    REPETICOES = "REPETICOES"
    PASSOS = "PASSOS"
    OUTROS = "OUTROS"


class RerRmTipo(str, enum.Enum):
    RER = "RER"
    RM = "RM"


class ImplementoExecucao(str, enum.Enum):
    BARRA = "BARRA"
    ELASTICO = "ELASTICO"
    HALTERE = "HALTERE"
    KETTLEBELL = "KETTLEBELL"
    CABO = "CABO"
    MAQUINA = "MAQUINA"
    PESO_CORPO = "PESO_CORPO"
    OUTRO = "OUTRO"
