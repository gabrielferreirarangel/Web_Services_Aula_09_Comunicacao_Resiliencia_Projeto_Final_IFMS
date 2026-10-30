import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Pedido, ReservaEstoqueResponse } from "./types";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CATALOG_URL = process.env.CATALOG_URL;
const NOTIFICATION_URL = process.env.NOTIFICATION_URL;
const SERVICE_NAME = "PEDIDOS";

if (!CATALOG_URL) {
  throw new Error("CATALOG_URL não configurada no ambiente");
}

// Armazenamento em memória (isolado deste serviço)
let pedidos: Pedido[] = [];
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

// Função utilitária para fetch com Timeout usando AbortController (Slide 11)
async function fetchComTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

// GET /pedidos - Listagem de pedidos
app.get("/pedidos", (_req: Request, res: Response) => {
  res.status(200).json(pedidos);
});

// GET /pedidos/:id - Detalhe de um pedido
app.get("/pedidos/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const pedido = pedidos.find((p) => p.id === id);

  if (!pedido) {
    res.status(404).json({
      mensagem: "Pedido não encontrado",
      codigo: "PEDIDO_NAO_ENCONTRADO"
    });
    return;
  }

  res.status(200).json(pedido);
});

// POST /pedidos - Orquestra a criação do pedido (Slides 27, 29, 32, 33)
app.post("/pedidos", async (req: Request, res: Response) => {
  const correlationId = String(req.headers["x-correlation-id"]);
  const { produtoId, quantidade, clienteEmail } = req.body || {};

  // 1. Validar body
  if (
    typeof produtoId !== "number" ||
    produtoId <= 0 ||
    !Number.isInteger(produtoId) ||
    typeof quantidade !== "number" ||
    quantidade <= 0 ||
    !Number.isInteger(quantidade) ||
    typeof clienteEmail !== "string" ||
    !clienteEmail.trim()
  ) {
    res.status(400).json({
      mensagem: "Dados do pedido são inválidos",
      codigo: "DADOS_INVALIDOS"
    });
    return;
  }

  // 2. Reservar estoque no Catálogo (Dependência Crítica)
  let reservaResposta: globalThis.Response;
  try {
    reservaResposta = await fetchComTimeout(
      `${CATALOG_URL}/produtos/${produtoId}/reservas`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": correlationId
        },
        body: JSON.stringify({ quantidade })
      },
      3000
    );
  } catch (error: any) {
    if (error.name === "AbortError") {
      res.status(504).json({
        mensagem: "Catálogo demorou para responder",
        codigo: "TIMEOUT"
      });
      return;
    }
    // Falha de rede ou serviço offline
    res.status(502).json({
      mensagem: "Catálogo indisponível",
      codigo: "SERVICO_INDISPONIVEL"
    });
    return;
  }

  // Se Catálogo retornou erro, traduzimos de forma amigável e previsível
  if (!reservaResposta.ok) {
    let erroBody: any = null;
    try {
      erroBody = await reservaResposta.json();
    } catch {}

    if (reservaResposta.status === 404) {
      res.status(404).json({
        mensagem: erroBody?.mensagem || "Produto não encontrado",
        codigo: erroBody?.codigo || "PRODUTO_NAO_ENCONTRADO"
      });
      return;
    }

    if (reservaResposta.status === 409) {
      res.status(409).json({
        mensagem: erroBody?.mensagem || "Estoque insuficiente",
        codigo: erroBody?.codigo || "ESTOQUE_INSUFICIENTE"
      });
      return;
    }

    if (reservaResposta.status === 400) {
      res.status(400).json({
        mensagem: erroBody?.mensagem || "Dados do pedido são inválidos",
        codigo: erroBody?.codigo || "DADOS_INVALIDOS"
      });
      return;
    }

    // Qualquer outro status de erro do Catálogo vira 502
    res.status(502).json({
      mensagem: "Catálogo indisponível",
      codigo: "SERVICO_INDISPONIVEL"
    });
    return;
  }

  // 3. Obter dados da reserva (incluindo preço unitário do catálogo) e criar pedido
  const dadosReserva = (await reservaResposta.json()) as ReservaEstoqueResponse;
  const total = Number((dadosReserva.preco * quantidade).toFixed(2));

  const novoPedido: Pedido = {
    id: proximoId++,
    produtoId,
    quantidade,
    total,
    status: "CONFIRMADO",
    clienteEmail: clienteEmail.trim(),
    notificacaoStatus: "pendente",
    criadoEm: new Date().toISOString()
  };

  pedidos.push(novoPedido);

  // 4. Notificar (Dependência Secundária)
  if (NOTIFICATION_URL) {
    try {
      const notificacaoResp = await fetchComTimeout(
        `${NOTIFICATION_URL}/notificacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-correlation-id": correlationId
          },
          body: JSON.stringify({
            pedidoId: novoPedido.id,
            destino: novoPedido.clienteEmail,
            mensagem: `Pedido ${novoPedido.id} confirmado`
          })
        },
        3000
      );

      if (notificacaoResp.ok) {
        novoPedido.notificacaoStatus = "enviada";
      } else {
        novoPedido.notificacaoStatus = "pendente";
      }
    } catch {
      // Falha na notificação não cancela o pedido criado
      novoPedido.notificacaoStatus = "pendente";
    }
  }

  // 5. Responder ao cliente
  res.status(201).json(novoPedido);
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
    mensagem: "Dados do pedido são inválidos",
    codigo: "DADOS_INVALIDOS"
  });
});

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Rodando na porta ${PORT}`);
});
