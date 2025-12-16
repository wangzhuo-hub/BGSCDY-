import React from 'react';
import { LayoutDashboard, Building2, Settings, Cloud, History, CheckCircle2, XCircle, Loader2, Upload, Download } from 'lucide-react';
import { ViewMode } from '../types';

interface LayoutProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  children: React.ReactNode;
  
  // New Global Header Props
  connectionStatus: 'connected' | 'disconnected' | 'checking';
  onCloudSave: () => void;
  onCloudHistory: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
    currentView, onChangeView, children,
    connectionStatus, onCloudSave, onCloudHistory
}) => {
  const navItems = [
    { id: 'dashboard', label: '市场概览', icon: LayoutDashboard },
    { id: 'parks', label: '园区档案', icon: Building2 },
    { id: 'settings', label: '系统设置', icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* PC Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl z-20">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-blue-400">Market</span>Survey
          </h1>
          <p className="text-xs text-slate-400 mt-1">专业办公租赁调研</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Quick Actions Section */}
        <div className="px-4 pb-4">
            <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    快捷操作
                </h4>
                <div className="space-y-2">
                    <button 
                        onClick={onCloudSave}
                        className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm group"
                    >
                        <Cloud size={14} className="group-hover:scale-110 transition-transform" />
                        <span>云端一键备份</span>
                    </button>
                    <button 
                        onClick={onCloudHistory}
                        className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors group"
                    >
                        <History size={14} className="group-hover:scale-110 transition-transform" />
                        <span>恢复与导入</span>
                    </button>
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 text-center">
            <div className="flex items-center justify-center gap-1 mb-1 text-emerald-500/80">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                本地自动保存
            </div>
            © 2024 MarketSurvey Pro
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Global Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-4 md:px-8 shadow-sm shrink-0 z-10">
            <div className="flex items-center gap-4">
                <span className="md:hidden font-bold text-slate-800">MarketSurvey</span>
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                    connectionStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    connectionStatus === 'checking' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                    {connectionStatus === 'connected' && <CheckCircle2 size={12} />}
                    {connectionStatus === 'disconnected' && <XCircle size={12} />}
                    {connectionStatus === 'checking' && <Loader2 size={12} className="animate-spin" />}
                    
                    {connectionStatus === 'connected' ? '云端已连接' : 
                     connectionStatus === 'checking' ? '连接中...' : '云端未连接'}
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={onCloudHistory}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <History size={18} />
                    <span className="hidden sm:inline">历史档案</span>
                </button>
                <button 
                    onClick={onCloudSave}
                    className="flex items-center gap-2 text-sm bg-slate-800 text-white hover:bg-slate-700 px-4 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                    <Cloud size={18} />
                    <span className="hidden sm:inline">云端备份</span>
                </button>
            </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth">
          {children}
        </div>
        
        {/* Mobile Bottom Spacer for Nav */}
        <div className="h-16 md:hidden flex-shrink-0" />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 flex justify-around items-center h-16 pb-safe">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              currentView === item.id ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <item.icon size={24} strokeWidth={currentView === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;