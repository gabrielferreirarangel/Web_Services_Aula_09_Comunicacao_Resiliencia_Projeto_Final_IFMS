export interface Produto {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
}

export interface ReservaResponse {
  reservado: number;
  estoqueRestante: number;
  preco: number;
}

export interface ApiError {
  mensagem: string;
  codigo: string;
}

