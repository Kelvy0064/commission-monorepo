// Spec 005 — estorno: monitoramento, cancelamento em duas etapas, saldos e relatório.
// Exemplo padrão da spec: tabela T3 da operadora X com prazo de estorno de 3 meses; apólice com início
// em 10/01/2027; parcela 1 de R$ 800,00 recebida; corretor com 30% → repasse de R$ 240,00.
// Cada cenário usa um corretor próprio, porque gerar repasses desconta os saldos do corretor.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  db,
  unico,
  criarEmpresa,
  criarUsuario,
  criarCorretor,
  criarCliente,
  criarSeguradora,
  criarTabelaComissao,
} = require('../helpers/contexto');
const gerarComissoesMes = require('../../jobs/gerarComissoesMes');
const { SQL_HOJE_BRASIL } = require('../../utils/dataBrasil');
const poolDaApi = require('../../config/database');

after(() => poolDaApi.end());

let empresa;
let admin;
let gestor;
let posVenda;
let cliente;
let seguradora;
let T3;
let semPrazo;

// Data relativa ao hoje de Brasília, com a aritmética de meses do PostgreSQL
const dataRelativa = async (expr) =>
  (await db.query(`SELECT to_char(${expr}, 'YYYY-MM-DD') AS d`)).rows[0].d;

const novaApolice = async ({ corretor, inicio = '2027-01-10', tabela = T3, mensalidade = 1000, token = gestor.token, extra = {} }) => {
  const r = await api('POST', '/apolices', {
    token,
    body: {
      cliente_id: cliente.id,
      seguradora_id: seguradora.id,
      corretor_responsavel_id: corretor.id,
      numero_apolice: unico('EST'),
      tipo_seguro: 'saude',
      valor_premio_mensal: mensalidade,
      tabela_comissao_id: tabela.id,
      dia_vencimento: 15,
      data_inicio_vigencia: inicio,
      ...extra,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

const comissao1 = async (apoliceId) =>
  (await db.query('SELECT * FROM comissoes WHERE apolice_id = $1 AND numero_parcela = 1', [apoliceId])).rows[0];

const receberParcela1 = async (apoliceId, valorReal) => {
  const c = await comissao1(apoliceId);
  const r = await api('PUT', `/comissoes/${c.id}/recebida`, {
    token: gestor.token,
    body: { data_recebimento: '2027-01-20', valor_real: valorReal },
  });
  assert.equal(r.status, 200);
};

const gerarRepasses = async (token = gestor.token) => {
  const r = await api('POST', '/repasses/gerar', { token });
  assert.equal(r.status, 200);
  return r.body.repasses_gerados;
};

const repasseDa = async (apoliceId) =>
  (
    await db.query(
      `SELECT r.id, r.status, r.valor_repasse, r.valor_desconto_saldo,
              (r.valor_repasse - r.valor_desconto_saldo)::numeric(10,2) AS a_pagar
       FROM repasses r JOIN comissoes c ON c.id = r.comissao_id
       WHERE c.apolice_id = $1 AND c.numero_parcela = 1`,
      [apoliceId]
    )
  ).rows[0];

const pagarRepasse = async (repasseId) => {
  const r = await api('PUT', `/repasses/${repasseId}/pago`, { token: gestor.token, body: { data_pagamento: '2027-01-25' } });
  assert.equal(r.status, 200);
};

const avisar = (apoliceId, body, token = posVenda.token) =>
  api('POST', `/apolices/${apoliceId}/cancelamento`, { token, body });

const concluir = (estornoId, body, token = gestor.token) =>
  api('PUT', `/estornos/${estornoId}/concluir`, { token, body });

const saldoDo = async (corretorId) =>
  (await db.query('SELECT * FROM saldos_corretor WHERE corretor_id = $1 ORDER BY id', [corretorId])).rows;

// Venda completa até o repasse: apólice → parcela 1 recebida → repasse gerado (e pago, se pedido)
const vendaComRepasse = async ({ corretor, valorReal = 800, pago = false, mensalidade = 1000 }) => {
  const apolice = await novaApolice({ corretor, mensalidade });
  await receberParcela1(apolice.id, valorReal);
  await gerarRepasses();
  const repasse = await repasseDa(apolice.id);
  if (pago) await pagarRepasse(repasse.id);
  return { apolice, repasse };
};

// Saldo pronto (estorno já concluído) para os cenários de desconto
const saldoPronto = async (corretor, valor) => {
  const apolice = await novaApolice({ corretor });
  const e = await db.query(
    `INSERT INTO estornos (empresa_id, apolice_id, seguradora_id, corretor_id, data_cancelamento, fim_periodo_estorno,
                           status, forma_cobranca, valor_estornado)
     VALUES ($1, $2, $3, $4, '2027-03-01', '2027-04-09', 'a_descontar', 'desconto_plataforma', 1000) RETURNING id`,
    [empresa.id, apolice.id, seguradora.id, corretor.id]
  );
  return (
    await db.query(
      `INSERT INTO saldos_corretor (empresa_id, corretor_id, estorno_id, valor_original, valor_restante)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [empresa.id, corretor.id, e.rows[0].id, valor]
    )
  ).rows[0];
};

before(async () => {
  empresa = await criarEmpresa();
  admin = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  gestor = await criarUsuario({ empresaId: empresa.id, role: 'gestor' });
  posVenda = await criarUsuario({ empresaId: empresa.id, role: 'pos_venda' });
  cliente = await criarCliente({ empresaId: empresa.id });
  seguradora = await criarSeguradora({ empresaId: empresa.id, nome: 'Operadora X' });
  T3 = await criarTabelaComissao({ seguradoraId: seguradora.id, nome: 'T3', percentuais: [100, 90], estornoMeses: 3 });
  semPrazo = await criarTabelaComissao({ seguradoraId: seguradora.id, nome: 'Sem prazo', percentuais: [100] });
});

// ---------------- Monitoramento ----------------

test('005/CA-01: fim do período da apólice padrão é 09/04/2027', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const ap = await novaApolice({ corretor: cad });
  const m = await api('GET', '/monitoramento-estorno', { token: gestor.token });
  assert.equal(m.status, 200);
  assert.equal(m.body.em_periodo.find((x) => x.apolice_id === ap.id).fim_periodo, '2027-04-09');
});

test('005/CA-02 e CA-16: dentro do período aparece (com destaque a 30 dias); com fim ontem, não', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const dentro = await novaApolice({ corretor: cad, inicio: await dataRelativa(`(${SQL_HOJE_BRASIL} - interval '1 month')::date`) });
  const quaseNoFim = await novaApolice({
    corretor: cad,
    inicio: await dataRelativa(`(${SQL_HOJE_BRASIL} - interval '3 months' + interval '10 days')::date`),
  });
  const encerrada = await novaApolice({ corretor: cad, inicio: await dataRelativa(`(${SQL_HOJE_BRASIL} - interval '3 months')::date`) });

  const { em_periodo } = (await api('GET', '/monitoramento-estorno', { token: posVenda.token })).body;
  const linha = (id) => em_periodo.find((x) => x.apolice_id === id);
  assert.ok(linha(dentro.id));
  assert.equal(linha(dentro.id).destaque, false);
  assert.equal(linha(quaseNoFim.id).destaque, true);
  assert.ok(linha(quaseNoFim.id).dias_restantes <= 30 && linha(quaseNoFim.id).dias_restantes >= 0);
  assert.equal(linha(encerrada.id), undefined, 'fim do período foi ontem');
});

test('005/CA-03: corretor vê só os próprios; pós-venda vê todos, sem valores', async () => {
  const cad1 = await criarCorretor({ empresaId: empresa.id, nome: 'Monitor Um' });
  const cad2 = await criarCorretor({ empresaId: empresa.id, nome: 'Monitor Dois' });
  const user1 = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cad1.id });
  const ap1 = await novaApolice({ corretor: cad1 });
  const ap2 = await novaApolice({ corretor: cad2 });

  const doCorretor = (await api('GET', '/monitoramento-estorno', { token: user1.token })).body;
  assert.ok(doCorretor.em_periodo.length > 0);
  assert.ok(doCorretor.em_periodo.every((x) => x.corretor_nome === 'Monitor Um'));

  const doPosVenda = (await api('GET', '/monitoramento-estorno', { token: posVenda.token })).body;
  const ids = doPosVenda.em_periodo.map((x) => x.apolice_id);
  assert.ok(ids.includes(ap1.id) && ids.includes(ap2.id));
  for (const linha of doPosVenda.em_periodo) {
    assert.ok(!Object.keys(linha).some((k) => /valor|percentual|premio|comiss/.test(k)), Object.keys(linha).join());
  }
});

test('005/CA-04: apólice sem tabela → 400; tabela sem prazo de estorno → fora do monitoramento', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const r = await api('POST', '/apolices', {
    token: gestor.token,
    body: {
      cliente_id: cliente.id, seguradora_id: seguradora.id, corretor_responsavel_id: cad.id,
      numero_apolice: unico('EST'), tipo_seguro: 'saude', valor_premio_mensal: 1000,
      percentual_comissao: 10, dia_vencimento: 15, data_inicio_vigencia: '2027-01-10',
    },
  });
  assert.equal(r.status, 400);

  const ap = await novaApolice({ corretor: cad, tabela: semPrazo });
  const { em_periodo } = (await api('GET', '/monitoramento-estorno', { token: gestor.token })).body;
  assert.equal(em_periodo.find((x) => x.apolice_id === ap.id), undefined);
});

// ---------------- Etapa 1 — aviso ----------------

test('005/CA-05: aviso dentro do período cancela apólice, parcela 2 e o repasse pendente; estorno aguarda conclusão', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  const { apolice, repasse } = await vendaComRepasse({ corretor: cad });
  assert.deepEqual([repasse.status, repasse.valor_repasse], ['pendente', '240.00']);
  await gerarComissoesMes(new Date(Date.UTC(2027, 1, 1, 12))); // parcela 2 prevista
  const p2Antes = (await db.query('SELECT status FROM comissoes WHERE apolice_id = $1 AND numero_parcela = 2', [apolice.id])).rows[0];
  assert.equal(p2Antes.status, 'prevista');

  const r = await avisar(apolice.id, { data_cancelamento: '2027-03-01', motivo: 'pedido_cliente' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.houve_estorno, true);
  assert.equal(r.body.repasse_cancelado, true);
  assert.equal(r.body.fim_periodo_estorno, '2027-04-09');

  const comissoes = (await db.query('SELECT numero_parcela, status FROM comissoes WHERE apolice_id = $1 ORDER BY numero_parcela', [apolice.id])).rows;
  assert.deepEqual(comissoes, [{ numero_parcela: 1, status: 'recebida' }, { numero_parcela: 2, status: 'cancelada' }]);
  assert.equal((await repasseDa(apolice.id)).status, 'cancelado');
  assert.equal((await db.query('SELECT status FROM apolices WHERE id = $1', [apolice.id])).rows[0].status, 'cancelada');
  const e = (await db.query('SELECT status FROM estornos WHERE apolice_id = $1', [apolice.id])).rows[0];
  assert.equal(e.status, 'aguardando_conclusao');

  // CA-11: cancelada não gera mais comissão
  await gerarComissoesMes(new Date(Date.UTC(2027, 2, 1, 12)));
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM comissoes WHERE apolice_id = $1', [apolice.id])).rows[0].n, 2);

  // Parcela 1 recebida de venda estornada não gera repasse depois
  await gerarRepasses();
  assert.equal((await db.query(
    `SELECT COUNT(*)::int AS n FROM repasses r JOIN comissoes c ON c.id = r.comissao_id WHERE c.apolice_id = $1`, [apolice.id])).rows[0].n, 1);
});

test('005/CA-07: aviso fora do período (10/04/2027) cancela sem estorno', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const ap = await novaApolice({ corretor: cad });
  const r = await avisar(ap.id, { data_cancelamento: '2027-04-10', motivo: 'financeiro' });
  assert.equal(r.status, 200);
  assert.equal(r.body.houve_estorno, false);
  assert.equal(r.body.estorno_id, null);
  assert.equal((await db.query('SELECT 1 FROM estornos WHERE apolice_id = $1', [ap.id])).rows.length, 0);

  // CA-08: registrar de novo → 400
  assert.equal((await avisar(ap.id, { data_cancelamento: '2027-04-10', motivo: 'financeiro' })).status, 400);
});

test('005/CA-15: aviso sem motivo, ou "outro" sem descrição → 400 e nada muda', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const ap = await novaApolice({ corretor: cad });
  assert.equal((await avisar(ap.id, { data_cancelamento: '2027-03-01' })).status, 400);
  assert.equal((await avisar(ap.id, { data_cancelamento: '2027-03-01', motivo: 'outro' })).status, 400);
  assert.equal((await avisar(ap.id, { data_cancelamento: '01/03/2027', motivo: 'financeiro' })).status, 400);
  assert.equal((await db.query('SELECT status FROM apolices WHERE id = $1', [ap.id])).rows[0].status, 'ativa');
  assert.equal(
    (await avisar(ap.id, { data_cancelamento: '2027-03-01', motivo: 'outro', motivo_descricao: 'Mudou de cidade' })).status,
    200
  );
});

test('005/CA-18: edição comum não cancela nem reativa apólice', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const ap = await novaApolice({ corretor: cad });
  assert.equal((await api('PUT', `/apolices/${ap.id}`, { token: posVenda.token, body: { status: 'cancelada' } })).status, 400);
  assert.equal((await api('PUT', `/apolices/${ap.id}`, { token: admin.token, body: { ...ap, status: 'cancelada' } })).status, 400);
  await avisar(ap.id, { data_cancelamento: '2027-05-01', motivo: 'inadimplencia' });
  assert.equal((await api('PUT', `/apolices/${ap.id}`, { token: posVenda.token, body: { status: 'ativa' } })).status, 400);
  assert.equal((await api('PUT', `/apolices/${ap.id}`, { token: posVenda.token, body: { observacoes: 'ok' } })).status, 200);
});

// ---------------- Etapa 2 — conclusão ----------------

let corretorComSaldo; // usado no CA-09
test('005/CA-06: repasse pago + conclusão com desconto da plataforma → estorno a descontar e saldo de R$ 240,00', async () => {
  corretorComSaldo = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  const { apolice, repasse } = await vendaComRepasse({ corretor: corretorComSaldo, pago: true });
  const aviso = await avisar(apolice.id, { data_cancelamento: '2027-03-01', motivo: 'pedido_cliente' });
  assert.equal(aviso.body.repasse_cancelado, false, 'repasse já pago não é cancelado');

  // CA-13: sem valor → 400; pós-venda → 403
  assert.equal((await concluir(aviso.body.estorno_id, { forma_cobranca: 'desconto_plataforma' })).status, 400);
  assert.equal((await concluir(aviso.body.estorno_id, { valor_estornado: 1000, forma_cobranca: 'desconto_plataforma' }, posVenda.token)).status, 403);

  const r = await concluir(aviso.body.estorno_id, { valor_estornado: 1000, forma_cobranca: 'desconto_plataforma' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.estorno.status, 'a_descontar');
  assert.equal(r.body.estorno.valor_estornado, '1000.00');
  assert.deepEqual([r.body.saldo.valor_original, r.body.saldo.valor_restante, r.body.saldo.status], ['240.00', '240.00', 'pendente']);
  assert.equal((await repasseDa(apolice.id)).status, 'pago');
  assert.equal(repasse.valor_repasse, '240.00');

  // Concluir de novo → 400
  assert.equal((await concluir(aviso.body.estorno_id, { valor_estornado: 1000, forma_cobranca: 'pix_boleto' })).status, 400);
});

test('005/CA-19: estorno concluído depois do desligamento do corretor → sem saldo, corretora assume', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  const { apolice } = await vendaComRepasse({ corretor: cad, pago: true });
  await db.query(`UPDATE corretores SET status = 'inativo' WHERE id = $1`, [cad.id]);
  const aviso = await avisar(apolice.id, { data_cancelamento: '2027-03-01', motivo: 'pedido_cliente' });
  const r = await concluir(aviso.body.estorno_id, { valor_estornado: 1000, forma_cobranca: 'pix_boleto' });
  assert.equal(r.status, 200);
  assert.equal(r.body.saldo, null);
  assert.equal(r.body.estorno.assumido_pela_corretora, true);
  assert.equal(r.body.estorno.status, 'a_pagar');
  assert.deepEqual(await saldoDo(cad.id), []);
});

// ---------------- Saldo e repasses ----------------

test('005/CA-09: saldo de R$ 240,00 é descontado do próximo repasse de R$ 300,00 → R$ 60,00 a pagar', async () => {
  const { repasse } = await vendaComRepasse({ corretor: corretorComSaldo, valorReal: 1000 });
  assert.deepEqual([repasse.valor_repasse, repasse.valor_desconto_saldo, repasse.a_pagar], ['300.00', '240.00', '60.00']);
  const [s] = await saldoDo(corretorComSaldo.id);
  assert.deepEqual([s.valor_restante, s.status], ['0.00', 'quitado']);

  const lista = (await api('GET', '/repasses', { token: gestor.token })).body;
  assert.equal(lista.find((x) => x.id === repasse.id).valor_a_pagar, '60.00');
});

test('005/CA-10: repasse menor que o saldo zera o repasse e o restante vai para o seguinte', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  await saldoPronto(cad, 240);
  const primeiro = (await vendaComRepasse({ corretor: cad, valorReal: 333.33, mensalidade: 333.33 })).repasse;
  assert.deepEqual([primeiro.valor_repasse, primeiro.valor_desconto_saldo, primeiro.a_pagar], ['100.00', '100.00', '0.00']);
  assert.equal((await saldoDo(cad.id))[0].valor_restante, '140.00');

  const segundo = (await vendaComRepasse({ corretor: cad, valorReal: 1000 })).repasse;
  assert.deepEqual([segundo.valor_desconto_saldo, segundo.a_pagar], ['140.00', '160.00']);
  assert.equal((await saldoDo(cad.id))[0].status, 'quitado');
});

let cadAcordo;
let userAcordo;
test('005/CA-21: acordo de R$ 50,00 por repasse limita o desconto', async () => {
  cadAcordo = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  userAcordo = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cadAcordo.id });
  const s = await saldoPronto(cadAcordo, 240);
  const a = await api('PUT', `/saldos-corretor/${s.id}/acordo`, { token: gestor.token, body: { desconto_maximo_por_repasse: 50 } });
  assert.equal(a.status, 200);
  const { repasse } = await vendaComRepasse({ corretor: cadAcordo, valorReal: 1000 });
  assert.deepEqual([repasse.valor_desconto_saldo, repasse.a_pagar], ['50.00', '250.00']);
  assert.equal((await saldoDo(cadAcordo.id))[0].valor_restante, '190.00');
});

test('005/CA-14: corretor vê o próprio saldo pendente no painel, não o do colega', async () => {
  const meu = await api('GET', '/dashboard', { token: userAcordo.token });
  assert.equal(meu.body.saldo_pendente, 190);
  const outroCad = await criarCorretor({ empresaId: empresa.id });
  const outro = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: outroCad.id });
  assert.equal((await api('GET', '/dashboard', { token: outro.token })).body.saldo_pendente, 0);
});

test('005/CA-22: quitação manual parcial reduz o restante; a total quita; acima do restante → 400', async () => {
  const [s] = await saldoDo(cadAcordo.id);
  const quitar = (valor) =>
    api('POST', `/saldos-corretor/${s.id}/quitacoes`, { token: gestor.token, body: { valor, observacao: 'Acordo em reunião' } });
  assert.equal((await quitar(500)).status, 400);
  assert.equal((await quitar(90)).body.valor_restante, '100.00');
  const total = await quitar(100);
  assert.deepEqual([total.body.valor_restante, total.body.status], ['0.00', 'quitado']);

  const lista = (await api('GET', `/saldos-corretor?corretor_id=${cadAcordo.id}`, { token: gestor.token })).body;
  assert.deepEqual(lista[0].movimentos.map((m) => [m.tipo, Number(m.valor)]), [
    ['desconto_repasse', 50],
    ['quitacao_manual', 90],
    ['quitacao_manual', 100],
  ]);
});

test('005/CA-24 e 002/RN-22: recebimento corrigido para menos devolve ao saldo o desconto que não cabe', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  await saldoPronto(cad, 240);
  const { apolice, repasse } = await vendaComRepasse({ corretor: cad, valorReal: 1000 });
  assert.equal(repasse.valor_desconto_saldo, '240.00');
  await receberParcela1(apolice.id, 500); // repasse vira R$ 150,00
  const depois = await repasseDa(apolice.id);
  assert.deepEqual([depois.valor_repasse, depois.valor_desconto_saldo, depois.a_pagar], ['150.00', '150.00', '0.00']);
  const [s] = await saldoDo(cad.id);
  assert.deepEqual([s.valor_restante, s.status], ['90.00', 'pendente']);

  // Outro corretor da mesma operadora, sem saldo: o repasse dele não é afetado por estornos
  const semSaldo = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  const venda = await vendaComRepasse({ corretor: semSaldo, valorReal: 1000 });
  assert.deepEqual([venda.repasse.valor_desconto_saldo, venda.repasse.a_pagar], ['0.00', '300.00']);
});

// ---------------- Cancelamentos do mês, relatório e acesso ----------------

test('005/CA-17: cancelamento de hoje aparece no quadro do mês, com motivo e estorno', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const ap = await novaApolice({ corretor: cad, inicio: await dataRelativa(`(${SQL_HOJE_BRASIL} - interval '1 month')::date`) });
  const r = await avisar(ap.id, { motivo: 'troca_plano' }); // data padrão: hoje em Brasília
  assert.equal(r.body.houve_estorno, true);
  const { cancelamentos_mes } = (await api('GET', '/monitoramento-estorno', { token: gestor.token })).body;
  const linha = cancelamentos_mes.find((x) => x.apolice_id === ap.id);
  assert.deepEqual([linha.motivo_cancelamento, linha.houve_estorno], ['troca_plano', true]);
});

test('005/CA-23 e CA-20: relatório por operadora — a receber, estornos a descontar e líquido esperado', async () => {
  const e2 = await criarEmpresa();
  const g2 = await criarUsuario({ empresaId: e2.id, role: 'gestor' });
  const seg = await criarSeguradora({ empresaId: e2.id, nome: 'Operadora Y' });
  const tab = await criarTabelaComissao({ seguradoraId: seg.id, percentuais: [100], estornoMeses: 3 });
  const cad = await criarCorretor({ empresaId: e2.id });
  const cli = await criarCliente({ empresaId: e2.id });
  const criar = async (mensalidade) => {
    const r = await api('POST', '/apolices', {
      token: g2.token,
      body: {
        cliente_id: cli.id, seguradora_id: seg.id, corretor_responsavel_id: cad.id, numero_apolice: unico('REL'),
        tipo_seguro: 'saude', valor_premio_mensal: mensalidade, tabela_comissao_id: tab.id, dia_vencimento: 15,
        data_inicio_vigencia: '2027-01-10',
      },
    });
    assert.equal(r.status, 201);
    return r.body;
  };
  await criar(2000); // parcela 1 de R$ 2.000,00 a receber
  const vendida = await criar(500);
  const c = await comissao1(vendida.id);
  await api('PUT', `/comissoes/${c.id}/recebida`, { token: g2.token, body: { data_recebimento: '2027-01-20' } });
  const aviso = await api('POST', `/apolices/${vendida.id}/cancelamento`, {
    token: g2.token, body: { data_cancelamento: '2027-03-01', motivo: 'inadimplencia' },
  });
  const est = await api('PUT', `/estornos/${aviso.body.estorno_id}/concluir`, {
    token: g2.token, body: { valor_estornado: 1000, forma_cobranca: 'desconto_plataforma' },
  });
  assert.equal(est.status, 200);

  const linha = async () =>
    (await api('GET', `/relatorios/plataforma?competencia=${c.competencia}`, { token: g2.token })).body.operadoras
      .find((o) => o.seguradora_id === seg.id);
  const antes = await linha();
  assert.deepEqual(
    [antes.a_receber, antes.recebido, antes.estornos_a_descontar, antes.liquido_esperado],
    ['2000.00', '500.00', '1000.00', '1000.00']
  );

  // CA-20: plataforma descontou → sai do "a descontar"
  const liq = await api('PUT', `/estornos/${aviso.body.estorno_id}/liquidar`, { token: g2.token, body: { data: '2027-04-10' } });
  assert.deepEqual([liq.status, liq.body.status], [200, 'descontado']);
  const depois = await linha();
  assert.deepEqual([depois.estornos_a_descontar, depois.liquido_esperado], ['0.00', '2000.00']);
  assert.equal((await api('PUT', `/estornos/${aviso.body.estorno_id}/liquidar`, { token: g2.token, body: {} })).status, 400);
});

test('005/CA-12: corretor não registra aviso nem vê saldos; empresa B não vê nem mexe no estorno da A', async () => {
  const cad = await criarCorretor({ empresaId: empresa.id });
  const user = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cad.id });
  const ap = await novaApolice({ corretor: cad });
  assert.equal((await avisar(ap.id, { motivo: 'pedido_cliente' }, user.token)).status, 403);
  assert.equal((await api('GET', '/saldos-corretor', { token: user.token })).status, 403);

  const outra = await criarEmpresa();
  const adminB = await criarUsuario({ empresaId: outra.id, role: 'admin' });
  assert.equal((await avisar(ap.id, { motivo: 'pedido_cliente' }, adminB.token)).status, 404);

  const aviso = await avisar(ap.id, { data_cancelamento: '2027-03-01', motivo: 'pedido_cliente' });
  assert.equal((await concluir(aviso.body.estorno_id, { valor_estornado: 10, forma_cobranca: 'pix_boleto' }, adminB.token)).status, 404);
  const listaB = (await api('GET', '/estornos', { token: adminB.token })).body;
  assert.deepEqual(listaB, []);
  const monitorB = (await api('GET', '/monitoramento-estorno', { token: adminB.token })).body;
  assert.deepEqual([monitorB.em_periodo, monitorB.cancelamentos_mes], [[], []]);
});
