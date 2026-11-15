-- Idades dos beneficiários do contrato (usadas na cotação/fechamento da venda)
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS idades INTEGER[] NOT NULL DEFAULT '{}';
