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
  RefreshCw
} from 'lucide-react';
import { UserProfile } from '../../types';
import { ActiveTab } from './Sidebar';
import { InstallPwaButton } from '../common/InstallPwaButton';
import { syncManager, SyncStatus } from '../../lib/syncManager';

interface HeaderProps {
  activeTab: ActiveTab;
  onToggleMobileMenu?: () => void;
  currentUser: UserProfile;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab,
  onToggleMobileMenu,
  currentUser,
  onOpenSettings,
  onSignOut,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncManager.getStatus());
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return syncManager.onStatusChange((newStatus) => {
      setSyncStatus(newStatus);
    });
  }, []);

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
    'customer-bills': { title: 'Customer Bills', subtitle: 'Tax Invoices & Receipts History' },
    'no-bill-sales': { title: 'No-Bill Sales', subtitle: 'Internal Counter Sales Records' },
    'inventory': { title: 'Inventory Management', subtitle: 'Product Catalog, Pricing & Stock' },
    'label-studio': { title: 'Label Studio', subtitle: 'Barcode Label Designer & Multi-Label Sheet Printing' },
    'expenses': { title: 'Expenses Tracker', subtitle: 'Daily Shop Operating Costs' },
    'reports': { title: 'Reports & Analytics', subtitle: 'Financial Audit & Excel Exports' },
    'settings': { title: 'Settings', subtitle: 'Hardware Diagnostics & Store Preferences' },
  };

  const currentTabInfo = tabTitles[activeTab] || { title: 'AL-BHURANI POS', subtitle: 'Retail POS' };

  // Format today's date like "Monday, Oct 19"
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="h-14 px-4 sm:px-6 bg-[#080808] border-b border-white/[0.06] flex items-center justify-between z-20 shrink-0 gap-3 select-none">
      
      {/* Left: Collapse Button & Current Section */}
      <div className="flex items-center gap-3 min-w-0">
        
        {/* Mobile Hamburger */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-[#121214] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors shrink-0"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Collapse Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex p-2 rounded-xl bg-[#121214] border border-white/[0.08] hover:border-[#D4AF37]/35 text-zinc-400 hover:text-white transition-colors shrink-0"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Current Tab Info (for tabs other than overview) */}
        {activeTab !== 'overview' && (
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-white tracking-tight truncate">
              {currentTabInfo.title}
            </h2>
            <span className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-400 truncate">
              {currentTabInfo.subtitle}
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Sync Status, Install Button, Notifications, Date Pill & Owner Dropdown */}
      <div className="flex items-center gap-2.5 shrink-0">
        
        {/* Real-Time Turso Cloud Sync Pill */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#121214] border border-white/[0.08] text-[11px] font-medium shadow-sm transition-all"
          title={`Turso Cloud Sync Status: ${syncStatus.toUpperCase()}`}
        >
          {syncStatus === 'connected' && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-zinc-300 hidden md:inline">Cloud Synced</span>
            </>
          )}
          {syncStatus === 'syncing' && (
            <>
              <RefreshCw className="w-3 h-3 text-[#D4AF37] animate-spin" />
              <span className="text-[#D4AF37] hidden md:inline">Syncing...</span>
            </>
          )}
          {syncStatus === 'offline' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 hidden md:inline">Offline Cache</span>
            </>
          )}
          {syncStatus === 'error' && (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-rose-300 hidden md:inline">Sync Warning</span>
            </>
          )}
        </div>

        {/* Install App Button */}
        <InstallPwaButton variant="header" />

        {/* Notification Bell with Gold Dot */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="p-2 rounded-xl bg-[#121214] border border-white/[0.08] hover:border-[#D4AF37]/35 text-zinc-400 hover:text-white transition-colors relative"
            title="System Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#121214] border border-[#D4AF37]/30 shadow-2xl p-3 z-50 animate-fade-in text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="font-bold text-white">System Notifications</span>
                <span className="text-[10px] text-[#D4AF37] font-semibold">1 New</span>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="font-semibold text-white block">304 Products Synchronized</span>
                <p className="text-[11px] text-zinc-400">
                  Full stock inventory catalogue is active and ready for POS counter scanning.
                </p>
                <span className="text-[10px] text-zinc-500 block">Just now</span>
              </div>
            </div>
          )}
        </div>

        {/* Date Pill (Matching TEN11 screenshot) */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#121214] border border-white/[0.08] text-xs font-semibold text-white shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{todayFormatted}</span>
        </div>

        {/* Owner Profile Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-[#121214] hover:bg-[#18181C] border border-white/[0.08] hover:border-[#D4AF37]/35 transition-all group shadow-sm"
          >
            <div className="w-5 h-5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[#E7C75A] transition-colors">
              Owner
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
          </button>

          {/* Profile Dropdown */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-[#121214] border border-[#D4AF37]/30 shadow-2xl py-2 z-50 animate-fade-in text-xs">
              <div className="px-3.5 py-2.5 border-b border-white/[0.06] mb-1">
                <span className="font-bold text-white block truncate">AL-BHURANI</span>
                <span className="text-[10px] text-[#C5A85A] font-semibold uppercase tracking-wider block mt-0.5">
                  Owner · Godi Road Store
                </span>
              </div>

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onSignOut?.();
                }}
                className="w-full px-3.5 py-2 text-left text-zinc-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors font-medium rounded-lg group"
              >
                <LogOut className="w-3.5 h-3.5 text-[#D4AF37] group-hover:text-amber-400" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
