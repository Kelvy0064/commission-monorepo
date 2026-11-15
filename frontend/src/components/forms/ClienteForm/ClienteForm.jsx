import React, { useState, useEffect } from 'react';
import Button from '../../common/Button/Button';
import { validateRequired, validateEmail } from '../../../utils/validators';
import { STATUS } from '../../../utils/constants';
import { maskTelefone } from '../../../utils/formatters';
import { corretoresService } from '../../../api/services/corretores.service';

const TEXT_FIELDS = [
  'nome', 'cpf_cnpj', 'email', 'endereco',
  'plano_atual', 'custo_plano_atual', 'investimento_pretendido', 'hospitais_preferidos',
];

const inputClass = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

const ClienteForm = ({ cliente, onSubmit, onCancel, loading }) => {
  const [corretores, setCorretores] = useState([]);

  // Busca a lista sempre que o formulário abre, para incluir corretores recém-cadastrados
  useEffect(() => {
    corretoresService
      .getAll()
      .then(setCorretores)
      .catch(() => setCorretores([]));
  }, []);

  // Corretores ativos, mais o corretor atual do cliente mesmo que esteja inativo
  const corretoresDisponiveis = corretores.filter(
    (c) => c.status === STATUS.ATIVO || c.id === cliente?.corretor_id
  );

  const [formData, setFormData] = useState({
    nome: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    status: STATUS.ATIVO,
    ...cliente,
    // Campos que podem vir null do banco viram '' para os inputs controlados
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, cliente?.[f] ?? ''])),
    telefone: maskTelefone(cliente?.telefone),
    idades: cliente?.idades || [],
    corretor_id: cliente?.corretor_id ?? '',
    possui_plano: cliente?.possui_plano == null ? '' : String(cliente.possui_plano),
  });

  const [errors, setErrors] = useState({});
  const [idadeInput, setIdadeInput] = useState('');

  const addIdade = () => {
    if (idadeInput === '') return;
    const idade = Number(idadeInput);
    if (!Number.isInteger(idade) || idade < 0 || idade > 130) {
      setErrors(prev => ({ ...prev, idades: 'Informe uma idade entre 0 e 130' }));
      return;
    }
    handleChange('idades', [...formData.idades, idade]);
    setIdadeInput('');
  };

  const removeIdade = (index) => {
    handleChange('idades', formData.idades.filter((_, i) => i !== index));
  };

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

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        ...formData,
        corretor_id: formData.corretor_id === '' ? null : Number(formData.corretor_id),
        possui_plano: formData.possui_plano === '' ? null : formData.possui_plano === 'true',
      });
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
        <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Corretor</label>
        <select
          value={formData.corretor_id}
          onChange={(e) => handleChange('corretor_id', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Sem corretor</option>
          {corretoresDisponiveis.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}{c.status !== STATUS.ATIVO ? ' (inativo)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Idades do contrato</label>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="130"
            step="1"
            value={idadeInput}
            onChange={(e) => {
              setIdadeInput(e.target.value);
              if (errors.idades) setErrors(prev => ({ ...prev, idades: null }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addIdade();
              }
            }}
            placeholder="Digite a idade e pressione Enter"
            className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.idades ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          <Button type="button" variant="secondary" onClick={addIdade} disabled={loading || idadeInput === ''}>
            Adicionar
          </Button>
        </div>
        {errors.idades && <p className="mt-1 text-sm text-red-600">{errors.idades}</p>}
        {formData.idades.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.idades.map((idade, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm"
              >
                {idade} {idade === 1 ? 'ano' : 'anos'}
                <button
                  type="button"
                  onClick={() => removeIdade(index)}
                  className="ml-1 text-blue-500 hover:text-blue-800 font-bold leading-none"
                  aria-label={`Remover idade ${idade}`}
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
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

      <fieldset className="border border-gray-200 rounded-lg p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">Informações do lead</legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Possui plano atualmente?</label>
            <select
              value={formData.possui_plano}
              onChange={(e) => handleChange('possui_plano', e.target.value)}
              className={inputClass}
              disabled={loading}
            >
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano atual</label>
            <input
              type="text"
              value={formData.plano_atual}
              onChange={(e) => handleChange('plano_atual', e.target.value)}
              placeholder="Ex.: Unimed"
              className={inputClass}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custo do plano atual</label>
            <input
              type="text"
              value={formData.custo_plano_atual}
              onChange={(e) => handleChange('custo_plano_atual', e.target.value)}
              placeholder="Ex.: Até R$ 1.500"
              className={inputClass}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Investimento pretendido</label>
            <input
              type="text"
              value={formData.investimento_pretendido}
              onChange={(e) => handleChange('investimento_pretendido', e.target.value)}
              placeholder="Ex.: A partir de R$ 697"
              className={inputClass}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hospitais/laboratórios preferidos</label>
          <textarea
            value={formData.hospitais_preferidos}
            onChange={(e) => handleChange('hospitais_preferidos', e.target.value)}
            rows="2"
            className={inputClass}
            disabled={loading}
          />
        </div>

        {cliente?.utm_source && (
          <p className="text-xs text-gray-500">
            Origem: {[cliente.utm_source, cliente.utm_campaign, cliente.utm_content].filter(Boolean).join(' · ')}
          </p>
        )}
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
        <select
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value={STATUS.LEAD}>Lead</option>
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