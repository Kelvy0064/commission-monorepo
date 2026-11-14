export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateCPF = (cpf) => {
  cpf = cpf.replace(/[^\d]/g, '');
  if (cpf.length !== 11) return false;
  
  // Validação básica (implementar validação completa se necessário)
  return /^\d{11}$/.test(cpf);
};

export const validateCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/[^\d]/g, '');
  return /^\d{14}$/.test(cnpj);
};

export const validateRequired = (value) => {
  return value !== null && value !== undefined && value !== '';
};
