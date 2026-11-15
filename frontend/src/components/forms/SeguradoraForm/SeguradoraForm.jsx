import React, { useState } from 'react';
import Button from '../../common/Button/Button';
import { validateRequired, validateCNPJ } from '../../../utils/validators';

const SeguradoraForm = ({ seguradora, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    contato: '',
    email: '',
    dia_pagamento: '',
    prazo_repasse_dias: '',
    observacoes: '',
    ...seguradora,
    // Campos que podem vir null do banco viram '' para os inputs controlados
    contato: seguradora?.contato ?? '',
    email: seguradora?.email ?? '',
    observacoes: seguradora?.observacoes ?? '',
    contrato_assinado: seguradora?.contrato_assinado ?? false,
    contrato_assinado_em: seguradora?.contrato_assinado_em ? String(seguradora.contrato_assinado_em).slice(0, 10) : '',
    regras_pagamento: seguradora?.regras_pagamento ?? '',
    pos_venda: seguradora?.pos_venda ?? '',
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

    if (!validateRequired(formData.cnpj)) {
      newErrors.cnpj = 'CNPJ é obrigatório';
    } else if (!validateCNPJ(formData.cnpj)) {
      newErrors.cnpj = 'CNPJ inválido';
    }

    if (!validateRequired(formData.dia_pagamento)) {
      newErrors.dia_pagamento = 'Dia de pagamento é obrigatório';
    } else if (formData.dia_pagamento < 1 || formData.dia_pagamento > 31) {
      newErrors.dia_pagamento = 'Dia deve estar entre 1 e 31';
    }

    if (!validateRequired(formData.prazo_repasse_dias)) {
      newErrors.prazo_repasse_dias = 'Prazo de repasse é obrigatório';
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
        <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
        <input
          type="text"
          value={formData.cnpj}
          onChange={(e) => handleChange('cnpj', e.target.value)}
          placeholder="00.000.000/0000-00"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.cnpj ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.cnpj && <p className="mt-1 text-sm text-red-600">{errors.cnpj}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contato</label>
        <input
          type="text"
          value={formData.contato}
          onChange={(e) => handleChange('contato', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dia de Pagamento *</label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.dia_pagamento}
            onChange={(e) => handleChange('dia_pagamento', parseInt(e.target.value))}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.dia_pagamento ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.dia_pagamento && <p className="mt-1 text-sm text-red-600">{errors.dia_pagamento}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prazo Repasse (dias) *</label>
          <input
            type="number"
            min="0"
            value={formData.prazo_repasse_dias}
            onChange={(e) => handleChange('prazo_repasse_dias', parseInt(e.target.value))}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.prazo_repasse_dias ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.prazo_repasse_dias && <p className="mt-1 text-sm text-red-600">{errors.prazo_repasse_dias}</p>}
        </div>
      </div>

      <fieldset className="border border-gray-200 rounded-lg p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">Contrato e pós-venda</legend>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.contrato_assinado}
              onChange={(e) => handleChange('contrato_assinado', e.target.checked)}
              className="w-4 h-4 accent-blue-600"
              disabled={loading}
            />
            Contrato assinado
          </label>
          {formData.contrato_assinado && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              em
              <input
                type="date"
                value={formData.contrato_assinado_em}
                onChange={(e) => handleChange('contrato_assinado_em', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Regras de pagamento</label>
          <textarea
            value={formData.regras_pagamento}
            onChange={(e) => handleChange('regras_pagamento', e.target.value)}
            rows="3"
            placeholder="Ex.: paga comissão no dia 20 via assessoria X; NF até o dia 10; só após a 1ª mensalidade compensada"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pós-venda e acompanhamento</label>
          <textarea
            value={formData.pos_venda}
            onChange={(e) => handleChange('pos_venda', e.target.value)}
            rows="3"
            placeholder="Ex.: gerente responsável, prazo de implantação, envio do boleto da 1ª parcela, canal para dúvidas"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>
        <p className="text-xs text-gray-500">
          Percentuais por parcela, vitalício e estorno ficam em <strong>Tabelas de comissão</strong>, na lista de
          seguradoras.
        </p>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          value={formData.observacoes}
          onChange={(e) => handleChange('observacoes', e.target.value)}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" variant="primary" className="flex-1" loading={loading}>
          {seguradora ? 'Atualizar' : 'Criar'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default SeguradoraForm;