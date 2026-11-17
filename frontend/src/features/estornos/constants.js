// Rótulos do estorno (spec 005) — os códigos vêm de backend/utils/estorno.js

export const MOTIVOS_CANCELAMENTO = [
  { id: 'pedido_cliente', label: 'Pedido do cliente' },
  { id: 'inadimplencia', label: 'Inadimplência' },
  { id: 'troca_plano', label: 'Troca de plano/operadora' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'outro', label: 'Outro' },
];

export const motivoLabel = (id, descricao) => {
  const label = MOTIVOS_CANCELAMENTO.find((m) => m.id === id)?.label || id || '-';
  return id === 'outro' && descricao ? `${label}: ${descricao}` : label;
};

export const FORMAS_COBRANCA = [
  { id: 'desconto_plataforma', label: 'Descontado do próximo pagamento da mesma operadora' },
  { id: 'pix_boleto', label: 'PIX/boleto enviado pela plataforma' },
];

export const STATUS_ESTORNO = {
  aguardando_conclusao: { label: 'Aguardando conclusão', cor: 'bg-yellow-100 text-yellow-800' },
  a_descontar: { label: 'A descontar', cor: 'bg-orange-100 text-orange-800' },
  a_pagar: { label: 'A pagar (PIX/boleto)', cor: 'bg-orange-100 text-orange-800' },
  descontado: { label: 'Descontado', cor: 'bg-green-100 text-green-800' },
  pago: { label: 'Pago', cor: 'bg-green-100 text-green-800' },
};

// Hoje (AAAA-MM-DD) no horário de Brasília
export const hojeBrasil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
export const competenciaAtual = () => hojeBrasil().slice(0, 7);
