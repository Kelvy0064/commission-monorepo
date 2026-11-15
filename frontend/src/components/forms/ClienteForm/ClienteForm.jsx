import React, { useState } from 'react';
import Button from '../../common/Button/Button';
import { validateRequired, validateEmail } from '../../../utils/validators';
import { STATUS } from '../../../utils/constants';
import { maskTelefone } from '../../../utils/formatters';

const ClienteForm = ({ cliente, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    endereco: '',
    status: STATUS.ATIVO,
    ...cliente,
    telefone: maskTelefone(cliente?.telefone),
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!validateRequired(formData.nome)) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!validateRequired(formData.cpf_cnpj)) {
      newErrors.cpf_cnpj = 'CPF/CNPJ é obrigatório';
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
        <input
          type="text"
          value={formData.nome}
          onChange={(e) => handleChange('nome', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.nome ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.nome && <p className="mt-1 text-sm text-red-600">{errors.nome}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ *</label>
        <input
          type="text"
          value={formData.cpf_cnpj}
          onChange={(e) => handleChange('cpf_cnpj', e.target.value)}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.cpf_cnpj ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.cpf_cnpj && <p className="mt-1 text-sm text-red-600">{errors.cpf_cnpj}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={15}
          value={formData.telefone}
          onChange={(e) => handleChange('telefone', maskTelefone(e.target.value))}
          placeholder="(00) 00000-0000"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
        <input
          type="date"
          value={formData.data_nascimento}
          onChange={(e) => handleChange('data_nascimento', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
        <textarea
          value={formData.endereco}
          onChange={(e) => handleChange('endereco', e.target.value)}
          rows="2"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
        <select
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value={STATUS.ATIVO}>Ativo</option>
          <option value={STATUS.INATIVO}>Inativo</option>
          <option value={STATUS.CANCELADO}>Cancelado</option>
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" variant="primary" className="flex-1" loading={loading}>
          {cliente ? 'Atualizar' : 'Criar'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default ClienteForm;