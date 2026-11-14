export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value || 0);
};

export const formatDate = (date) => {
  if (!date) return '-';
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

export const formatPercentage = (value) => {
  return `${value || 0}%`;
};
