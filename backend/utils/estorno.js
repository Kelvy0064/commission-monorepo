// Regras do estorno (spec 005). Fonte única para o período, os motivos de cancelamento e o desconto
// de saldos do corretor nos repasses.

const MOTIVOS_CANCELAMENTO = ['pedido_cliente', 'inadimplencia', 'troca_plano', 'financeiro', 'outro'];
const FORMAS_COBRANCA = ['desconto_plataforma', 'pix_boleto'];

// Fim do período de estorno (RN-01): início da vigência + prazo da tabela (meses) − 1 dia, pela
// aritmética de meses do PostgreSQL (31/01 + 1 mês = 28/02 → fim 27/02). NULL se a tabela não tem prazo.
// `a` = alias da apólice, `t` = alias da tabela de comissão.
const sqlFimPeriodo = (a = 'a', t = 't') =>
  `((${a}.data_inicio_vigencia + make_interval(months => ${t}.estorno_meses))::date - 1)`;

// Destaque no monitoramento quando faltam até 30 dias (RN-15, D15)
const DIAS_DESTAQUE = 30;

const centavos = (v) => Math.round(Number(v) * 100);

// Quanto descontar de cada saldo pendente num repasse (RN-09). `saldos` já vem na ordem de
// cobrança (mais antigo primeiro), com { id, valor_restante, desconto_maximo_por_repasse }.
// Cada desconto respeita o valor ainda livre no repasse, o restante do saldo e o teto do acordo.
// Retorna [{ saldo_id, valor }] (em reais, 2 casas), só com descontos > 0.
const planejarDescontos = (valorRepasse, saldos) => {
  let livre = centavos(valorRepasse);
  const descontos = [];
  for (const s of saldos) {
    if (livre <= 0) break;
    const teto = s.desconto_maximo_por_repasse == null ? Infinity : centavos(s.desconto_maximo_por_repasse);
    const d = Math.min(livre, centavos(s.valor_restante), teto);
    if (d > 0) {
      descontos.push({ saldo_id: s.id, valor: d / 100 });
      livre -= d;
    }
  }
  return descontos;
};

// Desconta os saldos pendentes do corretor num repasse recém-gerado (RN-09) e registra o histórico.
// Retorna o total descontado.
const descontarSaldos = async (db, { repasseId, corretorId, empresaId, valorRepasse, data, usuarioId }) => {
  const saldos = await db.query(
    `SELECT id, valor_restante, desconto_maximo_por_repasse FROM saldos_corretor
     WHERE empresa_id = $1 AND corretor_id = $2 AND status = 'pendente'
     ORDER BY created_at, id
     FOR UPDATE`,
    [empresaId, corretorId]
  );
  const descontos = planejarDescontos(valorRepasse, saldos.rows);
  let total = 0;
  for (const d of descontos) {
    await db.query(
      `UPDATE saldos_corretor
       SET valor_restante = valor_restante - $1,
           status = CASE WHEN valor_restante - $1 <= 0 THEN 'quitado' ELSE 'pendente' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [d.valor, d.saldo_id]
    );
    await db.query(
      `INSERT INTO saldo_movimentos (saldo_id, tipo, repasse_id, valor, data, usuario_id)
       VALUES ($1, 'desconto_repasse', $2, $3, $4, $5)`,
      [d.saldo_id, repasseId, d.valor, data, usuarioId]
    );
    total += centavos(d.valor);
  }
  if (total > 0) {
    await db.query('UPDATE repasses SET valor_desconto_saldo = $1 WHERE id = $2', [total / 100, repasseId]);
  }
  return total / 100;
};

// Devolve aos saldos o desconto de um repasse que foi cancelado ou recalculado para menos (plano:
// "desfazer desconto"). `novoMaximo` = quanto do desconto ainda cabe no repasse (0 = devolve tudo).
// Devolve primeiro o desconto mais recente.
const devolverDescontos = async (db, { repasseId, novoMaximo = 0, data, usuarioId }) => {
  const r = await db.query('SELECT valor_desconto_saldo FROM repasses WHERE id = $1 FOR UPDATE', [repasseId]);
  if (r.rows.length === 0) return 0;
  let excesso = centavos(r.rows[0].valor_desconto_saldo) - Math.max(0, centavos(novoMaximo));
  if (excesso <= 0) return 0;

  const movimentos = await db.query(
    `SELECT m.saldo_id,
            SUM(CASE WHEN m.tipo = 'desconto_repasse' THEN m.valor ELSE -m.valor END) AS liquido,
            MAX(m.id) AS ultimo
     FROM saldo_movimentos m
     WHERE m.repasse_id = $1 AND m.tipo IN ('desconto_repasse', 'estorno_de_desconto')
     GROUP BY m.saldo_id
     ORDER BY ultimo DESC`,
    [repasseId]
  );
  const devolvido = excesso;
  for (const m of movimentos.rows) {
    if (excesso <= 0) break;
    const d = Math.min(excesso, centavos(m.liquido));
    if (d <= 0) continue;
    await db.query(
      `UPDATE saldos_corretor SET valor_restante = valor_restante + $1, status = 'pendente',
              updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [d / 100, m.saldo_id]
    );
    await db.query(
      `INSERT INTO saldo_movimentos (saldo_id, tipo, repasse_id, valor, data, observacao, usuario_id)
       VALUES ($1, 'estorno_de_desconto', $2, $3, $4, 'Desconto devolvido ao saldo (repasse cancelado ou recalculado)', $5)`,
      [m.saldo_id, repasseId, d / 100, data, usuarioId]
    );
    excesso -= d;
  }
  await db.query('UPDATE repasses SET valor_desconto_saldo = valor_desconto_saldo - $1 WHERE id = $2', [
    (devolvido - excesso) / 100,
    repasseId,
  ]);
  return (devolvido - excesso) / 100;
};

module.exports = {
  MOTIVOS_CANCELAMENTO,
  FORMAS_COBRANCA,
  DIAS_DESTAQUE,
  sqlFimPeriodo,
  planejarDescontos,
  descontarSaldos,
  devolverDescontos,
};
