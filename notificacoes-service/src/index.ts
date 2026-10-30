import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Notificacao } from "./types";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const SERVICE_NAME = "NOTIFICACOES";

// Histórico de notificações em memória
let notificacoes: Notificacao[] = [];
let proximoId = 1;

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

// GET /notificacoes - Retorna histórico de notificações enviadas
app.get("/notificacoes", (_req: Request, res: Response) => {
  res.status(200).json(notificacoes);
});

// POST /notificacoes - Registra uma nova notificação
app.post("/notificacoes", (req: Request, res: Response) => {
  const { pedidoId, destino, mensagem } = req.body || {};

  if (
    typeof pedidoId !== "number" ||
    pedidoId <= 0 ||
    !Number.isInteger(pedidoId) ||
    typeof destino !== "string" ||
    !destino.trim() ||
    typeof mensagem !== "string" ||
    !mensagem.trim()
  ) {
    res.status(400).json({
      mensagem: "Dados da notificação são inválidos",
      codigo: "DADOS_INVALIDOS"
    });
    return;
  }

  const novaNotificacao: Notificacao = {
    id: proximoId++,
    pedidoId,
    destino: destino.trim(),
    mensagem: mensagem.trim(),
    enviadoEm: new Date().toISOString()
  };

  notificacoes.push(novaNotificacao);
  res.status(201).json(novaNotificacao);
});

// Rota não encontrada (JSON previsível)
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    mensagem: "Rota não encontrada",
    codigo: "ROTA_NAO_ENCONTRADA"
  });
});

// Middleware de tratamento de erros genéricos
app.use((err: any, _req: Request, res: Response, _next: any) => {
  res.status(err.status || 400).json({
    mensagem: "Dados da notificação são inválidos",
    codigo: "DADOS_INVALIDOS"
  });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Rodando na porta ${PORT}`);
});
