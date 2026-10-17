import React from 'react';
import { 
  ShoppingBag, 
  Package, 
  DollarSign, 
  Barcode, 
  Store, 
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  AlertTriangle
} from 'lucide-react';

export type ActiveTab = 'pos' | 'inventory' | 'finance' | 'barcode-guide';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  lowStockCount: number;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onOpenTursoModal: () => void;
  isTursoConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  lowStockCount,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  onOpenTursoModal,
  isTursoConnected
}) => {
  const navItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'POS Billing',
      sublabel: 'Scan & checkout',
      icon: ShoppingBag,
      badge: 'Live' as string | undefined,
      alertCount: undefined as number | undefined,
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Stock & Items',
      sublabel: 'Catalog management',
      icon: Package,
      badge: undefined,
      alertCount: lowStockCount,
    },
    {
      id: 'finance' as ActiveTab,
      label: 'Finance & Sales',
      sublabel: 'Cash, UPI, expenses',
      icon: DollarSign,
      badge: undefined,
      alertCount: undefined,
    },
    {
      id: 'barcode-guide' as ActiveTab,
      label: 'Barcode Guide',
      sublabel: 'Hardware & tester',
      icon: Barcode,
      badge: undefined,
      alertCount: undefined,
    },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const showLabels = !isCollapsed || isMobileOpen;

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Branding */}
      <div className={`flex items-center gap-3 mb-6 shrink-0 ${showLabels ? '' : 'justify-center'}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E5C158] via-[#D4AF37] to-[#8B6914] flex items-center justify-center text-black font-black font-serif text-sm shadow-[0_0_14px_rgba(212,175,55,0.3)] shrink-0 select-none">
          AB
        </div>
        {showLabels && (
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-sm tracking-widest uppercase font-serif text-white leading-none truncate">
              AL-BHURANI
            </h1>
            <p className="text-[10px] tracking-wider text-[#D4AF37]/70 uppercase font-medium mt-0.5 truncate">
              Sweets & Dry Items
            </p>
          </div>
        )}
        {/* Mobile close */}
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 ml-auto rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav section label */}
      {showLabels && (
        <p className="text-[9px] uppercase font-bold tracking-[0.18em] text-gray-600 px-1 mb-2">
          Store Management
        </p>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 min-h-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              title={!showLabels ? `${item.label}` : undefined}
              className={`w-full flex items-center ${
                showLabels ? 'px-3 py-2.5 justify-between' : 'p-3 justify-center'
              } rounded-xl text-left transition-all duration-150 group relative ${
                isActive
                  ? 'bg-[#D4AF37]/10 text-white'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Icon */}
                <div className={`shrink-0 transition-colors ${
                  isActive ? 'text-[#D4AF37]' : 'text-gray-600 group-hover:text-gray-300'
                }`}>
                  <Icon className="w-4 h-4 stroke-[1.75]" />
                </div>

                {/* Label + sublabel */}
                {showLabels && (
                  <div className="min-w-0">
                    <span className={`text-[13px] font-medium block leading-tight truncate ${isActive ? 'text-white' : ''}`}>
                      {item.label}
                    </span>
                    <span className="text-[11px] text-gray-600 block truncate group-hover:text-gray-500">
                      {item.sublabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Right badges (expanded only) */}
              {showLabels && (
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.badge && isActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                      {item.badge}
                    </span>
                  )}
                  {item.alertCount !== undefined && item.alertCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {item.alertCount}
                    </span>
                  )}
                </div>
              )}

              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-[#D4AF37]" />
              )}

              {/* Collapsed dot indicator */}
              {!showLabels && item.alertCount !== undefined && item.alertCount > 0 && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`pt-4 border-t border-white/[0.06] space-y-2 shrink-0`}>
        
        {/* DB status button */}
        <button
          onClick={onOpenTursoModal}
          className={`w-full ${showLabels ? 'flex items-center gap-2.5 px-3 py-2' : 'flex justify-center p-2.5'} rounded-xl transition-colors group hover:bg-white/[0.04]`}
          title="Database settings"
        >
          <div className={`shrink-0 ${isTursoConnected ? 'text-emerald-500' : 'text-amber-500'}`}>
            <Database className="w-4 h-4 stroke-[1.75]" />
          </div>
          {showLabels && (
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-gray-400 group-hover:text-white truncate">
                  Turso Database
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-2 ${
                  isTursoConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`} />
              </div>
              <p className="text-[11px] text-gray-600 truncate">
                {isTursoConnected ? 'Cloud sync active' : 'Click to configure'}
              </p>
            </div>
          )}
        </button>

        {/* Branch info (expanded only) */}
        {showLabels && (
          <div className="px-3 py-2 rounded-xl">
            <div className="flex items-center gap-2 text-gray-600">
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] truncate">Branch #01 · Main Counter</span>
            </div>
            <p className="text-[10px] text-gray-700 mt-0.5 pl-5 truncate">
              Station Road · Sweets & Namkeen
            </p>
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:block">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`w-full py-2 ${showLabels ? 'px-3 justify-start gap-2' : 'px-0 justify-center'} rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition-colors flex items-center text-xs`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 h-screen flex-col py-5 border-r border-white/[0.06] transition-all duration-300 ease-in-out overflow-hidden bg-[#080808] ${
          isCollapsed ? 'w-[68px] px-3' : 'w-[240px] px-4'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] h-screen py-5 px-4 bg-[#080808] border-r border-white/[0.08] flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
