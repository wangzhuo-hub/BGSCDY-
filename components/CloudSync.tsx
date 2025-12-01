import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Download, RefreshCw, Trash2, Loader2, FileJson, CheckCircle, AlertTriangle } from 'lucide-react';
import { AppState, BackupFile } from '../types';
import { backupToCloud, listCloudBackups, deleteCloudBackup, restoreFromCloud, getDownloadUrl } from '../services';
import { sanitizeImportedData } from '../utils';

interface CloudSaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    appState: AppState;
    onSuccess: () => void;
}

export const CloudSaveModal: React.FC<CloudSaveModalProps> = ({ isOpen, onClose, appState, onSuccess }) => {
    const [name, setName] = useState(appState.settings.surveyorName || '');
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    // Generate Human Readable Filename for Display
    const generateDisplayFilename = () => {
        const now = new Date();
        const timeStr = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0');
        
        const safeName = (name || '未命名').trim();
        const safeNote = (note || '快照').trim();
        
        return `${safeName}_${timeStr}_${safeNote}.json`;
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError('');
        
        // Pass logical name, service will handle hex encoding
        const filename = generateDisplayFilename();
        
        const { success, message } = await backupToCloud(
            appState, 
            appState.settings.supabaseUrl, 
            appState.settings.supabaseKey,
            filename
        );
        setIsLoading(false);
        
        if (success) {
            onSuccess();
            onClose();
        } else {
            setError(message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Save size={18} className="text-blue-600"/> 云端备份
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <div className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded border border-rose-200 flex flex-col gap-1">
                             <div className="flex items-center gap-2 font-bold"><AlertTriangle size={16}/> 备份失败</div>
                             <p className="text-xs">{error}</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">备份人姓名</label>
                        <input 
                            value={name} 
                            onChange={e => setName(e.target.value)}
                            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="请输入姓名"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">备份备注/名称</label>
                        <input 
                            value={note} 
                            onChange={e => setNote(e.target.value)}
                            className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="如：一期调研归档"
                        />
                    </div>
                    <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 break-all font-mono">
                        <span className="block font-bold mb-1 text-slate-400">文件名预览:</span>
                        {generateDisplayFilename()}
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isLoading || !name || !note}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                        确认备份
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CloudHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    appState: AppState;
    onRestore: (state: AppState) => void;
}

export const CloudHistoryModal: React.FC<CloudHistoryModalProps> = ({ isOpen, onClose, appState, onRestore }) => {
    const [files, setFiles] = useState<BackupFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // Use file ID (encoded key)
    const [error, setError] = useState('');

    const fetchFiles = async () => {
        setIsLoading(true);
        setError('');
        const { success, data, message } = await listCloudBackups(appState.settings.supabaseUrl, appState.settings.supabaseKey);
        setIsLoading(false);
        if (success && data) {
            setFiles(data);
        } else {
            setError(message || '获取列表失败');
        }
    };

    useEffect(() => {
        if (isOpen) fetchFiles();
    }, [isOpen]);

    const handleRestore = async (file: BackupFile) => {
        if (!confirm(`确定要将系统恢复到 "${file.name}" 的状态吗？当前未保存的数据将丢失。`)) return;
        
        setActionLoading(file.id); // Use Encoded Key
        const { success, data, message } = await restoreFromCloud(
            appState.settings.supabaseUrl, 
            appState.settings.supabaseKey, 
            file.id // Use Encoded Key
        );
        setActionLoading(null);

        if (success && data) {
            const sanitized = sanitizeImportedData(data);
            if (sanitized) {
                // Preserve keys
                const mergedSettings = {
                    ...sanitized.settings,
                    supabaseUrl: appState.settings.supabaseUrl,
                    supabaseKey: appState.settings.supabaseKey,
                };
                onRestore({ ...sanitized, settings: mergedSettings });
                onClose();
            } else {
                alert('数据损坏，无法恢复');
            }
        } else {
            alert(message);
        }
    };

    const handleDelete = async (file: BackupFile) => {
        if (!confirm(`确定要永久删除备份 "${file.name}" 吗？`)) return;
        
        setActionLoading(file.id); // Use Encoded Key
        const { success, message } = await deleteCloudBackup(file.id, appState.settings.supabaseUrl, appState.settings.supabaseKey);
        setActionLoading(null);
        
        if (success) {
            setFiles(files.filter(f => f.id !== file.id));
        } else {
            alert(message);
        }
    };

    const handleDownload = async (file: BackupFile) => {
        setActionLoading(file.id);
        const url = await getDownloadUrl(file.id, appState.settings.supabaseUrl, appState.settings.supabaseKey);
        setActionLoading(null);
        
        if (url) {
            window.open(url, '_blank');
        } else {
            alert('获取下载链接失败');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock size={18} className="text-purple-600"/> 云端历史档案
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={fetchFiles} className="p-2 hover:bg-slate-200 rounded-full" title="刷新"><RefreshCw size={16}/></button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <Loader2 size={32} className="animate-spin text-blue-500"/>
                            <p>加载云端数据中...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-rose-500 gap-2 p-8 text-center">
                            <AlertTriangle size={32}/>
                            <p>{error}</p>
                            <p className="text-xs text-slate-400">请检查网络连接或在“系统设置”中运行初始化脚本</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <FileJson size={48} className="text-slate-200"/>
                            <p>暂无云端备份记录</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-6 py-3 font-medium">备份文件</th>
                                    <th className="px-6 py-3 font-medium">时间</th>
                                    <th className="px-6 py-3 font-medium text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {files.map(file => (
                                    <tr key={file.id} className="hover:bg-slate-50 group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-700 break-all">{file.name}</div>
                                            {file.metadata && <div className="text-xs text-slate-400">{(file.metadata.size / 1024).toFixed(1)} KB</div>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {new Date(file.created_at).toLocaleString('zh-CN')}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            {actionLoading === file.id ? (
                                                <span className="inline-block p-2"><Loader2 size={16} className="animate-spin text-blue-500"/></span>
                                            ) : (
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleRestore(file)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="恢复到系统">
                                                        <RefreshCw size={16}/>
                                                    </button>
                                                    <button onClick={() => handleDownload(file)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="下载 JSON">
                                                        <Download size={16}/>
                                                    </button>
                                                    <button onClick={() => handleDelete(file)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="删除">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};