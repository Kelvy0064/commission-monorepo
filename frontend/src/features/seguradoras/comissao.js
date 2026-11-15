export const MODALIDADES = [
  { id: 'todas', label: 'Todas' },
  { id: 'pf', label: 'PF / Individual' },
  { id: 'adesao', label: 'Coletivo por adesão' },
  { id: 'pme', label: 'PME' },
  { id: 'empresarial', label: 'Empresarial' },
];

export const modalidadeLabel = (id) => MODALIDADES.find((m) => m.id === id)?.label || id;

const fmtPct = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
export { fmtPct };

// Resumo legível: "1ª 100% · 2ª 90% (agenciamento 190%) · vitalício 2% a partir da 3ª, por 12 meses"
export const resumoTabela = (t) => {
  const partes = [];
  const parcelas = t.percentuais_parcelas || [];
  if (parcelas.length) {
    const total = parcelas.reduce((s, p) => s + Number(p), 0);
    partes.push(`${parcelas.map((p, i) => `${i + 1}ª ${fmtPct(p)}`).join(' · ')} (agenciamento ${fmtPct(total)})`);
  }
  if (t.vitalicio_percentual != null) {
    const duracao = t.vitalicio_meses ? `por ${t.vitalicio_meses} ${t.vitalicio_meses === 1 ? 'mês' : 'meses'}` : 'enquanto ativo';
    partes.push(`vitalício ${fmtPct(t.vitalicio_percentual)} a partir da ${parcelas.length + 1}ª, ${duracao}`);
  }
  return partes.join(' · ');
};

// Cronograma de comissão para uma mensalidade: [{ parcela, tipo, percentual, valor }]
// Mostra o agenciamento parcela a parcela e as `mesesVitalicio` primeiras parcelas de vitalício.
export const cronograma = (t, mensalidade, mesesVitalicio = 3) => {
  const valor = Number(mensalidade) || 0;
  const linhas = (t.percentuais_parcelas || []).map((p, i) => ({
    parcela: i + 1,
    tipo: 'Agenciamento',
    percentual: Number(p),
    valor: (valor * Number(p)) / 100,
  }));
  if (t.vitalicio_percentual != null) {
    const n = t.vitalicio_meses ? Math.min(t.vitalicio_meses, mesesVitalicio) : mesesVitalicio;
    for (let i = 0; i < n; i++) {
      linhas.push({
        parcela: linhas.length + 1,
        tipo: 'Vitalício',
        percentual: Number(t.vitalicio_percentual),
        valor: (valor * Number(t.vitalicio_percentual)) / 100,
      });
    }
  }
  return linhas;
};
