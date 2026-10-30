export interface Pedido {
  id: number;
  produtoId: number;
  quantidade: number;
  total: number;
  status: string;
  clienteEmail: string;
  notificacaoStatus: "enviada" | "pendente";
  criadoEm: string;
}

export interface CriarPedidoDTO {
  produtoId: number;
  quantidade: number;
  clienteEmail: string;
}

export interface ReservaEstoqueResponse {
  reservado: number;
  estoqueRestante: number;
  preco: number;
}

export interface ApiError {
  mensagem: string;
  codigo: string;
}

