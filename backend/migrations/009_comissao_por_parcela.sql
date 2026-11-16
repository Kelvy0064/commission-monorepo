-- Apólice segue uma tabela de comissão da seguradora (opcional; sem tabela = percentual fixo da apólice)
ALTER TABLE apolices ADD COLUMN IF NOT EXISTS tabela_comissao_id INTEGER
    REFERENCES tabelas_comissao(id) ON DELETE SET NULL;

-- Cada comissão sabe a qual parcela da apólice se refere e de que tipo é.
-- O repasse ao corretor sai apenas da parcela 1.
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS numero_parcela INTEGER;
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS tipo VARCHAR(20)
    CHECK (tipo IS NULL OR tipo IN ('agenciamento', 'vitalicio', 'fixa'));

-- Comissões antigas (sem número de parcela): numera por apólice na ordem de competência.
-- Só toca linhas sem número, então é seguro rodar a cada deploy.
UPDATE comissoes c
SET numero_parcela = n.numero, tipo = COALESCE(c.tipo, 'fixa')
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY apolice_id ORDER BY competencia, id) AS numero
    FROM comissoes
) n
WHERE c.id = n.id AND c.numero_parcela IS NULL;

CREATE INDEX IF NOT EXISTS idx_comissoes_apolice_parcela ON comissoes(apolice_id, numero_parcela);
