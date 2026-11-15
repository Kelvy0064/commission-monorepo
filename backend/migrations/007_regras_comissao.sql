-- Relacionamento com a seguradora
ALTER TABLE seguradoras ADD COLUMN IF NOT EXISTS contrato_assinado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE seguradoras ADD COLUMN IF NOT EXISTS contrato_assinado_em DATE;
ALTER TABLE seguradoras ADD COLUMN IF NOT EXISTS regras_pagamento TEXT;
ALTER TABLE seguradoras ADD COLUMN IF NOT EXISTS pos_venda TEXT;

-- Tabelas de comissão por seguradora (a regra varia por produto/modalidade/campanha).
-- percentuais_parcelas: agenciamento sobre a mensalidade, parcela a parcela. Ex.: {100, 90}
--   = 100% da 1ª mensalidade + 90% da 2ª.
-- Vitalício: % sobre as mensalidades seguintes (a partir da parcela após a última da lista),
--   por vitalicio_meses (NULL = enquanto o contrato estiver ativo).
CREATE TABLE IF NOT EXISTS tabelas_comissao (
    id SERIAL PRIMARY KEY,
    seguradora_id INTEGER NOT NULL REFERENCES seguradoras(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    modalidade VARCHAR(20) NOT NULL DEFAULT 'todas'
        CHECK (modalidade IN ('todas', 'pf', 'adesao', 'pme', 'empresarial')),
    percentuais_parcelas NUMERIC(6,2)[] NOT NULL DEFAULT '{}',
    vitalicio_percentual NUMERIC(5,2),
    vitalicio_meses INTEGER CHECK (vitalicio_meses IS NULL OR vitalicio_meses > 0),
    estorno_meses INTEGER CHECK (estorno_meses IS NULL OR estorno_meses >= 0),
    vigencia_inicio DATE,
    vigencia_fim DATE,
    ativa BOOLEAN NOT NULL DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tabelas_comissao_seguradora ON tabelas_comissao(seguradora_id);
