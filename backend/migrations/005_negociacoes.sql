-- Negociações (funil de vendas em kanban). Cada negociação pertence a um cliente/lead.
CREATE TABLE IF NOT EXISTS negociacoes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    corretor_id INTEGER REFERENCES corretores(id) ON DELETE SET NULL,
    titulo VARCHAR(255),
    etapa VARCHAR(40) NOT NULL DEFAULT 'sem_contato'
        CHECK (etapa IN ('sem_contato', 'contato_feito', 'follow_up',
                         'identificacao_interesse', 'apresentacao', 'proposta_enviada')),
    status VARCHAR(20) NOT NULL DEFAULT 'em_andamento'
        CHECK (status IN ('em_andamento', 'vendida', 'perdida')),
    motivo_perda TEXT,
    -- Próxima ação combinada com o cliente (hora local de Brasília, sem fuso)
    proxima_acao VARCHAR(255),
    proxima_acao_em TIMESTAMP,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_negociacoes_status_etapa ON negociacoes(status, etapa);
CREATE INDEX IF NOT EXISTS idx_negociacoes_cliente ON negociacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_negociacoes_corretor ON negociacoes(corretor_id);
