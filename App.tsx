import React, { useState, useEffect } from 'react';
import { AppState, ViewMode, Park, SurveyRecord, AppSettings } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ParkManager from './components/ParkManager';
import SettingsAndData from './components/SettingsAndData';
import { CloudSaveModal, CloudHistoryModal } from './components/CloudSync';
import { checkSupabaseConnection } from './services';
import { generateId } from './utils';

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

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Cloud State
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
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
            // Optional: trigger toast or refresh list
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