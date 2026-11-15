-- Leads da landing page: chegam sem CPF/CNPJ, com status próprio e dados de qualificação.

-- CPF/CNPJ passa a ser opcional (preenchido quando a venda avança)
ALTER TABLE clientes ALTER COLUMN cpf_cnpj DROP NOT NULL;

-- Novo status 'lead' (ainda não fechou venda)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_status_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_status_check
    CHECK (status IN ('lead', 'ativo', 'inativo', 'cancelado'));

-- Qualificação do lead (respostas do formulário)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS possui_plano BOOLEAN;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plano_atual VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS custo_plano_atual VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS investimento_pretendido VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS hospitais_preferidos TEXT;

-- Origem do lead (campanha)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255);
