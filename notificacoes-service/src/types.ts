export interface Notificacao {
  id: number;
  pedidoId: number;
  destino: string;
  mensagem: string;
  enviadoEm: string;
}

export interface CriarNotificacaoDTO {
  pedidoId: number;
  destino: string;
  mensagem: string;
}

export interface ApiError {
  mensagem: string;
  codigo: string;
}

