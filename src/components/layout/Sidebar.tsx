import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  FileText, 
  ReceiptText, 
  Package, 
  TrendingDown, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ShieldCheck, 
  AlertTriangle,
  Tag
} from 'lucide-react';
import { UserProfile } from '../../types';
import { InstallPwaButton } from '../common/InstallPwaButton';

export type ActiveTab = 
  | 'overview' 
  | 'pos' 
  | 'customer-bills' 
  | 'no-bill-sales' 
  | 'inventory' 
  | 'label-studio'
  | 'expenses' 
  | 'reports' 
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  lowStockCount: number;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  currentUser: UserProfile;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  lowStockCount,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  currentUser,
}) => {
  const navItems = [
    {
      id: 'overview' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'pos' as ActiveTab,
      label: 'POS Billing',
      icon: ShoppingBag,
    },
    {
      id: 'customer-bills' as ActiveTab,
      label: 'Customer Bills',
      icon: FileText,
    },
    {
      id: 'no-bill-sales' as ActiveTab,
      label: 'No-Bill Sales',
      icon: ReceiptText,
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Inventory',
      icon: Package,
      alertCount: lowStockCount,
    },
    ...(currentUser.role === 'Owner'
      ? [
          {
            id: 'label-studio' as ActiveTab,
            label: 'Label Studio',
            icon: Tag,
          },
        ]
      : []),
    {
      id: 'expenses' as ActiveTab,
      label: 'Expenses',
      icon: TrendingDown,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Reports & Export',
      icon: BarChart3,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      icon: Settings,
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
    <div className="flex flex-col h-full select-none justify-between">
      
      {/* Top Section: Brand & Nav Items */}
      <div className="flex flex-col min-h-0">
        
        {/* Brand Header */}
        <div className={`mb-4 shrink-0 ${showLabels ? 'px-1' : 'flex justify-center'}`}>
          {showLabels ? (
            <div className="p-2.5 rounded-xl bg-[#121214] border border-[#D4AF37]/25 flex items-center justify-between shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-black border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-serif font-black text-xs shadow-[0_0_10px_rgba(212,175,55,0.25)] shrink-0">
                  AB
                </div>
                <div className="min-w-0">
                  <h1 className="font-extrabold text-xs tracking-[0.16em] uppercase font-serif text-white leading-none truncate">
                    AL-BHURANI
                  </h1>
                  <p className="text-[9px] tracking-[0.18em] text-[#C5A85A] uppercase font-semibold mt-1 truncate">
                    Sweets & Dry Items
                  </p>
                </div>
              </div>
              
              {isMobileOpen && (
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="lg:hidden p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div 
              title="AL-BHURANI Sweets & Dry Items"
              className="w-10 h-10 rounded-xl bg-[#121214] border border-[#D4AF37]/35 flex items-center justify-center text-[#D4AF37] font-serif font-black text-sm shadow-[0_0_12px_rgba(212,175,55,0.2)] cursor-pointer"
              onClick={() => setIsCollapsed(false)}
            >
              AB
            </div>
          )}
        </div>

        {/* Section Label */}
        {showLabels && (
          <div className="text-[10px] font-bold tracking-[0.22em] text-[#C5A85A]/75 uppercase px-3 py-1.5">
            NAVIGATION
          </div>
        )}

        {/* Nav items list */}
        <nav className="space-y-1 overflow-y-auto no-scrollbar pr-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                title={!showLabels ? item.label : undefined}
                className={`w-full flex items-center ${
                  showLabels ? 'px-3 py-2.5 justify-between' : 'p-2.5 justify-center'
                } rounded-xl text-left transition-all duration-150 group relative ${
                  isActive
                    ? 'border border-[#D4AF37]/45 bg-[#181611] text-white font-semibold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`shrink-0 transition-colors ${
                    isActive ? 'text-[#E7C75A]' : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}>
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>

                  {showLabels && (
                    <span className={`text-xs block truncate ${
                      isActive ? 'text-white font-semibold' : 'text-[#A1A1AA] group-hover:text-white'
                    }`}>
                      {item.label}
                    </span>
                  )}
                </div>

                {/* Badges */}
                {showLabels && item.alertCount !== undefined && item.alertCount > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center gap-0.5 shrink-0 ml-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {item.alertCount}
                  </span>
                )}

                {/* Collapsed dot */}
                {!showLabels && isActive && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-[#D4AF37]" />
                )}
                {!showLabels && item.alertCount !== undefined && item.alertCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Install App, User Profile & Collapse */}
      <div className="pt-3 border-t border-white/[0.06] shrink-0 space-y-2">
        
        {/* Install App Button when expanded */}
        {showLabels && (
          <InstallPwaButton variant="sidebar" />
        )}

        {/* User Profile Card */}
        {showLabels ? (
          <div className="p-2.5 rounded-xl bg-[#121214] border border-white/[0.08] flex items-center gap-2.5 min-w-0 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 flex items-center justify-center text-[#D4AF37] font-bold text-xs shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white block truncate leading-none">
                AL-BHURANI
              </span>
              <span className="text-[10px] text-[#C5A85A] block truncate font-semibold uppercase tracking-wider mt-1">
                Owner · Main Store
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-0.5">
            <div 
              title="AL-BHURANI · Owner"
              className="w-8 h-8 rounded-full bg-[#121214] border border-[#D4AF37]/35 flex items-center justify-center text-[#D4AF37]"
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Desktop Sidebar Collapse Toggle */}
        <div className="hidden lg:block pt-0.5">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`w-full py-1.5 ${showLabels ? 'px-2.5 justify-start gap-2' : 'px-0 justify-center'} rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-colors flex items-center text-xs font-medium`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#D4AF37]" />
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                <span className="text-[11px] text-zinc-400">Collapse</span>
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
        className={`hidden lg:flex shrink-0 h-screen flex-col py-4 border-r border-white/[0.06] transition-all duration-200 ease-in-out overflow-hidden bg-[#0B0B0D] ${
          isCollapsed ? 'w-[72px] px-2' : 'w-[230px] px-3'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] h-screen py-4 px-3 bg-[#0B0B0D] border-r border-white/[0.08] flex flex-col transform transition-transform duration-200 ease-in-out lg:hidden shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
