from app.models.usuario import Usuario, Role  # noqa: F401
from app.models.personal import Personal  # noqa: F401
from app.models.aluno import Aluno  # noqa: F401
from app.models.vinculo import VinculoPersonalAluno  # noqa: F401
from app.models.conjunto_treino import ConjuntoTreino  # noqa: F401
from app.models.treino import Treino  # noqa: F401
from app.models.exercicio_treino import (  # noqa: F401
	ExercicioTreino,
	Tecnica,
	AlvoTipo,
	RerRmTipo,
)
from app.models.exercicio_treino_equivalente import ExercicioTreinoEquivalente  # noqa: F401
from app.models.exercicio_base import ExercicioBase, ImplementoExecucao  # noqa: F401
from app.models.recurso_treino import (  # noqa: F401
	RecursoTreino,
	ExercicioRequisitoRecurso,
	AlunoRecursoDisponibilidade,
)
from app.models.sessao_treino import SessaoTreino, StatusSessao  # noqa: F401
from app.models.serie_executada import SerieExecutada  # noqa: F401
from app.models.peso_registro import RegistroPesoAluno  # noqa: F401
from app.models.refresh_token_revogado import RefreshTokenRevogado  # noqa: F401
