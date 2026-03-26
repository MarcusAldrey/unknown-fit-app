from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest  # noqa: F401
from app.schemas.usuario import UsuarioOut  # noqa: F401
from app.schemas.aluno import AlunoFicha, AlunoResumo  # noqa: F401
from app.schemas.conjunto_treino import (  # noqa: F401
    ConjuntoTreinoCreate,
    ConjuntoTreinoUpdate,
    ConjuntoTreinoOut,
)
from app.schemas.treino import (  # noqa: F401
    TreinoCreate,
    TreinoUpdate,
    TreinoOut,
    TreinoObservacaoAlunoUpdate,
)
from app.schemas.exercicio import (  # noqa: F401
    ExercicioTreinoCreate,
    ExercicioTreinoUpdate,
    ExercicioTreinoOut,
    ExercicioBaseOut,
    ExercicioBaseUpdate,
    ExercicioObservacaoAlunoUpdate,
)
from app.schemas.sessao import (  # noqa: F401
    SessaoCreate,
    SessaoOut,
    SessaoResumoOut,
    SessaoAtivaOut,
    SerieCreate,
    SerieOut,
    SerieDetalheOut,
    UltimoPesoExercicioOut,
)
