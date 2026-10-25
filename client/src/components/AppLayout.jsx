import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketSync } from '../hooks/useSocketSync.js';

export function AppLayout() {
  const { user, logout, lang, setLang, t } = useAuth();
  const { isConnected } = useSocketSync(user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: '/', label: t.nav.dashboard, icon: LayoutDashboard, roles: ['admin', 'receptionist', 'mechanic', 'cashier'] },
    { to: '/customers', label: t.nav.customers, icon: Users, roles: ['admin', 'receptionist', 'cashier'] },
    { to: '/vehicles', label: t.nav.vehicles, icon: Car, roles: ['admin', 'receptionist', 'mechanic', 'cashier'] },
    { to: '/appointments', label: t.nav.appointments, icon: CalendarClock, roles: ['admin', 'receptionist'] },
    { to: '/job-cards', label: t.nav.jobCards, icon: Wrench, roles: ['admin', 'receptionist', 'mechanic', 'cashier'] },
    { to: '/mechanic-bay', label: t.nav.mechanicBay, icon: Smartphone, roles: ['admin', 'mechanic', 'receptionist'] },
    { to: '/estimates', label: t.nav.estimates, icon: FileCheck2, roles: ['admin', 'receptionist', 'cashier'] },
    { to: '/inventory', label: t.nav.inventory, icon: Package, roles: ['admin', 'receptionist', 'mechanic'] },
    { to: '/billing', label: t.nav.billing, icon: Receipt, roles: ['admin', 'cashier', 'receptionist'] },
    { to: '/reminders', label: t.nav.reminders, icon: BellRing, roles: ['admin', 'receptionist'] },
    { to: '/reports', label: t.nav.reports, icon: BarChart3, roles: ['admin', 'cashier'] },
    { to: '/settings', label: t.nav.settings, icon: Settings, roles: ['admin'] },
  ].filter((item) => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Dark Navy Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-navy-900 text-slate-100 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.jpeg" alt="USA Auto Care Logo" className="h-8 w-auto rounded bg-white p-1 object-contain" />
              <span className="font-bold text-lg tracking-tight text-white">{t.businessName}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{t.location} • LKR</p>
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

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brandRed-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{ user?.name }</span>
            <span className="uppercase px-2 py-0.5 rounded bg-slate-800 text-brandRed-500 font-semibold">
              {user?.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'si' : 'en')}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-navy-800 hover:bg-slate-800 text-xs text-slate-200"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'en' ? 'සිංහල' : 'English'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-brandRed-600 hover:bg-brandRed-700 text-xs text-white font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
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

        <header className="no-print bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between">
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
              <h1 className="text-sm font-semibold text-slate-800">
                USA Auto Care — Workshop Operations
              </h1>
              <p className="text-xs text-slate-500">Alawwa, Sri Lanka • Tel: 0773995399 / 0703995399 • usaautocare66@gmail.com</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isConnected ? t.common.liveConnected : 'Disconnected'}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
