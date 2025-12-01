import { AppState, Park, SurveyRecord, Building } from './types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 1,
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const sanitizeNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

// Robust data sanitization for imports
export const sanitizeImportedData = (data: any): AppState | null => {
  try {
    if (!data || typeof data !== 'object') return null;

    const parks: Park[] = Array.isArray(data.parks)
      ? data.parks.map((p: any) => ({
          id: p.id || generateId(),
          name: p.name || '未命名园区',
          isMyProject: !!p.isMyProject,
          address: p.address || '',
          // Sanitize new fields
          totalGrossArea: sanitizeNumber(p.totalGrossArea),
          guidancePrice: sanitizeNumber(p.guidancePrice),
          baselineOccupancy: sanitizeNumber(p.baselineOccupancy),
          
          buildings: Array.isArray(p.buildings)
            ? p.buildings.map((b: any) => ({
                id: b.id || generateId(),
                name: b.name || '楼栋',
                totalArea: sanitizeNumber(b.totalArea),
                vacantArea: sanitizeNumber(b.vacantArea),
              }))
            : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
          description: p.description || '',
          lastUpdated: p.lastUpdated || new Date().toISOString(),
        }))
      : [];

    const records: SurveyRecord[] = Array.isArray(data.records)
      ? data.records.map((r: any) => ({
          id: r.id || generateId(),
          parkId: r.parkId || '',
          date: r.date || new Date().toISOString(),
          surveyor: r.surveyor || '',
          buildingName: r.buildingName || '',
          occupancyRate: sanitizeNumber(r.occupancyRate),
          price: sanitizeNumber(r.price),
          commissionPolicy: r.commissionPolicy || '',
          deliveryStandard: r.deliveryStandard || '',
          trend: ['up', 'down', 'flat'].includes(r.trend) ? r.trend : 'flat',
          remarks: r.remarks || '',
        }))
      : [];

    // Preserve existing settings keys if imported data is empty, but here we just return what's in file
    // The merger logic should happen in the component
    const settings = {
        surveyorName: data.settings?.surveyorName || '',
        supabaseUrl: data.settings?.supabaseUrl || '',
        supabaseKey: data.settings?.supabaseKey || '',
    };

    return { parks, records, settings };
  } catch (e) {
    console.error("Sanitization failed", e);
    return null;
  }
};