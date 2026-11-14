# Commission

Sistema de controle de comissões (corretores, seguradoras, clientes, apólices, comissões e repasses).

| Pasta | O que é | Tecnologia |
|---|---|---|
| [backend/](backend/) | API REST | Node.js, Express, PostgreSQL |
| [frontend/](frontend/) | Interface web | React, Vite, Tailwind |

## Rodar localmente

```bash
# API (porta 3001)
cd backend
npm install
cp .env.example .env   # preencha com os dados do PostgreSQL local
npm run migrate
npm run dev

# Frontend (porta 5173)
cd frontend
npm install
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
npm run dev
```

## Produção

- **API + banco:** Railway (serviço com Root Directory `/backend`)
- **Frontend:** http://localhost:5173/ (Root Directory `/frontend`)

- **Lading Page** https://nevittaseguros.com
(envia dados para o backend via API)

Variáveis de ambiente de produção ficam somente no painel da hospedagem, nunca no Git.
