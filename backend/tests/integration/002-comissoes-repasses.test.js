// Spec 002 — apólice gera comissões por parcela; job mensal; recebimento e repasse ao corretor.
// Exemplo padrão da spec: tabela T = {100%, 90%} + vitalício 2% por 12 meses; mensalidade R$ 1.000,00;
// boleto vence no dia 15. Os testes rodam em ordem e dependem dos anteriores.

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
} = require('../helpers/contexto');
const gerarComissoesMes = require('../../jobs/gerarComissoesMes');
const { competenciaBrasil } = require('../../utils/dataBrasil');
const poolDaApi = require('../../config/database');

after(() => poolDaApi.end()); // o job usa o pool da aplicação; fechar evita esperar o timeout ocioso

const agora = new Date();
const mesAtual = competenciaBrasil(agora);
const [anoAtual, numMesAtual] = mesAtual.split('-').map(Number);
// Meio-dia UTC do dia 1 = 9h em Brasília: mesmo dia/mês nos dois fusos
const inicioDoMes = (deslocamento) => new Date(Date.UTC(anoAtual, numMesAtual - 1 + deslocamento, 1, 12));
const proximoMes = inicioDoMes(1);

let empresa;
let admin;
let gestor;
let cad;
let corretorUser;
let cliente;
let seguradora;
let T;
let tabelaCurta; // {100%} sem vitalício

const comissoesDa = async (apoliceId) =>
  (
    await db.query(
      `SELECT id, numero_parcela, tipo, competencia, status, percentual_comissao, valor_comissao_bruto,
              valor_comissao_liquido, to_char(data_previsao_recebimento, 'YYYY-MM-DD') AS previsao
       FROM comissoes WHERE apolice_id = $1 ORDER BY numero_parcela`,
      [apoliceId]
    )
  ).rows;

const repasseDa = async (comissaoId) =>
  (
    await db.query(
      `SELECT id, valor_repasse, percentual_repasse, status, corretor_destino_id, empresa_id,
              to_char(data_previsao_pagamento, 'YYYY-MM-DD') AS previsao
       FROM repasses WHERE comissao_id = $1`,
      [comissaoId]
    )
  ).rows[0];

const corpoApolice = (extra) => ({
  cliente_id: cliente.id,
  seguradora_id: seguradora.id,
  corretor_responsavel_id: cad.id,
  numero_apolice: unico('AP'),
  tipo_seguro: 'saude',
  valor_premio_mensal: 1000,
  dia_vencimento: 15,
  data_inicio_vigencia: '2026-01-01',
  ...extra,
});

const criarApolice = async (extra, token = gestor.token) => {
  const r = await api('POST', '/apolices', { token, body: corpoApolice(extra) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

const criarTabela = async (seguradoraId, body) => {
  const r = await api('POST', `/seguradoras/${seguradoraId}/tabelas-comissao`, { token: admin.token, body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

const receber = (comissaoId, body, token = gestor.token) =>
  api('PUT', `/comissoes/${comissaoId}/recebida`, { token, body });

before(async () => {
  empresa = await criarEmpresa();
  admin = await criarUsuario({ empresaId: empresa.id, role: 'admin' });
  gestor = await criarUsuario({ empresaId: empresa.id, role: 'gestor' });
  cad = await criarCorretor({ empresaId: empresa.id, percentual: 30 });
  corretorUser = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: cad.id });
  cliente = await criarCliente({ empresaId: empresa.id, corretorId: cad.id });
  seguradora = await criarSeguradora({ empresaId: empresa.id });
  T = await criarTabela(seguradora.id, {
    nome: 'Tabela T',
    percentuais_parcelas: [100, 90],
    vitalicio_percentual: 2,
    vitalicio_meses: 12,
  });
  tabelaCurta = await criarTabela(seguradora.id, { nome: 'Só 1ª parcela', percentuais_parcelas: [100] });
});

test('002/CA-07: apólice sem dia de vencimento do boleto → 400 e nada é gravado', async () => {
  for (const dia of [undefined, '', 0, 32]) {
    const corpo = corpoApolice({ percentual_comissao: 10, dia_vencimento: dia });
    const r = await api('POST', '/apolices', { token: gestor.token, body: corpo });
    assert.equal(r.status, 400, `dia_vencimento=${dia}`);
    assert.equal((await db.query('SELECT 1 FROM apolices WHERE numero_apolice = $1', [corpo.numero_apolice])).rows.length, 0);
  }
});

test('002/CA-07: seguradora com dia de pagamento e prazo "a confirmar" não bloqueia mais a apólice', async () => {
  const incompleta = await criarSeguradora({ empresaId: empresa.id, diaPagamento: null, prazoRepasse: null });
  await criarApolice({ seguradora_id: incompleta.id, percentual_comissao: 10 });
});

test('002/CA-08: tabela de outra seguradora → 400', async () => {
  const outra = await criarSeguradora({ empresaId: empresa.id });
  const tabelaDeOutra = await criarTabela(outra.id, { nome: 'Outra', percentuais_parcelas: [50] });
  const r = await api('POST', '/apolices', { token: gestor.token, body: corpoApolice({ tabela_comissao_id: tabelaDeOutra.id }) });
  assert.equal(r.status, 400);
});

let apoliceT;
let apoliceCurta;
let apoliceSemVencimento;

test('002/CA-09: apólice com a tabela T gera a parcela 1 prevista para o vencimento do boleto', async () => {
  apoliceT = await criarApolice({ tabela_comissao_id: T.id });
  assert.equal(Number(apoliceT.percentual_comissao), 100);
  assert.equal(apoliceT.tabela_comissao_id, T.id);

  const [c1, ...resto] = await comissoesDa(apoliceT.id);
  assert.equal(resto.length, 0);
  assert.equal(c1.numero_parcela, 1);
  assert.equal(c1.tipo, 'agenciamento');
  assert.equal(c1.competencia, mesAtual); // mês atual em Brasília
  assert.equal(c1.status, 'prevista');
  assert.equal(c1.valor_comissao_bruto, '1000.00');
  assert.equal(c1.valor_comissao_liquido, '1000.00');
  assert.equal(c1.previsao, `${mesAtual}-15`);
});

test('002/CA-10, CA-11, CA-12: job do mês seguinte gera a próxima parcela, sem duplicar', async () => {
  apoliceCurta = await criarApolice({ tabela_comissao_id: tabelaCurta.id });
  apoliceSemVencimento = await criarApolice({ percentual_comissao: 10 });
  await db.query('UPDATE apolices SET dia_vencimento = NULL WHERE id = $1', [apoliceSemVencimento.id]);

  await gerarComissoesMes(proximoMes);

  // CA-10: parcela 2 de R$ 900,00 prevista para o dia 15 do mês seguinte
  const comissoesT = await comissoesDa(apoliceT.id);
  assert.equal(comissoesT.length, 2);
  const mesSeguinte = competenciaBrasil(proximoMes);
  assert.deepEqual(
    [comissoesT[1].numero_parcela, comissoesT[1].tipo, comissoesT[1].competencia, comissoesT[1].valor_comissao_bruto, comissoesT[1].previsao],
    [2, 'agenciamento', mesSeguinte, '900.00', `${mesSeguinte}-15`]
  );

  // CA-11: a tabela curta acabou na 1ª parcela
  assert.equal((await comissoesDa(apoliceCurta.id)).length, 1);
  // CA-12: apólice sem dia de vencimento é pulada
  assert.equal((await comissoesDa(apoliceSemVencimento.id)).length, 1);

  // CA-10: rodar de novo no mesmo mês não duplica
  await gerarComissoesMes(proximoMes);
  assert.equal((await comissoesDa(apoliceT.id)).length, 2);
});

test('002/CA-22: job disparado às 23h do último dia do mês (Brasília) usa a competência desse mês', async () => {
  const nova = await criarApolice({ percentual_comissao: 10 });
  // 02h UTC do dia 1 do mês M+2 = 23h do último dia do mês M+1 em Brasília
  const fimDoMesSeguinte = new Date(Date.UTC(anoAtual, numMesAtual + 1, 1, 2));
  await gerarComissoesMes(fimDoMesSeguinte);
  const [, p2] = await comissoesDa(nova.id);
  assert.equal(p2.competencia, competenciaBrasil(proximoMes));
});

test('002/CA-13: trocar a tabela da apólice não altera parcelas já geradas', async () => {
  const antes = await comissoesDa(apoliceT.id);
  const r = await api('PUT', `/apolices/${apoliceT.id}`, {
    token: admin.token,
    body: corpoApolice({ numero_apolice: apoliceT.numero_apolice, tabela_comissao_id: tabelaCurta.id }),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(await comissoesDa(apoliceT.id), antes);
});

let repasse;

test('002/CA-14: parcela 1 recebida em 20/01/2027 com R$ 800,00 e corretor com 30% → repasse de R$ 240,00 para 22/01/2027', async () => {
  const [p1] = await comissoesDa(apoliceT.id);
  assert.equal((await receber(p1.id, { data_recebimento: '2027-01-20', valor_real: 800 })).status, 200);

  const g = await api('POST', '/repasses/gerar', { token: gestor.token });
  assert.equal(g.status, 200);
  assert.equal(g.body.repasses_gerados, 1);

  repasse = await repasseDa(p1.id);
  assert.deepEqual(repasse, {
    id: repasse.id,
    valor_repasse: '240.00',
    percentual_repasse: '30.00',
    status: 'pendente',
    corretor_destino_id: cad.id,
    empresa_id: empresa.id,
    previsao: '2027-01-22',
  });

  assert.equal((await api('POST', '/repasses/gerar', { token: gestor.token })).body.repasses_gerados, 0);
});

test('002/CA-20: mudar mensalidade e vencimento recalcula só as comissões ainda não recebidas', async () => {
  const [p1Antes, p2Antes] = await comissoesDa(apoliceT.id);
  assert.equal(p2Antes.status, 'prevista');

  const r = await api('PUT', `/apolices/${apoliceT.id}`, {
    token: admin.token,
    body: corpoApolice({
      numero_apolice: apoliceT.numero_apolice,
      tabela_comissao_id: tabelaCurta.id,
      valor_premio_mensal: 2000,
      dia_vencimento: 20,
    }),
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  const [p1, p2] = await comissoesDa(apoliceT.id);
  assert.deepEqual(p1, p1Antes, 'parcela recebida não muda');
  assert.equal(p2.percentual_comissao, '90.00', 'mantém o percentual da parcela');
  assert.equal(p2.valor_comissao_bruto, '1800.00');
  assert.equal(p2.valor_comissao_liquido, '1800.00');
  assert.equal(p2.previsao, `${p2.competencia}-20`);
  assert.deepEqual(await repasseDa(p1.id), repasse, 'repasse da parcela recebida não muda');
});

test('002/CA-20: pós-venda mudar o dia de vencimento também recalcula a previsão pendente', async () => {
  const posVenda = await criarUsuario({ empresaId: empresa.id, role: 'pos_venda' });
  const r = await api('PUT', `/apolices/${apoliceT.id}`, { token: posVenda.token, body: { dia_vencimento: 31 } });
  assert.equal(r.status, 200);
  const [, p2] = await comissoesDa(apoliceT.id);
  const [a, m] = p2.competencia.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  assert.equal(p2.previsao, `${p2.competencia}-${ultimo}`);

  assert.equal((await api('PUT', `/apolices/${apoliceT.id}`, { token: posVenda.token, body: { dia_vencimento: '' } })).status, 400);
});

test('002/CA-15: parcela 2 recebida não gera repasse', async () => {
  const [, p2] = await comissoesDa(apoliceT.id);
  await receber(p2.id, { data_recebimento: '2027-02-20' });
  assert.equal((await api('POST', '/repasses/gerar', { token: gestor.token })).body.repasses_gerados, 0);
  assert.equal(await repasseDa(p2.id), undefined);
});

test('002/CA-16: mudar o percentual do corretor não altera repasse já gerado', async () => {
  await db.query('UPDATE corretores SET percentual_comissao = 50 WHERE id = $1', [cad.id]);
  const r = await repasseDa((await comissoesDa(apoliceT.id))[0].id);
  assert.deepEqual([r.valor_repasse, r.percentual_repasse], ['240.00', '30.00']);
});

test('002/CA-21: corrigir o valor recebido atualiza o repasse pendente (com o percentual gravado nele)', async () => {
  const [p1] = await comissoesDa(apoliceT.id);
  assert.equal((await receber(p1.id, { data_recebimento: '2027-01-21', valor_real: 1000 })).status, 200);
  const r = await repasseDa(p1.id);
  assert.deepEqual([r.valor_repasse, r.percentual_repasse, r.previsao, r.status], ['300.00', '30.00', '2027-01-23', 'pendente']);
});

test('002/CA-21: valor recebido inválido → 400', async () => {
  const [p1] = await comissoesDa(apoliceT.id);
  assert.equal((await receber(p1.id, { valor_real: -1 })).status, 400);
  assert.equal((await receber(p1.id, { valor_real: 'abc' })).status, 400);
  assert.equal((await receber(p1.id, { data_recebimento: '20/01/2027' })).status, 400);
});

test('002/CA-17: gerar repasses de uma empresa não gera os de outra', async () => {
  const outra = await criarEmpresa();
  const adminB = await criarUsuario({ empresaId: outra.id, role: 'admin' });
  const cadB = await criarCorretor({ empresaId: outra.id });
  const clienteB = await criarCliente({ empresaId: outra.id });
  const segB = await criarSeguradora({ empresaId: outra.id });
  const apB = await criarApolice(
    {
      cliente_id: clienteB.id,
      seguradora_id: segB.id,
      corretor_responsavel_id: cadB.id,
      valor_premio_mensal: 500,
      percentual_comissao: 100,
    },
    adminB.token
  );
  const [p1B] = await comissoesDa(apB.id);
  await receber(p1B.id, { data_recebimento: '2027-01-20' }, adminB.token);

  assert.equal((await api('POST', '/repasses/gerar', { token: gestor.token })).body.repasses_gerados, 0);
  assert.equal(await repasseDa(p1B.id), undefined);

  assert.equal((await api('POST', '/repasses/gerar', { token: adminB.token })).body.repasses_gerados, 1);
});

test('002/CA-18: corretor vê só os próprios repasses', async () => {
  const meus = await api('GET', '/repasses', { token: corretorUser.token });
  assert.equal(meus.status, 200);
  assert.deepEqual(meus.body.map((r) => r.id), [repasse.id]);

  const outroCad = await criarCorretor({ empresaId: empresa.id });
  const outro = await criarUsuario({ empresaId: empresa.id, role: 'corretor', corretorId: outroCad.id });
  const deOutro = await api('GET', `/repasses?corretor_id=${cad.id}`, { token: outro.token });
  assert.deepEqual(deOutro.body, []);
});

test('002/CA-19: marcar repasse como pago grava status e data', async () => {
  const r = await api('PUT', `/repasses/${repasse.id}/pago`, {
    token: gestor.token,
    body: { data_pagamento: '2027-01-26', forma_pagamento: 'pix' },
  });
  assert.equal(r.status, 200);
  const pago = (
    await db.query(`SELECT status, to_char(data_pagamento_real, 'YYYY-MM-DD') AS data FROM repasses WHERE id = $1`, [repasse.id])
  ).rows[0];
  assert.deepEqual(pago, { status: 'pago', data: '2027-01-26' });
});

test('002/CA-21: repasse já pago não muda quando o valor recebido é corrigido', async () => {
  const [p1] = await comissoesDa(apoliceT.id);
  await receber(p1.id, { data_recebimento: '2027-01-21', valor_real: 500 });
  const r = await repasseDa(p1.id);
  assert.deepEqual([r.valor_repasse, r.status], ['300.00', 'pago']);
});

test('002/CA-23: corretor inativo continua recebendo repasse, mas perde o acesso; o gestor vê', async () => {
  const [p1] = await comissoesDa(apoliceCurta.id);
  await receber(p1.id, { data_recebimento: '2027-01-20' });
  await db.query(`UPDATE corretores SET status = 'inativo' WHERE id = $1`, [cad.id]);

  assert.equal((await api('POST', '/repasses/gerar', { token: gestor.token })).body.repasses_gerados, 1);
  const r = await repasseDa(p1.id);
  assert.equal(r.corretor_destino_id, cad.id);

  assert.equal((await api('GET', '/repasses', { token: corretorUser.token })).status, 401);
  const doGestor = await api('GET', `/repasses?corretor_id=${cad.id}`, { token: gestor.token });
  assert.ok(doGestor.body.some((x) => x.id === r.id));
});
