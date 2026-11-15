// Etapas do funil, na ordem das colunas do quadro
export const ETAPAS = [
  { id: 'sem_contato', label: 'Sem contato' },
  { id: 'contato_feito', label: 'Contato feito' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'identificacao_interesse', label: 'Identificação do interesse' },
  { id: 'apresentacao', label: 'Apresentação' },
  { id: 'proposta_enviada', label: 'Proposta enviada' },
];

export const STATUS_NEGOCIACAO = {
  em_andamento: { label: 'Em andamento', dot: 'bg-sky-500' },
  vendida: { label: 'Vendida', dot: 'bg-green-500' },
  perdida: { label: 'Perdida', dot: 'bg-red-500' },
};

// Situação da próxima ação em relação a agora: atrasada, hoje, futura ou sem ação
export const situacaoProximaAcao = (dataHora, agora = new Date()) => {
  if (!dataHora) return 'sem';
  // "AAAA-MM-DDTHH:MM" sem fuso → interpretado como hora local
  const data = new Date(dataHora);
  if (data < agora) return 'atrasada';
  if (data.toDateString() === agora.toDateString()) return 'hoje';
  return 'futura';
};

// "2026-10-20T12:00" → "20/10/2026 12:00"
export const formatDataHora = (dataHora) => {
  const m = String(dataHora || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '';
};
