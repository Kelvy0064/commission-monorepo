-- Controle de migrations de DADOS que devem rodar uma única vez
-- (as migrations .sql rodam a cada deploy; esta tabela impede que a carga se repita).
CREATE TABLE IF NOT EXISTS data_migrations (
    nome VARCHAR(100) PRIMARY KEY,
    executada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carga única: uma negociação em "Sem contato" para cada lead que ainda não tem negociação.
-- Roda só uma vez — se alguém excluir uma dessas negociações depois, ela não volta.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM data_migrations WHERE nome = '006_negociacoes_leads') THEN
        INSERT INTO negociacoes (cliente_id, corretor_id, etapa, status, created_at, updated_at)
        SELECT c.id, c.corretor_id, 'sem_contato', 'em_andamento',
               COALESCE(c.data_cadastro::timestamp, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
        FROM clientes c
        WHERE c.status = 'lead'
          AND NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.cliente_id = c.id);

        INSERT INTO data_migrations (nome) VALUES ('006_negociacoes_leads');
    END IF;
END $$;
