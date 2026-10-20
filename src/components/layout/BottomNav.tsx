import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  FileText, 
  Package, 
  Menu,
  AlertTriangle
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMobileMenu: () => void;
  lowStockCount?: number;
  totalCartCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  lowStockCount = 0,
  totalCartCount = 0,
}) => {
  const tabs = [
    {
      id: 'overview' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'pos' as ActiveTab,
      label: 'POS',
      icon: ShoppingBag,
      badge: totalCartCount > 0 ? totalCartCount : undefined,
      badgeColor: 'bg-[#C99A18] text-white',
    },
    {
      id: 'customer-bills' as ActiveTab,
      label: 'Bills',
      icon: FileText,
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Stock',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
      badgeIcon: AlertTriangle,
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E8DEC8] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="h-14 px-2 flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1 px-1 flex flex-col items-center justify-center min-h-[44px] transition-colors relative rounded-xl ${
                isActive ? 'text-[#C99A18]' : 'text-stone-500 hover:text-stone-900 active:bg-stone-50'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {tab.badge !== undefined && (
                  <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold px-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center leading-none ${tab.badgeColor}`}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#C99A18] mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Menu Drawer Trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="flex-1 py-1 px-1 flex flex-col items-center justify-center min-h-[44px] text-stone-500 hover:text-stone-900 active:bg-stone-50 transition-colors relative rounded-xl"
          title="More options"
          aria-label="More navigation options"
        >
          <Menu className="w-5 h-5 stroke-[1.75]" />
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
