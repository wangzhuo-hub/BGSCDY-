import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { AppState, AIEvent, BackupFile } from './types';

// --- Supabase Service ---

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (url: string, key: string) => {
  if (!url || !key) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
};

export const resetSupabase = () => {
  supabaseInstance = null;
};

export const checkSupabaseConnection = async (url: string, key: string): Promise<boolean> => {
  const client = getSupabase(url, key);
  if (!client) return false;
  try {
    // Check connection by trying to list the bucket. 
    // If bucket doesn't exist, it might error, but network connection is OK.
    const { error } = await client.storage.from('backups').list('', { limit: 1 });
    
    // Distinguish between "Network/Auth Error" and "Bucket Not Found/Empty"
    if (error) {
        // If the error implies invalid key or network issue
        if (error.message.includes('Invalid API Key') || error.message.includes('FetchError')) {
            return false;
        }
        // If error is about bucket not found, we are technically connected to Supabase, just not set up.
        // We return true so the UI shows "Connected" (green), but operations will prompt for SQL setup.
    }
    return true;
  } catch {
    return false;
  }
};

// Helper to safely encode filenames for S3/Supabase
const safeEncode = (name: string) => encodeURIComponent(name);
const safeDecode = (name: string) => decodeURIComponent(name);

export const backupToCloud = async (state: AppState, url: string, key: string, customFilename?: string): Promise<{ success: boolean; message: string }> => {
  const client = getSupabase(url, key);
  if (!client) return { success: false, message: '请先配置 Supabase 连接信息' };

  try {
    const rawFileName = customFilename || `backup_${new Date().toISOString().split('T')[0]}.json`;
    // Encode filename to handle Chinese characters and special symbols safely
    const encodedFileName = safeEncode(rawFileName);
    
    const fileBody = JSON.stringify(state);
    
    const { error: uploadError } = await client.storage
      .from('backups')
      .upload(encodedFileName, fileBody, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
        if (uploadError.message.includes('Row-level security policy') || uploadError.message.includes('The resource was not found')) {
            throw new Error('权限不足或存储桶不存在。请在“系统设置”中运行数据库初始化脚本。');
        }
        throw uploadError;
    }

    return { success: true, message: '备份成功！' };
  } catch (error: any) {
    return { success: false, message: error.message || '备份失败' };
  }
};

export const listCloudBackups = async (url: string, key: string): Promise<{ success: boolean; data?: BackupFile[]; message?: string }> => {
  const client = getSupabase(url, key);
  if (!client) return { success: false, message: '未连接' };

  try {
    const { data, error } = await client.storage
      .from('backups')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;
    
    // Decode filenames for display
    const decodedData = data.map((f: any) => ({
        ...f,
        name: safeDecode(f.name)
    }));
    
    return { success: true, data: decodedData as BackupFile[] };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const deleteCloudBackup = async (filename: string, url: string, key: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase(url, key);
    if (!client) return { success: false, message: '未连接' };

    try {
        const encodedName = safeEncode(filename);
        const { error } = await client.storage.from('backups').remove([encodedName]);
        if (error) throw error;
        return { success: true, message: '删除成功' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export const restoreFromCloud = async (url: string, key: string, filename?: string): Promise<{ success: boolean; data?: AppState; message: string }> => {
  const client = getSupabase(url, key);
  if (!client) return { success: false, message: '请先配置 Supabase 连接信息' };

  try {
    let targetFile = filename;

    // If no filename, get latest
    if (!targetFile) {
        const { data: list, error: listError } = await client.storage
        .from('backups')
        .list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

        if (listError) throw listError;
        if (!list || list.length === 0) return { success: false, message: '云端无备份文件' };
        targetFile = safeDecode(list[0].name); // Decode for logic usage
    }

    const encodedTarget = safeEncode(targetFile);

    const { data: fileData, error: downloadError } = await client.storage
      .from('backups')
      .download(encodedTarget);

    if (downloadError) throw downloadError;
    if (!fileData) return { success: false, message: '下载文件为空' };

    const text = await fileData.text();
    const json = JSON.parse(text);
    
    return { success: true, data: json, message: '恢复成功' };

  } catch (error: any) {
    return { success: false, message: error.message || '恢复失败' };
  }
};

export const getDownloadUrl = async (filename: string, url: string, key: string): Promise<string | null> => {
    const client = getSupabase(url, key);
    if (!client) return null;
    const encodedName = safeEncode(filename);
    const { data } = client.storage.from('backups').createSignedUrl(encodedName, 60);
    return data?.signedUrl || null;
};

// --- Gemini Service ---

export const searchParkEvents = async (parkName: string): Promise<AIEvent[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      我需要对中国办公园区"${parkName}"进行竞品分析，请搜索近期的重大事件。
      
      重点关注以下维度：
      1. 大客户入驻或搬离（企业变动）
      2. 园区大宗交易或股权变更
      3. 重要的装修、改造、竣工信息
      4. 区域重大政策变动对该园区的影响
      
      请严格按照以下 JSON 数组格式返回结果，不要包含 Markdown 格式或其他文字：
      [
        {
          "date": "YYYY-MM-DD",
          "title": "事件标题 (简练有力)",
          "description": "事件详情 (30-60字)",
          "source": "信息来源/媒体 (可选)"
        }
      ]
      如果找不到极高相关性的信息，请返回一个空数组 []。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) return [];
        
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Gemini Search Error:", error);
        return [];
    }
}