import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, Building2, FileText, DollarSign, ArrowRightLeft } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/corretores', icon: Users, label: 'Corretores' },
    { path: '/seguradoras', icon: Building2, label: 'Seguradoras' },
    { path: '/clientes', icon: Users, label: 'Clientes' },
    { path: '/apolices', icon: FileText, label: 'Apólices' },
    { path: '/comissoes', icon: DollarSign, label: 'Comissões' },
    { path: '/repasses', icon: ArrowRightLeft, label: 'Repasses' },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-2xl">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">ComissõesPro</h1>
        <p className="text-blue-200 text-sm">Controle Total</p>
      </div>
      
      <nav className="mt-8">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-6 py-4 transition ${
                  isActive
                    ? 'bg-blue-700 border-l-4 border-white'
                    : 'hover:bg-blue-700'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
