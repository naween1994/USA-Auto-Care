import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  CalendarClock,
  Wrench,
  Smartphone,
  FileCheck2,
  Package,
  Receipt,
  BellRing,
  BarChart3,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  Globe,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketSync } from '../hooks/useSocketSync.js';

export function AppLayout() {
  const { user, logout, lang, setLang, t } = useAuth();
  const { isConnected } = useSocketSync(user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const mainNavItems = [
    { to: '/', label: t.nav.dashboard, icon: LayoutDashboard, roles: ['admin', 'receptionist', 'mechanic', 'cashier'] },
    { to: '/customers', label: t.nav.customers, icon: Users, roles: ['admin', 'receptionist', 'cashier'] },
    { to: '/vehicles', label: t.nav.vehicles, icon: Car, roles: ['admin', 'receptionist', 'mechanic', 'cashier'] },
    { to: '/appointments', label: t.nav.appointments, icon: CalendarClock, roles: ['admin', 'receptionist'] },
    { to: '/job-cards', label: t.nav.jobCards, icon: Wrench, roles: ['admin', 'receptionist', 'mechanic', 'cashier'] },
    { to: '/mechanic-bay', label: t.nav.mechanicBay, icon: Smartphone, roles: ['admin', 'mechanic', 'receptionist'] },
    { to: '/estimates', label: t.nav.estimates, icon: FileCheck2, roles: ['admin', 'receptionist', 'cashier'] },
  ].filter((item) => item.roles.includes(user?.role));

  const operationsNavItems = [
    { to: '/inventory', label: t.nav.inventory, icon: Package, roles: ['admin', 'receptionist', 'mechanic'] },
    { to: '/billing', label: t.nav.billing, icon: Receipt, roles: ['admin', 'cashier', 'receptionist'] },
    { to: '/reminders', label: t.nav.reminders, icon: BellRing, roles: ['admin', 'receptionist'] },
    { to: '/reports', label: t.nav.reports, icon: BarChart3, roles: ['admin', 'cashier'] },
    { to: '/settings', label: t.nav.settings, icon: Settings, roles: ['admin'] },
  ].filter((item) => item.roles.includes(user?.role));

  function renderNavItems(items) {
    return items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
              isActive
                ? 'bg-gradient-to-r from-blue-600 to-red-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      );
    });
  }

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-900">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-72 bg-[#0f172a] text-slate-100 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-white rounded-xl p-1.5 shadow-sm border border-blue-500/20 shrink-0">
              <img src="/logo.jpeg" alt="USA Auto Care Logo" className="h-8 w-auto object-contain" />
            </div>
            <div className="min-w-0">
              <span className="block font-extrabold text-sm tracking-tight text-white">{t.businessName}</span>
              <p className="text-[10px] text-blue-300 font-medium truncate">{t.location} • LKR</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Workshop Management
          </p>
          {renderNavItems(mainNavItems)}
          {operationsNavItems.length > 0 && (
            <>
              <p className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Inventory, Billing & Admin
              </p>
              {renderNavItems(operationsNavItems)}
            </>
          )}
        </nav>

        <div className="hidden lg:block p-3.5 border-t border-slate-800 text-[11px] text-slate-400 space-y-2.5">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <p className="text-[10px] font-bold uppercase text-blue-400">Workshop Hotlines</p>
            <p className="text-xs font-mono text-white">0773995399 / 0703995399</p>
            <p className="text-[10px] text-slate-400 truncate">usaautocare66@gmail.com</p>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-200">{user?.name}</p>
              <p className="text-[10px] font-semibold uppercase text-blue-300">{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'si' : 'en')}
              className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'en' ? 'සිංහල' : 'EN'}
            </button>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            Sign Out
          </button>
        </div>

        <div className="lg:hidden p-3 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'si' : 'en')}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-800 text-xs text-slate-200"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'en' ? 'සිංහල' : 'EN'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-800 text-xs text-slate-200 font-semibold"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {!isConnected && (
          <div
            role="alert"
            className="no-print bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <WifiOff className="w-4 h-4" />
            <span>{t.common.offlineBanner}</span>
          </div>
        )}

        <header className="no-print sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-slate-900">USA Auto Care ERP</h1>
                <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Alawwa, Sri Lanka
                </span>
              </div>
              <p className="text-[11px] text-slate-500">0773995399 / 0703995399 • usaautocare66@gmail.com</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['admin', 'receptionist'].includes(user?.role) && (
              <button
                type="button"
                onClick={() => navigate('/appointments')}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Booking
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/vehicles')}
              className="hidden sm:flex px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 text-xs font-bold items-center gap-1.5"
            >
              <Car className="w-3.5 h-3.5" />
              Vehicles
            </button>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 text-[11px]'
              }`}
            >
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isConnected ? t.common.liveConnected : 'Disconnected'}
            </span>
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-red-600 text-white font-bold text-[10px] flex items-center justify-center">
                {user?.name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 leading-none">{user?.name}</p>
                <p className="text-[10px] font-semibold uppercase text-blue-600">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-7 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
