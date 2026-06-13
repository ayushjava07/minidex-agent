import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Database, LayoutDashboard, Menu, X, Moon, Sun, HardDrive } from "lucide-react";
import { useState, useEffect } from "react";
import DashboardPage from "./pages/DashboardPage";
import FilecoinPage from "./pages/FilecoinPage";
import NotFoundPage from "./pages/NotFoundPage";

const NAV_ITEMS = [
  { path: "/", label: "MiniDEX Dashboard", icon: LayoutDashboard },
  { path: "/filecoin", label: "Filecoin Storage", icon: HardDrive },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const location = useLocation();

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark") }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light") }
  }, [dark]);

  useEffect(() => { setSidebarOpen(false) }, [location]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-surface-dark">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-surface-border dark:bg-surface-card lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-filecoin-500 to-blue-600 p-2 shadow-md">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">ATOS</p>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">MiniDEX Agent</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-border lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-surface-border">
          <button
            onClick={() => setDark(d => !d)}
            className="sidebar-link w-full"
          >
            {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-surface-border dark:bg-surface-card/80 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-border">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-filecoin-500 to-blue-600 p-1.5 shadow-sm">
              <Database className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">ATOS</p>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/filecoin" element={<FilecoinPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
