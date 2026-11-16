import React, { useState, useEffect } from 'react';
import Button from '../../common/Button/Button';
import { validateRequired } from '../../../utils/validators';
import { TIPO_SEGURO } from '../../../utils/constants';
import { seguradorasService } from '../../../api/services/seguradoras.service';
import { cronograma, fmtPct, resumoTabela, modalidadeLabel } from '../../../features/seguradoras/comissao';
import { formatCurrency } from '../../../utils/formatters';

const ApoliceForm = ({ 
  apolice, 
  onSubmit, 
  onCancel, 
  loading,
  clientes = [],
  seguradoras = [],
  corretores = [],
  // Pós-venda: só campos operacionais; comissão escondida e campos financeiros bloqueados
  modoOperacional = false,
}) => {
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    seguradora_id: '',
    corretor_responsavel_id: '',
    numero_apolice: '',
    tipo_seguro: TIPO_SEGURO.SAUDE,
    valor_premio_mensal: '',
    percentual_comissao: '',
    data_inicio_vigencia: '',
    data_fim_vigencia: '',
    dia_vencimento: '',
    status: 'ativa',
    observacoes: '',
    ...apolice,
    tabela_comissao_id: apolice?.tabela_comissao_id ?? '',
    // Datas chegam como "AAAA-MM-DDT00:00:00.000Z"; o input date espera "AAAA-MM-DD"
    data_inicio_vigencia: apolice?.data_inicio_vigencia ? String(apolice.data_inicio_vigencia).slice(0, 10) : '',
    data_fim_vigencia: apolice?.data_fim_vigencia ? String(apolice.data_fim_vigencia).slice(0, 10) : '',
    dia_vencimento: apolice?.dia_vencimento ?? '',
    observacoes: apolice?.observacoes ?? '',
  });

  const [errors, setErrors] = useState({});

  // Tabelas de comissão da seguradora escolhida
  const [tabelas, setTabelas] = useState([]);
  useEffect(() => {
    // Pós-venda não vê tabelas de comissão
    if (!formData.seguradora_id || modoOperacional) {
      setTabelas([]);
      return;
    }
    let ativo = true;
    seguradorasService
      .getTabelas(formData.seguradora_id)
      .then((data) => ativo && setTabelas(data))
      .catch(() => ativo && setTabelas([]));
    return () => {
      ativo = false;
    };
  }, [formData.seguradora_id, modoOperacional]);

  // Ativas, mais a atual da apólice mesmo que tenha sido inativada
  const tabelasDisponiveis = tabelas.filter(
    (t) => t.ativa || String(t.id) === String(formData.tabela_comissao_id)
  );
  const tabelaEscolhida = tabelas.find((t) => String(t.id) === String(formData.tabela_comissao_id)) || null;

  // Previsão: parcelas da tabela (ou percentual fixo) e o repasse do corretor na 1ª parcela
  const mensalidade = Number(formData.valor_premio_mensal) || 0;
  const previsao = tabelaEscolhida
    ? cronograma(tabelaEscolhida, mensalidade, 2)
    : formData.percentual_comissao !== '' && mensalidade
      ? [{ parcela: 1, tipo: 'Fixa (todo mês)', percentual: Number(formData.percentual_comissao), valor: (mensalidade * Number(formData.percentual_comissao)) / 100 }]
      : [];
  const corretor = corretores.find((c) => String(c.id) === String(formData.corretor_responsavel_id));
  const repasseCorretor =
    corretor && previsao[0] ? (previsao[0].valor * Number(corretor.percentual_comissao)) / 100 : null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!validateRequired(formData.cliente_id)) {
      newErrors.cliente_id = 'Cliente é obrigatório';
    }

    if (!validateRequired(formData.seguradora_id)) {
      newErrors.seguradora_id = 'Seguradora é obrigatória';
    }

    if (!validateRequired(formData.corretor_responsavel_id)) {
      newErrors.corretor_responsavel_id = 'Corretor é obrigatório';
    }

    if (!validateRequired(formData.numero_apolice)) {
      newErrors.numero_apolice = 'Número da apólice é obrigatório';
    }

    if (!validateRequired(formData.valor_premio_mensal)) {
      newErrors.valor_premio_mensal = 'Valor do prêmio é obrigatório';
    }

    // Sem tabela de comissão, o percentual fixo é obrigatório
    if (!modoOperacional && !formData.tabela_comissao_id && !validateRequired(formData.percentual_comissao)) {
      newErrors.percentual_comissao = 'Informe o percentual ou escolha uma tabela de comissão';
    }

    if (!validateRequired(formData.data_inicio_vigencia)) {
      newErrors.data_inicio_vigencia = 'Data de início é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // CORRIGIDO: Converter valores corretamente
      const dataToSend = {
        ...formData,
        // Converter strings vazias para null e garantir tipos corretos
        cliente_id: parseInt(formData.cliente_id),
        seguradora_id: parseInt(formData.seguradora_id),
        corretor_responsavel_id: parseInt(formData.corretor_responsavel_id),
        valor_premio_mensal: parseFloat(formData.valor_premio_mensal),
        tabela_comissao_id: formData.tabela_comissao_id ? parseInt(formData.tabela_comissao_id) : null,
        percentual_comissao: formData.tabela_comissao_id ? null : parseFloat(formData.percentual_comissao),
        dia_vencimento: formData.dia_vencimento === '' || formData.dia_vencimento === null 
          ? null 
          : parseInt(formData.dia_vencimento),
        data_fim_vigencia: formData.data_fim_vigencia || null,
      };
      
      onSubmit(dataToSend);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
          <select
            value={formData.cliente_id}
            onChange={(e) => {
              const clienteId = e.target.value;
              handleChange('cliente_id', clienteId);
              // Sugere o corretor do cliente se ainda não houver corretor escolhido
              const cliente = clientes.find((c) => String(c.id) === clienteId);
              if (cliente?.corretor_id && !formData.corretor_responsavel_id) {
                handleChange('corretor_responsavel_id', String(cliente.corretor_id));
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.cliente_id ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading || modoOperacional}
          >
            <option value="">Selecione...</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          {errors.cliente_id && <p className="mt-1 text-sm text-red-600">{errors.cliente_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seguradora *</label>
          <select
            value={formData.seguradora_id}
            onChange={(e) => {
              handleChange('seguradora_id', e.target.value);
              handleChange('tabela_comissao_id', ''); // tabela pertence à seguradora anterior
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.seguradora_id ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading || modoOperacional}
          >
            <option value="">Selecione...</option>
            {seguradoras.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          {errors.seguradora_id && <p className="mt-1 text-sm text-red-600">{errors.seguradora_id}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Corretor Responsável *</label>
        <select
          value={formData.corretor_responsavel_id}
          onChange={(e) => handleChange('corretor_responsavel_id', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.corretor_responsavel_id ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading || modoOperacional}
        >
          <option value="">Selecione...</option>
          {corretores.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        {errors.corretor_responsavel_id && <p className="mt-1 text-sm text-red-600">{errors.corretor_responsavel_id}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número da Apólice *</label>
          <input
            type="text"
            value={formData.numero_apolice}
            onChange={(e) => handleChange('numero_apolice', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.numero_apolice ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.numero_apolice && <p className="mt-1 text-sm text-red-600">{errors.numero_apolice}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Seguro *</label>
          <select
            value={formData.tipo_seguro}
            onChange={(e) => handleChange('tipo_seguro', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={loading || modoOperacional}
          >
            <option value={TIPO_SEGURO.SAUDE}>Saúde</option>
            <option value={TIPO_SEGURO.VIDA}>Vida</option>
            <option value={TIPO_SEGURO.DENTAL}>Dental</option>
            <option value={TIPO_SEGURO.OUTROS}>Outros</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor Prêmio Mensal (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.valor_premio_mensal}
            onChange={(e) => handleChange('valor_premio_mensal', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.valor_premio_mensal ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading || modoOperacional}
          />
          {errors.valor_premio_mensal && <p className="mt-1 text-sm text-red-600">{errors.valor_premio_mensal}</p>}
        </div>

        <div className={modoOperacional ? 'hidden' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Regra de comissão *</label>
          <select
            value={formData.tabela_comissao_id}
            onChange={(e) => handleChange('tabela_comissao_id', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={loading || !formData.seguradora_id}
          >
            <option value="">Percentual fixo (todo mês)</option>
            {tabelasDisponiveis.map((t) => (
              <option key={t.id} value={t.id}>
                Tabela: {t.nome} ({modalidadeLabel(t.modalidade)}){t.ativa ? '' : ' — inativa'}
              </option>
            ))}
          </select>
          {formData.seguradora_id && tabelas.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">Esta seguradora ainda não tem tabelas de comissão.</p>
          )}
        </div>
      </div>

      {!modoOperacional && !formData.tabela_comissao_id && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comissão fixa (%) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.percentual_comissao ?? ''}
              onChange={(e) => handleChange('percentual_comissao', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.percentual_comissao ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.percentual_comissao && <p className="mt-1 text-sm text-red-600">{errors.percentual_comissao}</p>}
          </div>
        </div>
      )}

      {!modoOperacional && tabelaEscolhida && <p className="text-sm text-gray-700">{resumoTabela(tabelaEscolhida)}</p>}

      {modoOperacional && (
        <p className="text-xs text-gray-500">
          Você pode alterar número, status, vigência, vencimento e observações. Cliente, seguradora, corretor, valor e
          comissão são alterados pela gestão.
        </p>
      )}

      {!modoOperacional && previsao.length > 0 && mensalidade > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          <div className="font-semibold mb-2">Previsão de comissão</div>
          <ul className="space-y-1">
            {previsao.map((l) => (
              <li key={l.parcela} className="flex justify-between gap-2">
                <span>
                  {l.parcela}ª parcela — {l.tipo} {fmtPct(l.percentual)}
                </span>
                <span className="font-medium">{formatCurrency(l.valor)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-blue-200">
            {corretor ? (
              <span>
                Repasse a {corretor.nome}: <strong>{formatCurrency(repasseCorretor)}</strong> ({fmtPct(corretor.percentual_comissao)}{' '}
                da 1ª parcela, sobre o valor efetivamente recebido). As demais parcelas ficam com a corretora.
              </span>
            ) : (
              <span>O corretor recebe repasse apenas da 1ª parcela.</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Início Vigência *</label>
          <input
            type="date"
            value={formData.data_inicio_vigencia}
            onChange={(e) => handleChange('data_inicio_vigencia', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.data_inicio_vigencia ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.data_inicio_vigencia && <p className="mt-1 text-sm text-red-600">{errors.data_inicio_vigencia}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim Vigência</label>
          <input
            type="date"
            value={formData.data_fim_vigencia}
            onChange={(e) => handleChange('data_fim_vigencia', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dia de Vencimento (opcional)</label>
        <input
          type="number"
          min="1"
          max="31"
          value={formData.dia_vencimento}
          onChange={(e) => handleChange('dia_vencimento', e.target.value)}
          placeholder="1 a 31"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">Deixe em branco se não aplicável</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          value={formData.observacoes}
          onChange={(e) => handleChange('observacoes', e.target.value)}
          rows="2"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" variant="primary" className="flex-1" loading={loading}>
          {apolice ? 'Atualizar' : 'Criar'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default ApoliceForm;