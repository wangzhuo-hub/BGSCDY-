export interface Building {
  id: string;
  name: string;
  totalArea: number;
  vacantArea: number;
}

export interface SurveyRecord {
  id: string;
  parkId: string;
  date: string;
  surveyor: string;
  buildingName?: string;
  occupancyRate: number; // 0-100
  price: number; // RMB/sqm/day
  commissionPolicy: string;
  deliveryStandard: string;
  trend: 'up' | 'down' | 'flat';
  remarks: string;
}

export interface Park {
  id: string;
  name: string;
  isMyProject: boolean;
  address?: string;
  
  // 新增关键维度
  totalGrossArea?: number; // 总建筑面积 (GFA)
  guidancePrice?: number;  // 指导租金/当前均价
  baselineOccupancy?: number; // 当前/基准出租率

  buildings: Building[];
  tags: string[]; // e.g., Commission policies
  description?: string;
  lastUpdated?: string;
}

export interface AppSettings {
  surveyorName: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export interface AppState {
  parks: Park[];
  records: SurveyRecord[];
  settings: AppSettings;
}

export type ViewMode = 'dashboard' | 'parks' | 'settings';

export interface AIEvent {
  date: string;
  title: string;
  description: string;
  source?: string;
}

export interface BackupFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: {
    size: number;
    mimetype: string;
  };
}