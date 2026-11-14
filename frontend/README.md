# Sistema de Controle de Comissões - Frontend

Sistema completo para gestão de comissões de corretores de seguros.

## 🚀 Tecnologias

- React 18
- Vite
- React Router v6
- Tailwind CSS
- Axios
- Lucide React (ícones)

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Backend rodando em http://localhost:3001

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Iniciar servidor de desenvolvimento
npm run dev
```

O app estará disponível em http://localhost:5173

## 📁 Estrutura do Projeto

```
src/
├── api/                    # Camada de API
│   ├── client.js          # Cliente Axios
│   ├── config.js          # Configurações
│   └── services/          # Serviços por domínio
├── components/
│   ├── common/            # Componentes reutilizáveis
│   └── forms/             # Formulários
├── context/               # Context API
├── features/              # Features/módulos
│   ├── dashboard/
│   ├── corretores/
│   ├── seguradoras/
│   ├── clientes/
│   ├── apolices/
│   ├── comissoes/
│   └── repasses/
├── hooks/                 # Hooks customizados
├── layouts/               # Layouts
├── routes/                # Configuração de rotas
├── utils/                 # Utilitários
└── App.jsx               # Componente raiz
```

## 🎯 Funcionalidades

### ✅ Cadastros
- Corretores
- Seguradoras
- Clientes
- Apólices

### 💰 Financeiro
- Controle de Comissões
- Conciliação de Recebimentos
- Gestão de Repasses
- Dashboard com KPIs

### 📊 Relatórios
- Dashboard executivo
- Previsão de recebimentos
- Análise de comissões

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
```

## 🔗 Conexão com Backend

O frontend espera que o backend esteja rodando em:
```
http://localhost:3001/api
```

Você pode alterar isso no arquivo `.env`:
```env
VITE_API_URL=http://seu-backend.com/api
```

## 🎨 Personalização

### Cores do Tailwind
Edite `tailwind.config.js` para personalizar as cores:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
    },
  },
},
```

## 📦 Build para Produção

```bash
npm run build
```

Os arquivos otimizados estarão em `dist/`

## 🚢 Deploy

### Vercel
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

## 🐛 Troubleshooting

### Erro de CORS
Certifique-se de que o backend tem o CORS configurado:

```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### Erro 404 em rotas
Configure o servidor para redirecionar todas as rotas para `index.html`

### Build falha
Limpe o cache:
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

## 📝 Licença

Este projeto é proprietário.

## 👥 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📞 Suporte

Em caso de problemas, abra uma issue ou contate o time de desenvolvimento.