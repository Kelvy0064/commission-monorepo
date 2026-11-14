CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Corretores
CREATE TABLE IF NOT EXISTS corretores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('titular', 'associado', 'comissionado')),
    percentual_comissao DECIMAL(5,2) NOT NULL,
    data_admissao DATE,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Seguradoras
CREATE TABLE IF NOT EXISTS seguradoras (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    contato VARCHAR(255),
    email VARCHAR(255),
    dia_pagamento INTEGER CHECK (dia_pagamento BETWEEN 1 AND 31),
    prazo_repasse_dias INTEGER NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(18) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    data_nascimento DATE,
    endereco TEXT,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'cancelado')),
    data_cadastro DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Apólices
CREATE TABLE IF NOT EXISTS apolices (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    seguradora_id INTEGER REFERENCES seguradoras(id),
    corretor_responsavel_id INTEGER REFERENCES corretores(id),
    numero_apolice VARCHAR(100) UNIQUE NOT NULL,
    tipo_seguro VARCHAR(50) NOT NULL CHECK (tipo_seguro IN ('vida', 'saude', 'dental', 'outros')),
    valor_premio_mensal DECIMAL(10,2) NOT NULL,
    percentual_comissao DECIMAL(5,2) NOT NULL,
    data_inicio_vigencia DATE NOT NULL,
    data_fim_vigencia DATE,
    dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
    status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'suspensa')),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Comissões
CREATE TABLE IF NOT EXISTS comissoes (
    id SERIAL PRIMARY KEY,
    apolice_id INTEGER REFERENCES apolices(id) ON DELETE CASCADE,
    corretor_id INTEGER REFERENCES corretores(id),
    competencia VARCHAR(7) NOT NULL, -- formato YYYY-MM
    valor_premio DECIMAL(10,2) NOT NULL,
    percentual_comissao DECIMAL(5,2) NOT NULL,
    valor_comissao_bruto DECIMAL(10,2) NOT NULL,
    valor_comissao_liquido DECIMAL(10,2) NOT NULL,
    data_previsao_recebimento DATE NOT NULL,
    data_recebimento_real DATE,
    status VARCHAR(20) DEFAULT 'prevista' CHECK (status IN ('prevista', 'recebida', 'atrasada', 'cancelada')),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Repasses
CREATE TABLE IF NOT EXISTS repasses (
    id SERIAL PRIMARY KEY,
    comissao_id INTEGER REFERENCES comissoes(id) ON DELETE CASCADE,
    corretor_destino_id INTEGER REFERENCES corretores(id),
    valor_repasse DECIMAL(10,2) NOT NULL,
    percentual_repasse DECIMAL(5,2) NOT NULL,
    data_previsao_pagamento DATE NOT NULL,
    data_pagamento_real DATE,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    forma_pagamento VARCHAR(50) CHECK (forma_pagamento IN ('pix', 'transferencia', 'dinheiro')),
    comprovante_url TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Pagamentos da Seguradora
CREATE TABLE IF NOT EXISTS pagamentos_seguradora (
    id SERIAL PRIMARY KEY,
    seguradora_id INTEGER REFERENCES seguradoras(id),
    competencia VARCHAR(7) NOT NULL, -- formato YYYY-MM
    valor_total_recebido DECIMAL(10,2) NOT NULL,
    data_recebimento DATE NOT NULL,
    arquivo_extrato_url TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_comissoes_status ON comissoes(status);
CREATE INDEX idx_comissoes_competencia ON comissoes(competencia);
CREATE INDEX idx_apolices_status ON apolices(status);
CREATE INDEX idx_repasses_status ON repasses(status);
CREATE INDEX idx_corretor_status ON corretores(status);