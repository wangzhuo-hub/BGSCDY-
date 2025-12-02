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
        if (error.message.includes('Invalid API Key') || error.message.includes('FetchError') || error.message.includes('apikey')) {
            return false;
        }
        // If error is about bucket not found, we are technically connected to Supabase service, just need setup.
        // We return true so UI shows "Connected", user can then run SQL script.
    }
    return true;
  } catch {
    return false;
  }
};

// --- Filename Encoding Helpers (Hex Strategy) ---
// Using Hex encoding avoids all issues with URL encoding/decoding of CJK characters on S3-compatible storages.

const toHex = (str: string): string => {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error("Hex encoding failed", e);
    return str.replace(/[^a-zA-Z0-9]/g, '_'); // Fallback
  }
};

const fromHex = (hex: string): string => {
  try {
    // If not valid hex (odd length or non-hex chars), return as is
    if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) return hex;
    
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (e) {
    return hex; // Fallback to original string if decode fails
  }
};

// Encodes "Name.json" -> "HexOfName.json"
const encodeFilename = (filename: string): string => {
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    const name = parts.join('.');
    const encodedName = toHex(name);
    return ext ? `${encodedName}.${ext}` : encodedName;
};

// Decodes "HexOfName.json" -> "Name.json"
const decodeFilename = (encodedFilename: string): string => {
    const parts = encodedFilename.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    const name = parts.join('.');
    const decodedName = fromHex(name);
    // If decode resulted in same string (fallback), implies it wasn't hex, return original
    return ext ? `${decodedName}.${ext}` : decodedName;
};


export const backupToCloud = async (state: AppState, url: string, key: string, customFilename?: string): Promise<{ success: boolean; message: string }> => {
  const client = getSupabase(url, key);
  if (!client) return { success: false, message: '请先配置 Supabase 连接信息' };

  try {
    // 1. Generate Logical Filename (Human Readable)
    const rawFileName = customFilename || `backup_${new Date().toISOString().split('T')[0]}.json`;
    
    // 2. Encode to Safe Key for Storage (Hex)
    const safeStorageKey = encodeFilename(rawFileName);
    
    const fileBody = JSON.stringify(state);
    
    const { error: uploadError } = await client.storage
      .from('backups')
      .upload(safeStorageKey, fileBody, {
        contentType: 'application/json',
        upsert: false, // Snapshot mode: do not overwrite
      });

    if (uploadError) {
        if (uploadError.message.includes('Row-level security') || uploadError.message.includes('not found')) {
            throw new Error('权限不足或存储桶未创建。请在“系统设置”中运行初始化脚本。');
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
        name: decodeFilename(f.name), // Display name
        id: f.name // Store original key (encoded) as ID for operations
    }));
    
    return { success: true, data: decodedData as BackupFile[] };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const deleteCloudBackup = async (fileKey: string, url: string, key: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase(url, key);
    if (!client) return { success: false, message: '未连接' };

    try {
        // fileKey is already the encoded name from the ID field in listCloudBackups
        const { error } = await client.storage.from('backups').remove([fileKey]);
        if (error) throw error;
        return { success: true, message: '删除成功' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export const restoreFromCloud = async (url: string, key: string, fileKey?: string): Promise<{ success: boolean; data?: AppState; message: string }> => {
  const client = getSupabase(url, key);
  if (!client) return { success: false, message: '请先配置 Supabase 连接信息' };

  try {
    let targetKey = fileKey;

    // If no specific file key provided, find the latest
    if (!targetKey) {
        const { data: list, error: listError } = await client.storage
        .from('backups')
        .list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

        if (listError) throw listError;
        if (!list || list.length === 0) return { success: false, message: '云端无备份文件' };
        targetKey = list[0].name; 
    }

    const { data: fileData, error: downloadError } = await client.storage
      .from('backups')
      .download(targetKey!);

    if (downloadError) throw downloadError;
    if (!fileData) return { success: false, message: '下载文件为空' };

    const text = await fileData.text();
    const json = JSON.parse(text);
    
    return { success: true, data: json, message: '恢复成功' };

  } catch (error: any) {
    return { success: false, message: error.message || '恢复失败' };
  }
};

export const getDownloadUrl = async (fileKey: string, url: string, key: string, downloadFilename?: string): Promise<string | null> => {
    const client = getSupabase(url, key);
    if (!client) return null;
    
    // IMPORTANT: Await the promise!
    // We pass 'download' option to force Content-Disposition header with the decoded Chinese filename
    const { data, error } = await client.storage
        .from('backups')
        .createSignedUrl(fileKey, 60, {
            download: downloadFilename || true
        });

    if (error) {
        console.error("Download URL Error:", error);
        return null;
    }
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