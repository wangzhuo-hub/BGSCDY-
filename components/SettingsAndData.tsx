import React, { useState, useRef } from 'react';
import { Save, Upload, Download, Database, Shield, AlertTriangle, ChevronDown, ChevronUp, Loader2, Settings, Copy, Check } from 'lucide-react';
import { AppState, AppSettings } from '../types';
import { backupToCloud, restoreFromCloud } from '../services';
import { sanitizeImportedData } from '../utils';

interface Props {
  state: AppState;
  onUpdateSettings: (s: AppSettings) => void;
  onImportData: (state: AppState) => void;
}

const SettingsAndData: React.FC<Props> = ({ state, onUpdateSettings, onImportData }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(state.settings);
  const [showSensitive, setShowSensitive] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = () => {
    onUpdateSettings(localSettings);
    setMessage({ type: 'success', text: '配置已保存' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCloudBackup = async () => {
    setIsBackingUp(true);
    const result = await backupToCloud(state, localSettings.supabaseUrl, localSettings.supabaseKey);
    setMessage({ type: result.success ? 'success' : 'error', text: result.message });
    setIsBackingUp(false);
  };

  const handleCloudRestore = async () => {
    if (!confirm('云端数据将覆盖当前所有本地数据，确定继续吗？')) return;
    setIsRestoring(true);
    const result = await restoreFromCloud(localSettings.supabaseUrl, localSettings.supabaseKey);
    if (result.success && result.data) {
       const sanitized = sanitizeImportedData(result.data);
       if (sanitized) {
         onImportData(sanitized);
         setMessage({ type: 'success', text: '恢复成功！' });
       } else {
         setMessage({ type: 'error', text: '数据清洗失败，文件可能已损坏' });
       }
    } else {
       setMessage({ type: 'error', text: result.message });
    }
    setIsRestoring(false);
  };

  const handleLocalExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market_survey_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLocalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const sanitized = sanitizeImportedData(json);
        if (sanitized) {
             const mergedSettings = {
                 ...sanitized.settings,
                 supabaseUrl: sanitized.settings.supabaseUrl || localSettings.supabaseUrl,
                 supabaseKey: sanitized.settings.supabaseKey || localSettings.supabaseKey,
             };
             onImportData({ ...sanitized, settings: mergedSettings });
             setLocalSettings(mergedSettings);
             setMessage({ type: 'success', text: '本地导入成功' });
        } else {
             setMessage({ type: 'error', text: '文件格式错误' });
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'JSON 解析失败' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sqlScript = `-- 1. 创建 backups 存储桶
insert into storage.buckets (id, name, public)
values ('backups', 'backups', true)
on conflict (id) do nothing;

-- 2. 允许所有操作 (公开读写策略)
create policy "Public Access Select" on storage.objects for select using ( bucket_id = 'backups' );
create policy "Public Access Insert" on storage.objects for insert with check ( bucket_id = 'backups' );
create policy "Public Access Delete" on storage.objects for delete using ( bucket_id = 'backups' );
create policy "Public Access Update" on storage.objects for update using ( bucket_id = 'backups' );`;

  const copySQL = () => {
      navigator.clipboard.writeText(sqlScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">系统设置与数据管理</h2>
      </header>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {message.type === 'success' ? <Database size={18}/> : <AlertTriangle size={18}/>}
          {message.text}
        </div>
      )}

      {/* User Info */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Settings size={20} className="text-slate-500"/> 基础配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">默认调研人姓名</span>
            <input 
              value={localSettings.surveyorName}
              onChange={e => setLocalSettings({...localSettings, surveyorName: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
            />
          </label>
        </div>
      </section>

      {/* Cloud & API Config */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2"><Database size={20} className="text-blue-500"/> 云端连接 (Supabase)</h3>
            <button onClick={() => setShowSensitive(!showSensitive)} className="text-xs text-blue-600 hover:underline">
                {showSensitive ? '隐藏高级配置' : '显示高级配置'}
            </button>
        </div>
        
        {showSensitive && (
            <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100 mb-6 animate-in fade-in">
                 <label className="block">
                    <span className="text-sm font-medium text-slate-700">Supabase Project URL</span>
                    <input 
                        value={localSettings.supabaseUrl}
                        onChange={e => setLocalSettings({...localSettings, supabaseUrl: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 font-mono text-xs"
                    />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-slate-700">Supabase Anon Key</span>
                    <input 
                        type="password"
                        value={localSettings.supabaseKey}
                        onChange={e => setLocalSettings({...localSettings, supabaseKey: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 font-mono text-xs"
                    />
                </label>
            </div>
        )}

        <div className="flex flex-wrap gap-4">
             <button 
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2"
            >
                <Save size={18} /> 保存配置
            </button>

            <div className="h-10 w-px bg-slate-200 mx-2"></div>

             <button 
                onClick={handleCloudBackup}
                disabled={isBackingUp || !localSettings.supabaseUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
                {isBackingUp ? <Loader2 size={18} className="animate-spin"/> : <Upload size={18} />} 云端备份
            </button>
             <button 
                onClick={handleCloudRestore}
                disabled={isRestoring || !localSettings.supabaseUrl}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
                {isRestoring ? <Loader2 size={18} className="animate-spin"/> : <Download size={18} />} 云端恢复
            </button>
        </div>

        {/* Supabase Help Accordion */}
        <div className="mt-8 border border-blue-100 bg-blue-50/50 rounded-lg overflow-hidden">
            <details className="group" open>
                <summary className="p-4 bg-blue-50 cursor-pointer font-medium text-blue-700 hover:bg-blue-100 transition-colors flex justify-between items-center">
                    <span className="flex items-center gap-2"><Database size={16}/> 数据库初始化脚本 (云端备份报错请点此)</span>
                    <ChevronDown size={16} className="group-open:rotate-180 transition-transform"/>
                </summary>
                <div className="p-4">
                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                        如果遇到 <span className="font-mono bg-rose-100 text-rose-600 px-1 rounded">Invalid key</span> 或 <span className="font-mono bg-rose-100 text-rose-600 px-1 rounded">Permission denied</span> 错误，请复制下方 SQL 代码，
                        并在 Supabase 后台的 <strong>SQL Editor</strong> 中运行，以初始化存储桶和访问权限。
                    </p>
                    <div className="relative">
                        <pre className="bg-slate-800 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-700">
                            {sqlScript}
                        </pre>
                        <button 
                            onClick={copySQL}
                            className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-md transition-colors backdrop-blur-sm border border-white/10"
                            title="复制 SQL"
                        >
                            {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14}/>}
                        </button>
                    </div>
                </div>
            </details>
        </div>
      </section>

      {/* Local Data */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Shield size={20} className="text-emerald-500"/> 本地数据管理</h3>
        <div className="flex gap-4">
             <button onClick={handleLocalExport} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Download size={18}/> 导出 JSON
             </button>
             <label className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors">
                <Upload size={18}/> 导入 JSON
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLocalImport} />
             </label>
        </div>
        <p className="mt-2 text-xs text-slate-400">
            支持完整数据快照的导出与恢复。导入前请确保文件格式正确。
        </p>
      </section>
    </div>
  );
};

export default SettingsAndData;