export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value || 0);
};

// Datas (colunas DATE) chegam da API como "AAAA-MM-DD" ou "AAAA-MM-DDT00:00:00.000Z".
// Usa a parte da data como está, sem converter fuso — senão, no Brasil (UTC-3),
// a meia-noite UTC vira o dia anterior.
export const formatDate = (date) => {
  if (!date) return '-';
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
};

export const formatCPF = (cpf) => {
  if (!cpf) return '-';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatCNPJ = (cnpj) => {
  if (!cnpj) return '-';
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

// Máscara progressiva de telefone: (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular)
export const maskTelefone = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const splitAt = digits.length === 11 ? 5 : 4;
  if (rest.length <= splitAt) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
};

export const formatPercentage = (value) => {
  return `${value || 0}%`;
};
