-- Prazo de repasse pode ficar "a confirmar" (seguradora cadastrada antes do contrato).
-- Apólices de seguradoras sem dia de pagamento/prazo são bloqueadas na criação e puladas
-- na geração mensal de comissões, para não gerar data prevista errada.
ALTER TABLE seguradoras ALTER COLUMN prazo_repasse_dias DROP NOT NULL;
