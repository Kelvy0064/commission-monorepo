-- Multiempresa: cada empresa (corretora) vê só os próprios dados. Nevitta é a empresa piloto
-- e recebe todos os dados que já existiam.
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    -- Código informado no auto-cadastro de usuários (ex.: NEVITTA)
    codigo VARCHAR(50) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO empresas (nome, codigo) VALUES ('Nevitta', 'NEVITTA')
ON CONFLICT (codigo) DO NOTHING;

-- empresa_id em todas as tabelas de dados; o que já existe vira da Nevitta
DO $$
DECLARE
    tabela TEXT;
    nevitta INTEGER;
BEGIN
    SELECT id INTO nevitta FROM empresas WHERE codigo = 'NEVITTA';
    FOREACH tabela IN ARRAY ARRAY['usuarios', 'corretores', 'seguradoras', 'clientes', 'negociacoes',
                                  'apolices', 'comissoes', 'repasses']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id)', tabela);
        EXECUTE format('UPDATE %I SET empresa_id = %s WHERE empresa_id IS NULL', tabela, nevitta);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN empresa_id SET NOT NULL', tabela);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(empresa_id)', 'idx_' || tabela || '_empresa', tabela);
    END LOOP;
END $$;

-- Unicidades passam a valer dentro da empresa (outra corretora pode ter o mesmo CPF/CNPJ/apólice)
ALTER TABLE corretores DROP CONSTRAINT IF EXISTS corretores_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_corretores_empresa_cpf ON corretores(empresa_id, cpf);
ALTER TABLE seguradoras DROP CONSTRAINT IF EXISTS seguradoras_cnpj_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_seguradoras_empresa_cnpj ON seguradoras(empresa_id, cnpj);
ALTER TABLE apolices DROP CONSTRAINT IF EXISTS apolices_numero_apolice_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_apolices_empresa_numero ON apolices(empresa_id, numero_apolice);

-- Usuários: perfil, status de aprovação e vínculo com o cadastro de corretor
--   role: admin | gestor | corretor | pos_venda (NULL enquanto pendente)
--   status: pendente (auto-cadastro aguardando aprovação) | ativo | bloqueado
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativo';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS corretor_id INTEGER REFERENCES corretores(id) ON DELETE SET NULL;
ALTER TABLE usuarios ALTER COLUMN role DROP DEFAULT;
-- Perfis antigos/desconhecidos viram pendentes (precisam ser aprovados com um perfil válido)
UPDATE usuarios SET role = NULL, status = 'pendente'
WHERE role IS NULL OR role NOT IN ('admin', 'gestor', 'corretor', 'pos_venda');

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check
    CHECK (role IS NULL OR role IN ('admin', 'gestor', 'corretor', 'pos_venda'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_status_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_status_check
    CHECK (status IN ('pendente', 'ativo', 'bloqueado'));
-- Usuário ativo precisa de perfil
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_ativo_com_role;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_ativo_com_role CHECK (status <> 'ativo' OR role IS NOT NULL);

-- Um cadastro de corretor pertence a no máximo um usuário
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_corretor ON usuarios(corretor_id) WHERE corretor_id IS NOT NULL;
