import React from 'react';
import { 
  ShoppingBag, 
  Package, 
  DollarSign, 
  Barcode, 
  Store, 
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Wifi
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
  isTursoConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  lowStockCount,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  isTursoConnected = false
}) => {
  const navItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'POS Billing',
      sublabel: 'Scan & rapid checkout',
      icon: ShoppingBag,
      badge: 'Live',
      alertCount: undefined,
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Stock & Items',
      sublabel: 'Catalog & barcode labels',
      icon: Package,
      badge: undefined,
      alertCount: lowStockCount,
    },
    {
      id: 'finance' as ActiveTab,
      label: 'Finance & Sales',
      sublabel: 'Daily cash, UPI, records',
      icon: DollarSign,
      badge: undefined,
      alertCount: undefined,
    },
    {
      id: 'barcode-guide' as ActiveTab,
      label: 'Barcode Guide',
      sublabel: 'Hardware & live tester',
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
    <div className="flex flex-col h-full select-none">

      {/* Brand Header */}
      <div className={`flex items-center gap-3 mb-6 shrink-0 ${showLabels ? '' : 'justify-center'}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E5C158] via-[#D4AF37] to-[#8B6914] flex items-center justify-center text-black font-black font-serif text-sm shadow-[0_0_12px_rgba(212,175,55,0.25)] shrink-0">
          AB
        </div>
        {showLabels && (
          <div className="min-w-0 flex-1">
            <h1 className="font-extrabold text-sm tracking-widest uppercase font-serif text-white leading-none truncate">
              AL-BHURANI
            </h1>
            <p className="text-[10px] tracking-wider text-[#D4AF37]/80 uppercase font-medium mt-1 truncate">
              Sweets & Dry Items
            </p>
          </div>
        )}
        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 ml-auto rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav section header */}
      {showLabels && (
        <div className="text-[10px] uppercase font-bold tracking-[0.16em] text-gray-500 px-2 mb-2">
          Navigation
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 space-y-1 min-h-0 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              title={!showLabels ? `${item.label} — ${item.sublabel}` : undefined}
              className={`w-full flex items-center ${
                showLabels ? 'px-3 py-2.5 justify-between' : 'p-3 justify-center'
              } rounded-xl text-left transition-all duration-150 group relative ${
                isActive
                  ? 'bg-[#D4AF37]/12 text-white font-medium border-l-2 border-[#D4AF37]'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 transition-colors ${
                  isActive ? 'text-[#D4AF37]' : 'text-gray-500 group-hover:text-gray-300'
                }`}>
                  <Icon className="w-4 h-4 stroke-[2]" />
                </div>

                {showLabels && (
                  <div className="min-w-0 text-left">
                    <span className={`text-[13px] block leading-snug truncate ${
                      isActive ? 'text-white font-semibold' : 'text-gray-300 group-hover:text-white'
                    }`}>
                      {item.label}
                    </span>
                    <span className="text-[11px] text-gray-500 block truncate group-hover:text-gray-400">
                      {item.sublabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Badges when expanded */}
              {showLabels && (
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.badge && isActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {item.badge}
                    </span>
                  )}
                  {item.alertCount !== undefined && item.alertCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {item.alertCount}
                    </span>
                  )}
                </div>
              )}

              {/* Collapsed dot badge for alerts */}
              {!showLabels && item.alertCount !== undefined && item.alertCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: Compact branch & database status controls */}
      <div className="pt-3 border-t border-white/[0.08] space-y-2 shrink-0">
        
        {/* Branch & Database Status Box */}
        {showLabels ? (
          <div className="px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.05]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Store className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Branch #01</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${isTursoConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`font-medium ${isTursoConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isTursoConnected ? 'Cloud Sync' : 'Local'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5 truncate pl-5">
              Station Road · Counter 01
            </p>
          </div>
        ) : (
          <div 
            className="flex justify-center py-1 text-gray-500" 
            title={`Branch #01 · ${isTursoConnected ? 'Cloud Sync Active' : 'Local Storage Mode'}`}
          >
            <div className="relative">
              <Store className="w-4 h-4 text-gray-400" />
              <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                isTursoConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
            </div>
          </div>
        )}

        {/* Collapse toggle button (desktop only) */}
        <div className="hidden lg:block">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`w-full py-2 ${showLabels ? 'px-3 justify-start gap-2' : 'px-0 justify-center'} rounded-xl text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors flex items-center text-xs font-medium`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0 text-[#D4AF37]" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">Collapse Sidebar</span>
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
        className={`hidden lg:flex shrink-0 h-screen flex-col py-4 border-r border-white/[0.08] transition-all duration-200 ease-in-out overflow-hidden bg-[#090909] ${
          isCollapsed ? 'w-[72px] px-2.5' : 'w-[240px] px-3.5'
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
        className={`fixed inset-y-0 left-0 z-50 w-[260px] h-screen py-4 px-4 bg-[#090909] border-r border-white/[0.08] flex flex-col transform transition-transform duration-200 ease-in-out lg:hidden shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
