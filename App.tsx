import React, { useState, useEffect, useRef } from 'react';
import { AppState, ViewMode, Park, SurveyRecord, AppSettings } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ParkManager from './components/ParkManager';
import SettingsAndData from './components/SettingsAndData';
import { CloudSaveModal, CloudHistoryModal } from './components/CloudSync';
import { checkSupabaseConnection, restoreFromCloud } from './services';
import { generateId, sanitizeImportedData } from './utils';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

const STORAGE_KEY = 'market_survey_pro_v1';

const defaultSettings: AppSettings = {
  surveyorName: '分析师',
  supabaseUrl: 'https://udcrtzngguvnzvlalmph.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkY3J0em5nZ3V2bnp2bGFsbXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NzQxNzMsImV4cCI6MjA4MDE1MDE3M30.JIaPUJ9gqF6v0ofgtbDDQNgsba_YwkAfYbriz1GY9A8',
};

const initialState: AppState = {
  parks: [],
  records: [],
  settings: defaultSettings,
};

// --- Toast Component ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'info' | 'warning', onClose: () => void }) => (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full shadow-xl border animate-in slide-in-from-top-4 fade-in duration-300 ${
        type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 
        type === 'warning' ? 'bg-amber-500 text-white border-amber-400' :
        'bg-slate-800 text-white border-slate-700'
    }`}>
        {type === 'success' && <CheckCircle2 size={18} className="text-emerald-100" />}
        {type === 'warning' && <AlertTriangle size={18} className="text-amber-100" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100 p-0.5 rounded-full hover:bg-white/20 transition-colors">
            <X size={14}/>
        </button>
    </div>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Cloud State
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info' | 'warning'} | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Auto-migration: Check if using old Supabase URL (from previous session) and force update to new one
        if (parsed.settings?.supabaseUrl?.includes('zqinghqgkhxutsslulzn')) {
            console.log("Migrating old Supabase configuration to new default...");
            parsed.settings.supabaseUrl = defaultSettings.supabaseUrl;
            parsed.settings.supabaseKey = defaultSettings.supabaseKey;
        }

        // Ensure structure consistency
        setState({
          parks: parsed.parks || [],
          records: parsed.records || [],
          settings: { ...defaultSettings, ...parsed.settings }, 
        });
      }
    } catch (e) {
      console.error('Failed to load local state', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isInitialized]);

  // Check Cloud Connection on Mount and Settings Change
  useEffect(() => {
      const check = async () => {
          setConnectionStatus('checking');
          const isConnected = await checkSupabaseConnection(state.settings.supabaseUrl, state.settings.supabaseKey);
          setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      };
      if (isInitialized) check();
  }, [isInitialized, state.settings.supabaseUrl, state.settings.supabaseKey]);

  // --- Auto-Restore from Cloud Logic ---
  const hasAutoRestored = useRef(false);
  useEffect(() => {
      if (isInitialized && !hasAutoRestored.current) {
          hasAutoRestored.current = true;
          
          const runAutoRestore = async () => {
              // Only attempt if we have credentials
              if (!state.settings.supabaseUrl || !state.settings.supabaseKey) return;
              
              // Try to fetch latest
              const { success, data, fileMetadata } = await restoreFromCloud(state.settings.supabaseUrl, state.settings.supabaseKey);
              
              if (success && data) {
                  const sanitized = sanitizeImportedData(data);
                  if (sanitized) {
                      // Preserve current settings while importing data
                      const mergedSettings = {
                        ...sanitized.settings,
                        supabaseUrl: state.settings.supabaseUrl,
                        supabaseKey: state.settings.supabaseKey,
                      };
                      setState({ ...sanitized, settings: mergedSettings });
                      
                      const dateStr = fileMetadata ? new Date(fileMetadata.created_at).toLocaleString('zh-CN') : '未知时间';
                      setNotification({
                          type: 'success',
                          message: `本次展示数据基于 ${dateStr} 云端备份数据`
                      });
                      
                      // Auto dismiss after 8 seconds
                      setTimeout(() => setNotification(null), 8000);
                  }
              }
              // If failed (e.g. offline), we just stay with localStorage data silently
          };
          
          runAutoRestore();
      }
  }, [isInitialized]);

  // --- Prompt to Backup Before Closing ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers don't show custom text, but this triggers the confirmation dialog
      e.preventDefault();
      e.returnValue = '您有数据尚未备份到云端，确定要关闭吗？';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  // Actions
  const updateParks = (parks: Park[]) => setState(s => ({ ...s, parks }));
  const updateRecords = (records: SurveyRecord[]) => setState(s => ({ ...s, records }));
  const updateSettings = (settings: AppSettings) => setState(s => ({ ...s, settings }));
  const importData = (newState: AppState) => setState(newState);

  if (!isInitialized) return null;

  return (
    <Layout 
        currentView={currentView} 
        onChangeView={setCurrentView}
        connectionStatus={connectionStatus}
        onCloudSave={() => setIsSaveModalOpen(true)}
        onCloudHistory={() => setIsHistoryModalOpen(true)}
    >
      {notification && (
          <Toast 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)}
          />
      )}

      {currentView === 'dashboard' && (
        <Dashboard parks={state.parks} records={state.records} />
      )}
      {currentView === 'parks' && (
        <ParkManager 
          parks={state.parks} 
          records={state.records} 
          settings={state.settings}
          setParks={updateParks}
          setRecords={updateRecords}
        />
      )}
      {currentView === 'settings' && (
        <SettingsAndData 
          state={state} 
          onUpdateSettings={updateSettings} 
          onImportData={importData}
        />
      )}

      {/* Cloud Modals */}
      <CloudSaveModal 
        isOpen={isSaveModalOpen} 
        onClose={() => setIsSaveModalOpen(false)}
        appState={state}
        onSuccess={() => {
            setNotification({ type: 'success', message: '云端备份成功！' });
            setTimeout(() => setNotification(null), 3000);
        }}
      />
      <CloudHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        appState={state}
        onRestore={importData}
      />
    </Layout>
  );
};

export default App;