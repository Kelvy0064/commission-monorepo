import React from 'react';
import { Plus, CheckCircle, ArrowRightLeft, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AcoesRapidas = ({ onNovaApolice, onConciliarComissoes, onGerarRepasses }) => {
  const navigate = useNavigate();

  const acoes = [
    {
      icon: Plus,
      title: 'Nova Apólice',
      subtitle: 'Cadastrar nova apólice',
      color: 'blue',
      onClick: () => navigate('/apolices'),
    },
    {
      icon: CheckCircle,
      title: 'Conciliar Comissões',
      subtitle: 'Marcar comissões recebidas',
      color: 'green',
      onClick: () => navigate('/comissoes'),
    },
    {
      icon: ArrowRightLeft,
      title: 'Gerar Repasses',
      subtitle: 'Processar repasses automáticos',
      color: 'orange',
      onClick: onGerarRepasses || (() => navigate('/repasses')),
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-600" />
        Ações Rápidas
      </h3>
      <div className="space-y-3">
        {acoes.map((acao, index) => {
          const Icon = acao.icon;
          const bgColors = {
            blue: 'bg-blue-50 hover:bg-blue-100',
            green: 'bg-green-50 hover:bg-green-100',
            orange: 'bg-orange-50 hover:bg-orange-100',
          };
          const iconColors = {
            blue: 'text-blue-600',
            green: 'text-green-600',
            orange: 'text-orange-600',
          };

          return (
            <button
              key={index}
              onClick={acao.onClick}
              className={`w-full p-4 ${bgColors[acao.color]} rounded-lg text-left transition flex items-center gap-3`}
            >
              <Icon className={`w-5 h-5 ${iconColors[acao.color]}`} />
              <div>
                <div className="font-medium text-gray-800">{acao.title}</div>
                <div className="text-sm text-gray-600">{acao.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AcoesRapidas;