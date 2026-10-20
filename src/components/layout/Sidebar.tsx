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
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white border border-[#C99A18]/50 flex items-center justify-center overflow-hidden shadow-[0_0_8px_rgba(201,154,24,0.2)] shrink-0">
                  <img src="/logo.png" alt="Al Burhani" className="w-full h-full object-contain rounded-full" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-extrabold text-xs tracking-[0.16em] uppercase font-serif text-[#1C1917] leading-none truncate">
                    AL-BHURANI
                  </h1>
                  <p className="text-[9px] tracking-[0.18em] text-[#A67D0C] uppercase font-bold mt-1 truncate">
                    Sweets & Dry Items
                  </p>
                </div>
              </div>
              
              {isMobileOpen && (
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="lg:hidden p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div 
              title="AL-BHURANI Sweets & Dry Items"
              className="w-10 h-10 rounded-full bg-white border border-[#C99A18]/50 flex items-center justify-center overflow-hidden shadow-[0_0_10px_rgba(201,154,24,0.25)] cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsCollapsed(false)}
            >
              <img src="/logo.png" alt="Al Burhani" className="w-full h-full object-contain rounded-full" />
            </div>
          )}
        </div>

        {/* Section Label */}
        {showLabels && (
          <div className="text-[10px] font-bold tracking-[0.22em] text-[#A67D0C] uppercase px-3 py-1.5">
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
                    ? 'border border-[#C99A18] bg-[#FBF7EE] text-[#1C1917] font-bold shadow-sm'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-transparent font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`shrink-0 transition-colors ${
                    isActive ? 'text-[#B8860B]' : 'text-stone-400 group-hover:text-stone-700'
                  }`}>
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>

                  {showLabels && (
                    <span className={`text-xs block truncate ${
                      isActive ? 'text-[#1C1917] font-bold' : 'text-stone-600 group-hover:text-stone-900'
                    }`}>
                      {item.label}
                    </span>
                  )}
                </div>

                {/* Badges */}
                {showLabels && item.alertCount !== undefined && item.alertCount > 0 && (
                  <span 
                    title={`${item.alertCount} products at or below minimum stock alert`}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/25 flex items-center gap-0.5 shrink-0 ml-1"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {item.alertCount}
                  </span>
                )}

                {/* Collapsed dot */}
                {!showLabels && isActive && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-[#C99A18]" />
                )}
                {!showLabels && item.alertCount !== undefined && item.alertCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Install App, User Profile & Collapse */}
      <div className="pt-3 border-t border-[#F0EBE0] shrink-0 space-y-2">
        
        {/* Install App Button when expanded */}
        {showLabels && (
          <InstallPwaButton variant="sidebar" />
        )}

        {/* User Profile Card */}
        {showLabels ? (
          <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center gap-2.5 min-w-0 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[#C99A18]/15 border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18] font-bold text-xs shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-[#1C1917] block truncate leading-none">
                AL-BHURANI
              </span>
              <span className="text-[10px] text-[#A67D0C] block truncate font-semibold uppercase tracking-wider mt-1">
                Owner · Main Store
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-0.5">
            <div 
              title="AL-BHURANI · Owner"
              className="w-8 h-8 rounded-full bg-[#FAF8F5] border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18]"
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Desktop Sidebar Collapse Toggle */}
        <div className="hidden lg:block pt-0.5">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`w-full py-1.5 ${showLabels ? 'px-2.5 justify-start gap-2' : 'px-0 justify-center'} rounded-lg text-stone-500 hover:text-stone-800 hover:bg-[#FAF8F5] transition-colors flex items-center text-xs font-medium`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#C99A18]" />
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-stone-500" />
                <span className="text-[11px] text-stone-600">Collapse</span>
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
        className={`hidden lg:flex shrink-0 h-screen flex-col py-4 border-r border-[#E8DEC8] transition-all duration-200 ease-in-out overflow-hidden bg-white shadow-sm ${
          isCollapsed ? 'w-[72px] px-2' : 'w-[230px] px-3'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer (iPhone safe-area & dynamic viewport aware) */}
      <aside
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        }}
        className={`fixed inset-y-0 left-0 z-50 w-[260px] h-screen h-[100dvh] px-3 bg-white border-r border-[#E8DEC8] flex flex-col transform transition-transform duration-200 ease-in-out lg:hidden shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
