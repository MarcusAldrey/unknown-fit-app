import api from "../client";
import type {
  AlunoAdmin,
  AlunoAdminCreateRequest,
  AlunoAdminUpdateRequest,
  PersonalAdmin,
  PersonalAdminCreateRequest,
  PersonalAdminUpdateRequest,
} from "../../types";

export const adminService = {
  personais: async (): Promise<PersonalAdmin[]> => {
    const { data } = await api.get<PersonalAdmin[]>("/admin/personais");
    return data;
  },

  alunos: async (): Promise<AlunoAdmin[]> => {
    const { data } = await api.get<AlunoAdmin[]>("/admin/alunos");
    return data;
  },

  criarPersonal: async (body: PersonalAdminCreateRequest): Promise<PersonalAdmin> => {
    const { data } = await api.post<PersonalAdmin>("/admin/personais", body);
    return data;
  },

  atualizarPersonal: async (
    personalId: string,
    body: PersonalAdminUpdateRequest,
  ): Promise<PersonalAdmin> => {
    const { data } = await api.patch<PersonalAdmin>(
      `/admin/personais/${personalId}`,
      body,
    );
    return data;
  },

  removerPersonal: async (personalId: string): Promise<void> => {
    await api.delete(`/admin/personais/${personalId}`);
  },

  criarAluno: async (body: AlunoAdminCreateRequest): Promise<AlunoAdmin> => {
    const { data } = await api.post<AlunoAdmin>("/admin/alunos", body);
    return data;
  },

  atualizarAluno: async (
    alunoId: string,
    body: AlunoAdminUpdateRequest,
  ): Promise<AlunoAdmin> => {
    const { data } = await api.patch<AlunoAdmin>(`/admin/alunos/${alunoId}`, body);
    return data;
  },

  removerAluno: async (alunoId: string): Promise<void> => {
    await api.delete(`/admin/alunos/${alunoId}`);
  },
};
