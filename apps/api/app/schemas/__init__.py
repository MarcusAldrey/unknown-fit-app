from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest  # noqa: F401
from app.schemas.admin import (  # noqa: F401
    PersonalAdminCreateRequest,
    PersonalAdminUpdateRequest,
    PersonalAdminOut,
    AlunoAdminCreateRequest,
    AlunoAdminUpdateRequest,
    AlunoAdminOut,
)
from app.schemas.usuario import UsuarioOut  # noqa: F401
from app.schemas.aluno import (  # noqa: F401
    AlunoFicha,
    AlunoResumo,
    RegistroPesoCreate,
    RegistroPesoOut,
)
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
    ExercicioTreinoEquivalentesUpdate,
    ExercicioTreinoEquivalenteOut,
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
from app.schemas.recurso import (  # noqa: F401
    RecursoTreinoCreate,
    RecursoTreinoUpdate,
    RecursoTreinoOut,
    ExercicioRequisitosRecursoUpdate,
    AlunoRecursoDisponibilidadeUpdate,
    AlunoRecursosDisponibilidadeBatchUpdate,
    AlunoRecursoDisponibilidadeOut,
)
from app.schemas.implemento import (  # noqa: F401
    ImplementoExecucaoCreate,
    ImplementoExecucaoUpdate,
    ImplementoExecucaoOut,
)
