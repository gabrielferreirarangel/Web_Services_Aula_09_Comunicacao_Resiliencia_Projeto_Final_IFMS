import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Produto } from "./types";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SERVICE_NAME = "CATALOGO";

// Dados em memória
let produtos: Produto[] = [
  { id: 1, nome: "Notebook Gamer", preco: 4500.0, estoque: 10 },
  { id: 2, nome: "Mouse Sem Fio", preco: 80.0, estoque: 5 },
  { id: 3, nome: "Teclado Mecânico", preco: 220.0, estoque: 2 }
];

let proximoId = 4;

// Middleware de Observabilidade e Correlation ID
app.use((req, res, next) => {
  const correlationId = (req.headers["x-correlation-id"] as string) || randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  res.on("finish", () => {
    console.log(`[${SERVICE_NAME}] [${correlationId}] ${req.method} ${req.originalUrl} - ${res.statusCode}`);
  });

  next();
});

// GET /produtos - Lista todos os produtos
app.get("/produtos", (_req: Request, res: Response) => {
  res.status(200).json(produtos);
});

// GET /produtos/:id - Detalhes de um produto específico
app.get("/produtos/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const produto = produtos.find((p) => p.id === id);

  if (!produto) {
    res.status(404).json({
      mensagem: "Produto não encontrado",
      codigo: "PRODUTO_NAO_ENCONTRADO"
    });
    return;
  }

  res.status(200).json(produto);
});

// POST /produtos - Cadastro de novo produto
app.post("/produtos", (req: Request, res: Response) => {
  const { nome, preco, estoque } = req.body || {};

  if (
    typeof nome !== "string" ||
    !nome.trim() ||
    typeof preco !== "number" ||
    !Number.isFinite(preco) ||
    preco <= 0 ||
    typeof estoque !== "number" ||
    !Number.isInteger(estoque) ||
    estoque < 0
  ) {
    res.status(400).json({
      mensagem: "Dados do produto são inválidos",
      codigo: "DADOS_INVALIDOS"
    });
    return;
  }

  const novoProduto: Produto = {
    id: proximoId++,
    nome: nome.trim(),
    preco,
    estoque
  };

  produtos.push(novoProduto);
  res.status(201).json(novoProduto);
});

// POST /produtos/:id/reservas - Reserva estoque de um produto
app.post("/produtos/:id/reservas", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { quantidade } = req.body || {};

  // Validação dos dados de entrada
  if (typeof quantidade !== "number" || quantidade <= 0 || !Number.isInteger(quantidade)) {
    res.status(400).json({
      mensagem: "Dados inválidos",
      codigo: "DADOS_INVALIDOS"
    });
    return;
  }

  // Busca do produto
  const produto = produtos.find((p) => p.id === id);
  if (!produto) {
    res.status(404).json({
      mensagem: "Produto não encontrado",
      codigo: "PRODUTO_NAO_ENCONTRADO"
    });
    return;
  }

  // Verificação de estoque disponível
  if (produto.estoque < quantidade) {
    res.status(409).json({
      mensagem: "Estoque insuficiente",
      codigo: "ESTOQUE_INSUFICIENTE"
    });
    return;
  }

  // Deduz do estoque
  produto.estoque -= quantidade;

  // Retorna reserva confirmada com estoque restante e o preço unitário do catálogo
  res.status(200).json({
    reservado: quantidade,
    estoqueRestante: produto.estoque,
    preco: produto.preco
  });
});

// Rota não encontrada (JSON previsível)
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    mensagem: "Rota não encontrada",
    codigo: "ROTA_NAO_ENCONTRADA"
  });
});

// Middleware de tratamento de erros genéricos e JSON inválido
app.use((err: any, _req: Request, res: Response, _next: any) => {
  res.status(err.status || 400).json({
    mensagem: "Dados inválidos",
    codigo: "DADOS_INVALIDOS"
  });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Rodando na porta ${PORT}`);
});
