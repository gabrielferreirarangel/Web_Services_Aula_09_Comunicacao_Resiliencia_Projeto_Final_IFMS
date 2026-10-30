# Sistema Distribuído de Pedidos (IFMS)

Projeto prático com 3 microsserviços independentes comunicando via HTTP.

## 1. Visão Geral

- **catalogo-service (:3001)**: Dono dos produtos e estoque. Consulta e reserva.
- **pedidos-service (:3000)**: Orquestra o pedido: valida body, reserva estoque (crítico) e chama notificação (secundário).
- **notificacoes-service (:3002)**: Registra notificações enviadas. Se falhar, o pedido continua confirmado (`notificacaoStatus: "pendente"`).

## 2. Arquitetura

```text
Cliente -> POST /pedidos (:3000)
             ├─> POST /produtos/:id/reservas (:3001) [Crítico]
             └─> POST /notificacoes (:3002) [Secundário]
```

## 3. Como Rodar

### Instalação
```bash
cd catalogo-service && npm install
cd ../notificacoes-service && npm install
cd ../pedidos-service && npm install
```

### Configuração (.env)
Crie um arquivo `.env` dentro de cada pasta se desejar alterar as portas:

- `catalogo-service/.env`: `PORT=3001`
- `notificacoes-service/.env`: `PORT=3002`
- `pedidos-service/.env`:
  ```env
  PORT=3000
  CATALOG_URL=http://localhost:3001
  NOTIFICATION_URL=http://localhost:3002
  ```

### Executar os Serviços
Abra 3 terminais e rode:

```bash
# Terminal 1
cd catalogo-service && npm run dev

# Terminal 2
cd notificacoes-service && npm run dev

# Terminal 3
cd pedidos-service && npm run dev
```

## 4. Endpoints

### Catálogo (:3001)
- `GET /produtos`: Lista produtos
- `GET /produtos/:id`: Detalha produto
- `POST /produtos`: Cria produto
- `POST /produtos/:id/reservas`: Reserva estoque
  - Body: `{"quantidade": 2}`
  - Retornos: `200` (sucesso), `400` (dado inválido), `404` (inexistente), `409` (sem estoque)

### Pedidos (:3000)
- `GET /pedidos`: Lista pedidos
- `GET /pedidos/:id`: Detalha pedido
- `POST /pedidos`: Cria pedido
  - Body: `{"produtoId": 1, "quantidade": 2, "clienteEmail": "aluno@estudante.ifms.edu.br"}`
  - Retornos: `201` (criado), `400` (inválido), `404` (produto não existe), `409` (sem estoque), `502` (catálogo fora), `504` (catálogo lento/timeout)

### Notificações (:3002)
- `GET /notificacoes`: Histórico de envios
- `POST /notificacoes`: Registra notificação (`201`)
