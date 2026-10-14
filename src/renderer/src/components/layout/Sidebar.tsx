import React from 'react';
import {
  LayoutDashboard,
  Package,
  Database,
  ShoppingCart,
  BarChart3,
  ShoppingBag,
  Truck,
  Sparkles,
  FileText,
  HardDrive,
  Settings,
  Store,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { BusinessSettings } from '../../../../shared/types';

export type NavScreen =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'sales'
  | 'analytics'
  | 'restock'
  | 'suppliers'
  | 'ai'
  | 'reports'
  | 'backup'
  | 'settings';

interface SidebarProps {
  currentScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  settings: BusinessSettings | null;
  reorderAlertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  settings,
  reorderAlertCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard' as NavScreen, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products' as NavScreen, label: 'Products', icon: Package },
    { id: 'inventory' as NavScreen, label: 'Inventory', icon: Database },
    { id: 'sales' as NavScreen, label: 'Sales', icon: ShoppingCart },
    { id: 'analytics' as NavScreen, label: 'Analytics', icon: BarChart3 },
    {
      id: 'restock' as NavScreen,
      label: 'Restock Planner',
      icon: ShoppingBag,
      badge: reorderAlertCount > 0 ? reorderAlertCount : undefined,
    },
    { id: 'suppliers' as NavScreen, label: 'Suppliers', icon: Truck },
    { id: 'ai' as NavScreen, label: 'AI Assistant', icon: Sparkles },
    { id: 'reports' as NavScreen, label: 'Reports', icon: FileText },
    { id: 'backup' as NavScreen, label: 'Backup & Restore', icon: HardDrive },
    { id: 'settings' as NavScreen, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0B132B] flex flex-col justify-between h-screen select-none shrink-0 border-r border-slate-800 text-slate-300">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight flex items-center gap-1.5">
              SellerPilot <span className="text-blue-400 font-semibold text-sm">AI</span>
            </h1>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                      isActive
                        ? 'bg-white text-blue-700'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Store Profile Indicator */}
      <div className="p-3 border-t border-slate-800/80">
        <button
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Store className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {settings?.businessName || 'Business Store'}
              </div>
              <div className="text-[10px] text-slate-400">
                {settings?.demoMode ? 'Demo Store' : 'Active Account'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </button>
      </div>
    </aside>
  );
};
