import React, { useState, useEffect } from 'react';
import Button from '../../../components/common/Button/Button';
import { validateRequired, validateEmail, validateCPF } from '../../../utils/validators';
import { TIPO_CORRETOR, STATUS } from '../../../utils/constants';
import { maskTelefone } from '../../../utils/formatters';

const CorretorForm = ({ corretor, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    tipo: TIPO_CORRETOR.COMISSIONADO,
    percentual_comissao: '',
    status: STATUS.ATIVO,
    ...corretor,
    telefone: maskTelefone(corretor?.telefone),
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando usuário digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!validateRequired(formData.nome)) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!validateRequired(formData.cpf)) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!validateCPF(formData.cpf)) {
      newErrors.cpf = 'CPF inválido';
    }

    if (!validateRequired(formData.email)) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!validateRequired(formData.percentual_comissao)) {
      newErrors.percentual_comissao = 'Percentual é obrigatório';
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
      {/* Nome */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome *
        </label>
        <input
          type="text"
          value={formData.nome}
          onChange={(e) => handleChange('nome', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.nome ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.nome && (
          <p className="mt-1 text-sm text-red-600">{errors.nome}</p>
        )}
      </div>

      {/* CPF */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          CPF *
        </label>
        <input
          type="text"
          value={formData.cpf}
          onChange={(e) => handleChange('cpf', e.target.value)}
          placeholder="000.000.000-00"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.cpf ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.cpf && (
          <p className="mt-1 text-sm text-red-600">{errors.cpf}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      {/* Telefone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Telefone
        </label>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={15}
          value={formData.telefone}
          onChange={(e) => handleChange('telefone', maskTelefone(e.target.value))}
          placeholder="(00) 00000-0000"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo *
        </label>
        <select
          value={formData.tipo}
          onChange={(e) => handleChange('tipo', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          <option value={TIPO_CORRETOR.TITULAR}>Titular</option>
          <option value={TIPO_CORRETOR.ASSOCIADO}>Associado</option>
          <option value={TIPO_CORRETOR.COMISSIONADO}>Comissionado</option>
        </select>
      </div>

      {/* Percentual Comissão */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Percentual de Comissão (%) *
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.percentual_comissao}
          onChange={(e) => handleChange('percentual_comissao', parseFloat(e.target.value))}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.percentual_comissao ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.percentual_comissao && (
          <p className="mt-1 text-sm text-red-600">{errors.percentual_comissao}</p>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status *
        </label>
        <select
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          <option value={STATUS.ATIVO}>Ativo</option>
          <option value={STATUS.INATIVO}>Inativo</option>
        </select>
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          loading={loading}
          disabled={loading}
        >
          {corretor ? 'Atualizar' : 'Criar'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default CorretorForm;
