-- Corretor responsável pelo cliente (opcional). Se o corretor for excluído, o cliente fica sem corretor.
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS corretor_id INTEGER REFERENCES corretores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_corretor ON clientes(corretor_id);
