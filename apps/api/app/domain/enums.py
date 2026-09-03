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
