import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Store, 
  Settings, 
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Calendar,
  LogOut,
  Globe,
  Database
} from 'lucide-react';
import { UserProfile } from '../../types';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  onToggleMobileMenu?: () => void;
  currentUser: UserProfile;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
  onViewPublicWebsite?: () => void;
  onOpenBudgetDiagnostics?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab,
  onToggleMobileMenu,
  currentUser,
  onOpenSettings,
  onSignOut,
  onViewPublicWebsite,
  onOpenBudgetDiagnostics,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabTitles: Record<ActiveTab, { title: string; subtitle: string }> = {
    'overview': { title: 'Dashboard', subtitle: 'Executive Overview' },
    'pos': { title: 'POS Billing', subtitle: 'Barcode Scan & Rapid Checkout' },
    'orders': { title: 'Customer Orders', subtitle: 'Advance Bookings & Scheduled Deliveries' },
    'customer-bills': { title: 'Customer Bills', subtitle: 'Tax Invoices & Receipts History' },
    'no-bill-sales': { title: 'No-Bill Sales', subtitle: 'Internal Counter Sales Records' },
    'purchases': { title: 'Purchase Bills', subtitle: 'Vendor Procurement & Inward Stock' },
    'product-management': { title: 'Product Management', subtitle: 'Categories & Item Master Setup' },
    'label-studio': { title: 'Label Studio', subtitle: 'Barcode Label Designer & Multi-Label Sheet Printing' },
    'expenses': { title: 'Expenses Tracker', subtitle: 'Daily Shop Operating Costs' },
    'reports': { title: 'Reports & Analytics', subtitle: 'Financial Audit & Excel Exports' },
    'settings': { title: 'Settings', subtitle: 'Hardware Diagnostics & Store Preferences' },
  };

  const currentTabInfo = tabTitles[activeTab] || { title: 'AL-BURHANI POS', subtitle: 'Retail POS' };

  // Format today's date like "Monday, Oct 19"
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header 
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
      }}
      className="px-3 sm:px-6 bg-white border-b border-[#E8DEC8] flex items-center justify-between z-20 shrink-0 gap-2 sm:gap-3 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      
      {/* Left: Collapse Button & Current Section */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        
        {/* Mobile Hamburger (44px touch target) */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] hover:border-[#D4AF37] text-stone-600 hover:text-stone-900 transition-colors shrink-0"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex p-2 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] hover:border-[#D4AF37] text-stone-600 hover:text-stone-900 transition-colors shrink-0"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-[#C99A18]" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-stone-600" />
            )}
          </button>
        )}

        {/* Current Tab Info (for tabs other than overview) */}
        {activeTab !== 'overview' && (
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-[#1C1917] tracking-tight truncate font-serif">
              {currentTabInfo.title}
            </h2>
            <span className="text-[#C99A18]">·</span>
            <span className="text-xs text-stone-500 truncate">
              {currentTabInfo.subtitle}
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Notifications, Date Pill & Owner Dropdown */}
      <div className="flex items-center gap-2.5 shrink-0">

        {/* Notification Bell with Gold Dot */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="p-2 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] hover:border-[#D4AF37] text-stone-600 hover:text-stone-900 transition-colors relative"
            title="System Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#C99A18] shadow-[0_0_6px_rgba(201,154,24,0.6)]" />
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl p-3 z-50 animate-fade-in text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE0]">
                <span className="font-bold text-[#1C1917]">System Notifications</span>
                <span className="text-[10px] text-[#C99A18] font-bold">1 New</span>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-1">
                <span className="font-semibold text-[#1C1917] block">Product Catalog Active</span>
                <p className="text-[11px] text-stone-600">
                  Full product catalogue is active and ready for POS counter scanning.
                </p>
                <span className="text-[10px] text-stone-400 block">Just now</span>
              </div>
            </div>
          )}
        </div>

        {/* Date Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs font-semibold text-stone-800 shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-[#C99A18]" />
          <span>{todayFormatted}</span>
        </div>

        {/* Active Branch Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FAF8F5] via-[#FFFDF5] to-[#F5EED9] border border-[#D4AF37]/50 text-xs font-bold text-stone-900 shadow-sm">
          <Store className="w-3.5 h-3.5 text-[#C99A18] shrink-0" />
          <span className="font-serif tracking-wide truncate max-w-[110px] sm:max-w-none">
            {currentUser.branchName || (currentUser.branchId === 'mg_road' ? 'MG Road' : 'Godi Road')}
          </span>
        </div>

        {/* Owner Profile Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-[#FAF8F5] hover:bg-[#F5F2EB] border border-[#E8DEC8] hover:border-[#D4AF37] transition-all group shadow-sm"
          >
            <div className="w-5 h-5 rounded-full bg-[#C99A18]/15 border border-[#C99A18]/40 text-[#C99A18] flex items-center justify-center font-bold text-xs shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-stone-900 group-hover:text-[#A67D0C] transition-colors">
              Owner
            </span>
            <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-stone-700" />
          </button>

          {/* Profile Dropdown */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl py-2 z-50 animate-fade-in text-xs">
              <div className="px-3.5 py-2.5 border-b border-[#F0EBE0] mb-1">
                <span className="font-bold text-[#1C1917] block truncate">AL-BURHANI</span>
                <span className="text-[10px] text-[#A67D0C] font-semibold uppercase tracking-wider block mt-0.5">
                  Owner · {currentUser.counter || (currentUser.branchId === 'mg_road' ? 'MG Road Store' : 'Godi Road Store')}
                </span>
              </div>

              {onViewPublicWebsite && (
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onViewPublicWebsite();
                  }}
                  className="w-full px-3.5 py-2 text-left text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5] flex items-center gap-2.5 transition-colors font-medium rounded-lg group cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-[#C99A18] group-hover:text-amber-600" />
                  <span>Public Website</span>
                </button>
              )}

              {onOpenBudgetDiagnostics && (
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenBudgetDiagnostics();
                  }}
                  className="w-full px-3.5 py-2 text-left text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5] flex items-center gap-2.5 transition-colors font-medium rounded-lg group cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-[#C99A18] group-hover:text-amber-600" />
                  <span>200M Read Budget</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onSignOut?.();
                }}
                className="w-full px-3.5 py-2 text-left text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5] flex items-center gap-2.5 transition-colors font-medium rounded-lg group"
              >
                <LogOut className="w-3.5 h-3.5 text-[#C99A18] group-hover:text-amber-600" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
