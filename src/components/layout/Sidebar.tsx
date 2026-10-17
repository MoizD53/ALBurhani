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
  Sparkles
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
      sublabel: 'Barcode Scanner Checkout',
      icon: ShoppingBag,
      badge: 'Live',
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Stock & Items',
      sublabel: 'Sweets & Namkeen Catalog',
      icon: Package,
      alertCount: lowStockCount,
    },
    {
      id: 'finance' as ActiveTab,
      label: 'Finance & Sales',
      sublabel: 'Cash, UPI, Expenses',
      icon: DollarSign,
    },
    {
      id: 'barcode-guide' as ActiveTab,
      label: 'Barcode Guide',
      sublabel: 'Hardware & Live Tester',
      icon: Barcode,
    },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      {/* Top Branding (TENS11 Luxury Gold Style) */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl liquid-glass border border-[#D4AF37]/30 bg-black/60 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E5C158] via-[#D4AF37] to-[#8B6914] flex items-center justify-center text-black font-black font-serif text-base shadow-[0_0_15px_rgba(212,175,55,0.35)] shrink-0 select-none">
              AB
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="font-black text-sm tracking-widest uppercase font-serif text-white truncate leading-none">
                  AL-BHURANI
                </h1>
                <p className="text-[10px] tracking-widest text-[#E5C158] uppercase font-semibold mt-1 truncate">
                  Sweets & Dry Items
                </p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-2 ml-2 rounded-xl text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="space-y-1.5">
          {(!isCollapsed || isMobileOpen) && (
            <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-[#D4AF37]/70 px-3 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              Store Management
            </p>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                title={isCollapsed && !isMobileOpen ? `${item.label} — ${item.sublabel}` : undefined}
                className={`w-full flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center p-3' : 'justify-between p-3'
                } rounded-xl text-left transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent border-l-4 border-[#D4AF37] text-white shadow-[0_4px_20px_rgba(212,175,55,0.12)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg transition-all duration-200 shrink-0 ${
                      isActive
                        ? 'bg-[#D4AF37] text-black shadow-[0_0_12px_rgba(212,175,55,0.5)] scale-105'
                        : 'bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>

                  {(!isCollapsed || isMobileOpen) && (
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block leading-tight truncate">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-gray-500 block truncate group-hover:text-gray-400">
                        {item.sublabel}
                      </span>
                    </div>
                  )}
                </div>

                {(!isCollapsed || isMobileOpen) && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {item.badge}
                      </span>
                    )}

                    {item.alertCount !== undefined && item.alertCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        {item.alertCount} low
                      </span>
                    )}
                  </div>
                )}

                {/* Collapsed Alert badge indicator */}
                {isCollapsed && !isMobileOpen && item.alertCount !== undefined && item.alertCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-black animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Area: Turso DB Status + Branch info + Collapse Toggle */}
      <div className="space-y-2.5 pt-4 border-t border-[#D4AF37]/15">
        
        {/* Turso Cloud Sync Card */}
        <button
          onClick={onOpenTursoModal}
          className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
            isTursoConnected
              ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
              : 'bg-[#D4AF37]/10 border-[#D4AF37]/25 hover:border-[#D4AF37]/50'
          }`}
          title="Turso libSQL Cloud Database Settings"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg shrink-0 ${isTursoConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#D4AF37]/20 text-[#D4AF37]'}`}>
              <Database className="w-4 h-4 stroke-[2]" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-[#E5C158] truncate">
                    Turso Database
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isTursoConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
                </div>
                <p className="text-[10px] text-gray-400 truncate">
                  {isTursoConnected ? 'Cloud Sync Active ✓' : 'Setup / Configure'}
                </p>
              </div>
            )}
          </div>
        </button>

        {/* Outlet details */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="p-3 rounded-xl liquid-glass border border-white/5 bg-black/40 text-xs">
            <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-xs">
              <Store className="w-3.5 h-3.5" />
              <span>Branch #01 (Main Counter)</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Station Road • Sweets & Namkeen
            </p>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
              <span>Theme: <strong className="text-[#D4AF37]">TENS11</strong></span>
              <span className="text-emerald-400 font-medium">POS Live</span>
            </div>
          </div>
        )}

        {/* Desktop Collapsible Toggle Button */}
        <div className="hidden lg:flex items-center justify-end">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#D4AF37] border border-white/5 transition-colors flex items-center justify-center gap-2 text-xs"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar to Rail'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-[11px] font-medium text-gray-300">Collapse Rail</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop / Laptop Sidebar (Permanent Rail / Expandable) */}
      <aside
        className={`hidden lg:flex shrink-0 h-screen glass-sidebar flex-col p-4 border-r border-[#D4AF37]/15 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* 3. Mobile Slide-over Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] sm:w-[320px] h-screen glass-sidebar p-4 border-r border-[#D4AF37]/25 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden shadow-[10px_0_40px_rgba(0,0,0,0.9)] ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
