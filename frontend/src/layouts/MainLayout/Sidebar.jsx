import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Users, Building2, FileText, DollarSign, ArrowRightLeft, LogOut, KanbanSquare, UserCog, Briefcase, ShieldAlert, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PERFIS } from '../../auth/permissoes';

// Menu completo; cada item só aparece para quem tem a permissão da página
const MENU = [
  { path: '/dashboard', icon: Home, label: 'Dashboard', permissao: 'dashboard.ver' },
  { path: '/negociacoes', icon: KanbanSquare, label: 'Negociações', permissao: 'negociacoes.ver' },
  { path: '/clientes', icon: Users, label: 'Clientes', permissao: 'clientes.ver' },
  { path: '/apolices', icon: FileText, label: 'Apólices', permissao: 'apolices.ver' },
  { path: '/monitoramento', icon: ShieldAlert, label: 'Monitoramento', permissao: 'monitoramento.ver' },
  { path: '/corretores', icon: Briefcase, label: 'Corretores', permissao: 'corretores.ver' },
  { path: '/seguradoras', icon: Building2, label: 'Seguradoras', permissao: 'seguradoras.ver' },
  { path: '/comissoes', icon: DollarSign, label: 'Comissões', permissao: 'comissoes.ver' },
  { path: '/repasses', icon: ArrowRightLeft, label: 'Repasses', permissao: 'repasses.ver' },
  { path: '/estornos', icon: RotateCcw, label: 'Estornos', permissao: 'estornos.ver' },
  { path: '/usuarios', icon: UserCog, label: 'Usuários', permissao: 'usuarios.gerenciar' },
];

const Sidebar = () => {
  const { user, logout, pode } = useAuth();

  return (
    <div className="fixed left-0 top-0 h-full w-64 flex flex-col bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-2xl">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-1">ComissõesPro</h1>
        <p className="text-blue-200 text-sm truncate">{user?.empresa?.nome}</p>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {MENU.filter((item) => pode(item.permissao)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-6 py-3 transition ${
                  isActive ? 'bg-blue-700 border-l-4 border-white' : 'hover:bg-blue-700'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-6 border-t border-blue-700">
        <p className="text-sm font-medium truncate">{user?.nome}</p>
        <p className="text-xs text-blue-200 truncate">{user?.email}</p>
        <p className="text-xs text-blue-300 mb-3">{PERFIS[user?.role]}</p>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
