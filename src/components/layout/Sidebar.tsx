import React from 'react';
import { 
  ShoppingBag, 
  Package, 
  DollarSign, 
  Barcode, 
  Store, 
  HelpCircle,
  Sparkles,
  ChefHat
} from 'lucide-react';

export type ActiveTab = 'pos' | 'inventory' | 'finance' | 'barcode-guide';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, lowStockCount }) => {
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

  return (
    <aside className="w-64 shrink-0 h-screen glass-sidebar flex flex-col justify-between p-4 border-r border-[#D4AF37]/15">
      
      {/* Top Branding (TENS11 Luxury Gold Style) */}
      <div>
        <div className="flex items-center gap-3 p-3 rounded-2xl liquid-glass border border-[#D4AF37]/30 bg-black/50 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8B6914] flex items-center justify-center text-black font-black font-serif text-lg shadow-[0_0_15px_rgba(212,175,55,0.3)] shrink-0">
            AB
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm tracking-wider uppercase font-serif text-white truncate leading-none">
              AL-BHURANI
            </h1>
            <p className="text-[10px] tracking-widest text-[#D4AF37] uppercase font-medium mt-1">
              Sweets & Dry Items
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-gray-500 px-3 mb-2">
            Main Management
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37]/20 to-transparent border-l-4 border-[#D4AF37] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.4)]'
                        : 'bg-white/5 text-gray-400 group-hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold block leading-tight truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-500 block truncate">
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}

                {item.alertCount !== undefined && item.alertCount > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {item.alertCount} low
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Outlet Footer info */}
      <div className="p-3.5 rounded-2xl liquid-glass border border-white/5 bg-black/40 text-xs">
        <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-xs">
          <Store className="w-4 h-4" />
          <span>Branch #01 (Main)</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Pure Mithai & Farsan Counters
        </p>
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
          <span>Theme: TENS11 Luxury</span>
          <span className="text-emerald-400 font-medium">Online ✓</span>
        </div>
      </div>

    </aside>
  );
};
