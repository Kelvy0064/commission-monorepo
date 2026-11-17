-- Spec 005 — estorno: cancelamento em duas etapas, dívida com a plataforma e saldo do corretor.
-- Idempotente (roda a cada deploy). Só estrutura: não há dados a migrar.

-- Etapa 1 (aviso de cancelamento) fica registrada na própria apólice
ALTER TABLE apolices ADD COLUMN IF NOT EXISTS data_cancelamento DATE;
ALTER TABLE apolices ADD COLUMN IF NOT EXISTS motivo_cancelamento VARCHAR(30);
ALTER TABLE apolices ADD COLUMN IF NOT EXISTS motivo_cancelamento_descricao TEXT;
ALTER TABLE apolices ADD COLUMN IF NOT EXISTS cancelamento_registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE apolices DROP CONSTRAINT IF EXISTS apolices_motivo_cancelamento_check;
ALTER TABLE apolices ADD CONSTRAINT apolices_motivo_cancelamento_check
    CHECK (motivo_cancelamento IS NULL
           OR motivo_cancelamento IN ('pedido_cliente', 'inadimplencia', 'troca_plano', 'financeiro', 'outro'));

-- Um estorno por apólice cancelada dentro do período (dívida da corretora com a plataforma)
CREATE TABLE IF NOT EXISTS estornos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    apolice_id INTEGER NOT NULL UNIQUE REFERENCES apolices(id) ON DELETE CASCADE,
    seguradora_id INTEGER REFERENCES seguradoras(id),
    corretor_id INTEGER REFERENCES corretores(id),
    data_cancelamento DATE NOT NULL,
    fim_periodo_estorno DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'aguardando_conclusao'
        CHECK (status IN ('aguardando_conclusao', 'a_descontar', 'a_pagar', 'descontado', 'pago')),
    forma_cobranca VARCHAR(30) CHECK (forma_cobranca IS NULL OR forma_cobranca IN ('desconto_plataforma', 'pix_boleto')),
    valor_estornado DECIMAL(10,2) CHECK (valor_estornado IS NULL OR valor_estornado > 0),
    assumido_pela_corretora BOOLEAN NOT NULL DEFAULT false,
    data_liquidacao DATE,
    concluido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    concluido_em TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_estornos_empresa_status ON estornos(empresa_id, status);

-- Saldo que o corretor devolve (um por estorno), descontado dos próximos repasses
CREATE TABLE IF NOT EXISTS saldos_corretor (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    corretor_id INTEGER NOT NULL REFERENCES corretores(id),
    estorno_id INTEGER NOT NULL UNIQUE REFERENCES estornos(id) ON DELETE CASCADE,
    valor_original DECIMAL(10,2) NOT NULL CHECK (valor_original > 0),
    valor_restante DECIMAL(10,2) NOT NULL CHECK (valor_restante >= 0),
    desconto_maximo_por_repasse DECIMAL(10,2) CHECK (desconto_maximo_por_repasse IS NULL OR desconto_maximo_por_repasse > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'quitado')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saldos_corretor ON saldos_corretor(empresa_id, corretor_id, status);

-- Histórico de cada saldo: descontos em repasses, quitações manuais e devoluções ao saldo
CREATE TABLE IF NOT EXISTS saldo_movimentos (
    id SERIAL PRIMARY KEY,
    saldo_id INTEGER NOT NULL REFERENCES saldos_corretor(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('desconto_repasse', 'quitacao_manual', 'estorno_de_desconto')),
    repasse_id INTEGER REFERENCES repasses(id) ON DELETE SET NULL,
    valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
    data DATE NOT NULL,
    observacao TEXT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saldo_movimentos_saldo ON saldo_movimentos(saldo_id);
CREATE INDEX IF NOT EXISTS idx_saldo_movimentos_repasse ON saldo_movimentos(repasse_id);

-- Repasse: valor calculado (valor_repasse) menos o desconto de saldo = valor a pagar
ALTER TABLE repasses ADD COLUMN IF NOT EXISTS valor_desconto_saldo DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE repasses DROP CONSTRAINT IF EXISTS repasses_valor_desconto_saldo_check;
ALTER TABLE repasses ADD CONSTRAINT repasses_valor_desconto_saldo_check
    CHECK (valor_desconto_saldo >= 0 AND valor_desconto_saldo <= valor_repasse);
