import React, { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit2, ChevronRight, X, Search, Save, Calendar, Loader2, TrendingUp, TrendingDown, Minus, Building as BuildingIcon, DollarSign, PieChart, Maximize2, Clock, AlertTriangle, Info, Construction, Image as ImageIcon, Camera, Upload } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Park, SurveyRecord, Building, AIEvent, AppSettings } from '../types';
import { generateId, formatDate, formatMoney } from '../utils';
import { searchParkEvents, uploadSurveyImage } from '../services';

interface ParkManagerProps {
  parks: Park[];
  records: SurveyRecord[];
  settings: AppSettings;
  setParks: (parks: Park[]) => void;
  setRecords: (records: SurveyRecord[]) => void;
}

const ParkManager: React.FC<ParkManagerProps> = ({ parks, records, settings, setParks, setRecords }) => {
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  
  // --- Selected Park Logic ---
  const selectedPark = parks.find(p => p.id === selectedParkId);
  const parkRecords = records
    .filter(r => r.parkId === selectedParkId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // --- Statistics Logic ---
  const stats = useMemo(() => {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    
    const countInPeriod = (daysStart: number, daysEnd: number) => {
      const startDate = new Date(now.getTime() - daysStart * oneDay);
      const endDate = new Date(now.getTime() - daysEnd * oneDay); // daysEnd is smaller (closer to now)
      return records.filter(r => {
        const d = new Date(r.date);
        return d >= startDate && d <= endDate;
      }).length;
    };

    const calcMetric = (days: number) => {
      const current = countInPeriod(days, 0);
      const previous = countInPeriod(days * 2, days);
      const diff = current - previous;
      const percent = previous === 0 ? (current > 0 ? 100 : 0) : (diff / previous) * 100;
      return { current, diff, percent };
    };

    return {
      week: calcMetric(7),
      month: calcMetric(30),
      quarter: calcMetric(90)
    };
  }, [records]);

  // --- Handlers ---
  const handleSavePark = (park: Park) => {
    if (parks.find(p => p.id === park.id)) {
      setParks(parks.map(p => p.id === park.id ? park : p));
    } else {
      setParks([...parks, park]);
    }
    setIsEditModalOpen(false);
  };

  const handleDeletePark = (id: string) => {
    if (confirm('确定要删除该园区吗？相关的调研记录也会被删除。')) {
      setParks(parks.filter(p => p.id !== id));
      setRecords(records.filter(r => r.parkId !== id));
      if (selectedParkId === id) setSelectedParkId(null);
    }
  };

  const renderStatCard = (title: string, data: { current: number, diff: number, percent: number }) => {
      const isUp = data.diff > 0;
      const isFlat = data.diff === 0;
      
      return (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1">
              <div className="text-xs text-slate-500 font-medium mb-1">{title}</div>
              <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-slate-800">{data.current} <span className="text-xs font-normal text-slate-400">次</span></div>
                  <div className={`flex items-center text-xs font-medium ${isUp ? 'text-red-500' : isFlat ? 'text-slate-400' : 'text-emerald-500'}`}>
                      {isUp ? <TrendingUp size={14} className="mr-1"/> : isFlat ? <Minus size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
                      {isUp ? '+' : ''}{data.diff} ({Math.abs(data.percent).toFixed(0)}%)
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col gap-6 max-w-7xl mx-auto">
      
      {/* Top Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4">
          {renderStatCard('近1周调研', stats.week)}
          {renderStatCard('近1个月调研', stats.month)}
          {renderStatCard('近3个月调研', stats.quarter)}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Left List - Split by Type */}
        <div className={`w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col ${selectedParkId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
            <h3 className="font-bold text-slate-700">园区列表</h3>
            <button 
                onClick={() => { setSelectedParkId(null); setIsEditModalOpen(true); }}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
                <Plus size={18} />
            </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* My Projects */}
                <div>
                    <h4 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">本案项目</h4>
                    {parks.filter(p => p.isMyProject).map(park => {
                         const parkRecs = records.filter(r => r.parkId === park.id);
                         const lastRec = parkRecs.length > 0 
                            ? parkRecs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                            : null;
                         return (
                            <ParkCard 
                                key={park.id} 
                                park={park} 
                                isActive={selectedParkId === park.id} 
                                onClick={() => setSelectedParkId(park.id)} 
                                lastUpdate={lastRec?.date}
                            />
                         );
                    })}
                    {parks.filter(p => p.isMyProject).length === 0 && <p className="px-4 text-xs text-slate-400">暂无本案项目</p>}
                </div>
                {/* Active Competitors (Stock) */}
                <div>
                    <h4 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4">存量竞品</h4>
                    {parks.filter(p => !p.isMyProject && !p.isUpcoming).map(park => {
                         const parkRecs = records.filter(r => r.parkId === park.id);
                         const lastRec = parkRecs.length > 0 
                            ? parkRecs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                            : null;
                         return (
                            <ParkCard 
                                key={park.id} 
                                park={park} 
                                isActive={selectedParkId === park.id} 
                                onClick={() => setSelectedParkId(park.id)} 
                                lastUpdate={lastRec?.date}
                            />
                         );
                    })}
                </div>
                
                {/* Upcoming Projects */}
                <div>
                    <h4 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4 flex items-center gap-2">
                        <Construction size={12}/> 即将入市 / 未来供应
                    </h4>
                    {parks.filter(p => !p.isMyProject && p.isUpcoming).map(park => {
                         const parkRecs = records.filter(r => r.parkId === park.id);
                         const lastRec = parkRecs.length > 0 
                            ? parkRecs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                            : null;
                         return (
                            <ParkCard 
                                key={park.id} 
                                park={park} 
                                isActive={selectedParkId === park.id} 
                                onClick={() => setSelectedParkId(park.id)} 
                                lastUpdate={lastRec?.date}
                            />
                         );
                    })}
                     {parks.filter(p => !p.isMyProject && p.isUpcoming).length === 0 && <p className="px-4 text-xs text-slate-400 italic mt-1">暂无未来供应数据</p>}
                </div>
            </div>
        </div>

        {/* Right Detail */}
        <div className={`w-full md:w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 flex-col overflow-hidden ${selectedParkId ? 'flex' : 'hidden md:flex'}`}>
            {selectedPark ? (
                <ParkDetail 
                    park={selectedPark} 
                    records={parkRecords}
                    allRecords={records}
                    settings={settings}
                    onEdit={() => setIsEditModalOpen(true)}
                    onDelete={() => handleDeletePark(selectedPark.id)}
                    onBack={() => setSelectedParkId(null)}
                    onUpdateRecords={setRecords}
                    onViewImage={setViewerImage}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                    <BuildingIcon size={64} className="mb-4 text-slate-200" />
                    <p>选择左侧园区查看详细调研档案</p>
                </div>
            )}
        </div>
      </div>

      {isEditModalOpen && (
        <ParkFormModal 
          initialData={selectedParkId ? selectedPark : undefined} 
          onClose={() => setIsEditModalOpen(false)} 
          onSave={handleSavePark} 
        />
      )}

      {/* Image Viewer Overlay */}
      {viewerImage && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setViewerImage(null)}>
              <button className="absolute top-4 right-4 text-white hover:text-slate-300">
                  <X size={32}/>
              </button>
              <img src={viewerImage} alt="Large view" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          </div>
      )}
    </div>
  );
};

// --- Sub-Components ---

const ParkCard: React.FC<{ park: Park, isActive: boolean, onClick: () => void, lastUpdate?: string }> = ({ park, isActive, onClick, lastUpdate }) => {
    // Check if stale (older than 30 days)
    const isStale = useMemo(() => {
        if (!lastUpdate) return false;
        const diffTime = Math.abs(new Date().getTime() - new Date(lastUpdate).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 30;
    }, [lastUpdate]);

    return (
        <div 
            onClick={onClick}
            className={`p-4 rounded-lg cursor-pointer border transition-all relative ${
                isActive 
                ? 'bg-blue-50 border-blue-200 shadow-inner' 
                : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'
            }`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h4 className={`font-semibold ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>{park.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{park.address || '地址未填'}</p>
                </div>
                {park.isMyProject && <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-bold">本案</span>}
                {park.isUpcoming && !park.isMyProject && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold">即将入市</span>}
            </div>
            
            {/* Key Metrics in Card */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dashed border-slate-100">
                <div className="text-center">
                    <div className="text-[10px] text-slate-400">{park.isUpcoming ? '预租报价' : '租金'}</div>
                    <div className="text-xs font-medium text-slate-700">{park.guidancePrice ? `¥${park.guidancePrice}` : '-'}</div>
                </div>
                <div className="text-center">
                    <div className="text-[10px] text-slate-400">面积</div>
                    <div className="text-xs font-medium text-slate-700">{park.totalGrossArea ? Math.round(park.totalGrossArea/10000)+'万㎡' : '-'}</div>
                </div>
                <div className="text-center">
                    <div className="text-[10px] text-slate-400">出租率</div>
                    <div className={`text-xs font-medium ${park.baselineOccupancy && park.baselineOccupancy > 85 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {park.baselineOccupancy ? park.baselineOccupancy+'%' : '-'}
                    </div>
                </div>
            </div>

            <div className="mt-2 flex gap-1 overflow-hidden">
                {park.tags.slice(0,2).map((t, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate">{t}</span>
                ))}
            </div>

            {/* Update Status */}
            <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px]">
                {lastUpdate ? (
                    isStale ? (
                        <span className="flex items-center gap-1 text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} /> 30+天未更新
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                            <Clock size={10} /> {formatDate(lastUpdate)}
                        </span>
                    )
                ) : (
                    <span className="flex items-center gap-1 text-slate-300">
                        <Clock size={10} /> 暂无调研
                    </span>
                )}
            </div>
        </div>
    );
};

const ParkDetail = ({ park, records, allRecords, settings, onEdit, onDelete, onBack, onUpdateRecords, onViewImage }: any) => {
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<SurveyRecord | undefined>(undefined);
    const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);

    const handleSearchAI = async () => {
        setLoadingAI(true);
        try {
            const events = await searchParkEvents(park.name);
            setAiEvents(events);
        } catch (e) {
            alert('搜索失败: ' + (e as Error).message);
        } finally {
            setLoadingAI(false);
        }
    };

    const handleSaveRecord = (rec: SurveyRecord) => {
        const newAll = editingRecord 
            ? allRecords.map((r: SurveyRecord) => r.id === rec.id ? rec : r)
            : [...allRecords, rec];
        onUpdateRecords(newAll);
        setIsRecordModalOpen(false);
    };

    // Prepare Chart Data
    const chartData = records.map((r: SurveyRecord) => ({
        date: formatDate(r.date),
        price: r.price,
        occupancy: r.occupancyRate
    }));

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <button onClick={onBack} className="md:hidden text-slate-500 mb-2 flex items-center text-sm"><ChevronRight className="rotate-180 mr-1" size={14}/>返回列表</button>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            {park.name}
                            {park.isMyProject && <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">本案</span>}
                            {park.isUpcoming && <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"><Construction size={10}/>即将入市</span>}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">{park.address}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onEdit} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Edit2 size={18} /></button>
                        <button onClick={onDelete} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></button>
                    </div>
                </div>
                
                {/* Header Metrics */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><DollarSign size={16}/></div>
                        <div>
                            <div className="text-xs text-slate-500">{park.isUpcoming ? '指导/预租报价' : '指导租金'}</div>
                            <div className="font-bold text-slate-800">{park.guidancePrice ? formatMoney(park.guidancePrice) : '-'}</div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                         <div className="p-2 bg-purple-100 text-purple-600 rounded-full"><Maximize2 size={16}/></div>
                        <div>
                            <div className="text-xs text-slate-500">总建筑面积</div>
                            <div className="font-bold text-slate-800">{park.totalGrossArea ? park.totalGrossArea.toLocaleString() + ' ㎡' : '-'}</div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                         <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><PieChart size={16}/></div>
                        <div>
                            <div className="text-xs text-slate-500">{park.isUpcoming ? '当前预租率' : '当前出租率'}</div>
                            <div className="font-bold text-slate-800">{park.baselineOccupancy ? park.baselineOccupancy + '%' : '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Stats Chart */}
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-500"/> 历史走势
                    </h3>
                    {records.length > 0 ? (
                        <div className="h-64 bg-slate-50 rounded-lg border border-slate-100 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                                    <YAxis yAxisId="left" tick={{fontSize: 12}} />
                                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} unit="%" />
                                    <Tooltip />
                                    <Line yAxisId="left" type="monotone" dataKey="price" stroke="#3b82f6" name="租金" strokeWidth={2} />
                                    <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#10b981" name="出租率" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-32 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 text-sm">暂无历史数据，请添加调研记录</div>
                    )}
                </div>

                {/* AI Search */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Search size={20} className="text-purple-500"/> AI 大事件监测
                        </h3>
                        <button 
                            onClick={handleSearchAI} 
                            disabled={loadingAI}
                            className="text-xs bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                        >
                            {loadingAI ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>} 
                            AI 一键搜索大事件
                        </button>
                    </div>
                    {aiEvents.length > 0 ? (
                         <div className="relative border-l-2 border-purple-200 ml-3 space-y-6 pb-2">
                            {aiEvents.map((event, idx) => (
                                <div key={idx} className="ml-6 relative">
                                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-purple-500 border-2 border-white"></span>
                                    <span className="text-xs text-purple-600 font-mono bg-purple-50 px-1 rounded">{event.date}</span>
                                    <h4 className="font-bold text-slate-800 mt-1">{event.title}</h4>
                                    <p className="text-sm text-slate-600 mt-1">{event.description}</p>
                                    {event.source && <p className="text-xs text-slate-400 mt-1 italic">来源: {event.source}</p>}
                                </div>
                            ))}
                         </div>
                    ) : (
                        <div className="bg-gradient-to-r from-purple-50 to-white rounded-lg p-6 text-center border border-purple-100 border-dashed">
                             <p className="text-slate-600 font-medium mb-1">挖掘{park.name}的近期动向</p>
                             <p className="text-xs text-slate-400 mb-3">支持搜索：入驻企业、装修动态、政策变更、大客户签约等</p>
                             {!loadingAI && <button onClick={handleSearchAI} className="text-purple-600 text-sm hover:underline">点击开始搜索</button>}
                             {loadingAI && <span className="text-purple-600 text-sm flex items-center justify-center gap-1"><Loader2 size={12} className="animate-spin"/> 分析全网资讯中...</span>}
                        </div>
                    )}
                </div>

                {/* Survey Records Table */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Calendar size={20} className="text-orange-500"/> 调研记录
                        </h3>
                        <button onClick={() => { setEditingRecord(undefined); setIsRecordModalOpen(true); }} className="text-sm text-blue-600 hover:underline">+ 新增调研</button>
                    </div>
                    <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2">日期</th>
                                    <th className="px-4 py-2">单价</th>
                                    <th className="px-4 py-2">出租率</th>
                                    <th className="px-4 py-2">照片</th>
                                    <th className="px-4 py-2">政策</th>
                                    <th className="px-4 py-2">备注</th>
                                    <th className="px-4 py-2 w-16">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map(rec => (
                                    <tr key={rec.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2">{formatDate(rec.date)}</td>
                                        <td className="px-4 py-2 font-medium">{formatMoney(rec.price)}</td>
                                        <td className="px-4 py-2">{rec.occupancyRate}%</td>
                                        <td className="px-4 py-2">
                                            {rec.images && rec.images.length > 0 ? (
                                                <div className="flex -space-x-2">
                                                    {rec.images.slice(0, 3).map((img, idx) => (
                                                        <img 
                                                            key={idx} 
                                                            src={img} 
                                                            onClick={(e) => { e.stopPropagation(); onViewImage(img); }}
                                                            className="w-8 h-8 rounded-full border-2 border-white object-cover cursor-pointer hover:z-10 transition-transform hover:scale-110" 
                                                            alt="调研照片"
                                                        />
                                                    ))}
                                                    {rec.images.length > 3 && (
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-500">
                                                            +{rec.images.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300"><ImageIcon size={16}/></span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 max-w-[120px] truncate">{rec.commissionPolicy}</td>
                                        <td className="px-4 py-2 max-w-[150px] truncate text-slate-500">{rec.remarks}</td>
                                        <td className="px-4 py-2">
                                            <button onClick={() => { setEditingRecord(rec); setIsRecordModalOpen(true); }} className="text-slate-400 hover:text-blue-600">
                                                <Edit2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {records.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">暂无记录</div>}
                    </div>
                </div>
            </div>

            {isRecordModalOpen && (
                <RecordFormModal
                    parkId={park.id}
                    initialData={editingRecord}
                    defaultSurveyor={settings.surveyorName}
                    buildings={park.buildings}
                    supabaseSettings={{ url: settings.supabaseUrl, key: settings.supabaseKey }}
                    onClose={() => setIsRecordModalOpen(false)}
                    onSave={handleSaveRecord}
                />
            )}
        </div>
    );
};

// --- Modals ---

const ParkFormModal = ({ initialData, onClose, onSave }: any) => {
    const [formData, setFormData] = useState<Park>(initialData || {
        id: generateId(),
        name: '',
        isMyProject: false,
        isUpcoming: false,
        address: '',
        totalGrossArea: 0,
        guidancePrice: 0,
        baselineOccupancy: 0,
        buildings: [],
        tags: [],
        description: ''
    });
    const [newTag, setNewTag] = useState('');

    const addBuilding = () => {
        setFormData({
            ...formData,
            buildings: [...formData.buildings, { 
                id: generateId(), 
                name: `楼栋${formData.buildings.length + 1}`, 
                totalArea: 0, 
                vacantArea: 0,
                guidancePrice: 0,
                targetOccupancy: 100 
            }]
        });
    };

    const updateBuilding = (index: number, field: keyof Building, val: any) => {
        const newBuildings = [...formData.buildings];
        newBuildings[index] = { ...newBuildings[index], [field]: val };
        
        // Auto-calculate vacantArea if totalArea or targetOccupancy changes
        if (field === 'totalArea' || field === 'targetOccupancy') {
            const area = field === 'totalArea' ? val : newBuildings[index].totalArea;
            const occ = field === 'targetOccupancy' ? val : (newBuildings[index].targetOccupancy || 0);
            
            if (area > 0 && occ >= 0) {
                const calculatedVacancy = area * (1 - occ / 100);
                newBuildings[index].vacantArea = Math.round(calculatedVacancy);
            }
        }

        setFormData({ ...formData, buildings: newBuildings });
    };

    const removeBuilding = (index: number) => {
        setFormData({ ...formData, buildings: formData.buildings.filter((_, i) => i !== index) });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h3 className="text-xl font-bold">{initialData ? '编辑园区' : '新增园区'}</h3>
                    <button onClick={onClose}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block col-span-2">
                            <span className="text-sm font-medium text-slate-700">园区名称 <span className="text-red-500">*</span></span>
                            <input 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="请输入园区全称"
                            />
                        </label>
                         <label className="block col-span-2">
                            <span className="text-sm font-medium text-slate-700">地址</span>
                            <input 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" 
                                value={formData.address}
                                onChange={e => setFormData({...formData, address: e.target.value})}
                            />
                        </label>
                        
                        {/* Flags */}
                        <div className="flex items-center gap-2 mt-2 col-span-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <input 
                                type="checkbox" 
                                id="isMyProject" 
                                checked={formData.isMyProject} 
                                onChange={e => setFormData({...formData, isMyProject: e.target.checked})}
                                className="w-5 h-5 text-blue-600 rounded"
                            />
                            <label htmlFor="isMyProject" className="text-sm font-bold text-slate-700 cursor-pointer select-none ml-2">本案项目</label>
                        </div>
                        <div className="flex items-center gap-2 mt-2 col-span-1 bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <input 
                                type="checkbox" 
                                id="isUpcoming" 
                                checked={formData.isUpcoming} 
                                onChange={e => setFormData({...formData, isUpcoming: e.target.checked})}
                                className="w-5 h-5 text-amber-600 rounded"
                            />
                            <label htmlFor="isUpcoming" className="text-sm font-bold text-slate-700 cursor-pointer select-none ml-2">即将入市 (未来供应)</label>
                        </div>
                    </div>
                    
                    {/* Key Metrics Inputs */}
                    <div className="grid grid-cols-3 gap-4 border-t border-b border-slate-100 py-4">
                        <label className="block">
                            <span className="text-xs font-bold text-slate-600">整体指导租金 (元/㎡/天)</span>
                            <input 
                                type="number" step="0.1"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm" 
                                value={formData.guidancePrice || ''}
                                onChange={e => setFormData({...formData, guidancePrice: parseFloat(e.target.value)})}
                                placeholder="0.0"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-slate-600">园区总建筑面积 (㎡)</span>
                            <input 
                                type="number" 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm" 
                                value={formData.totalGrossArea || ''}
                                onChange={e => setFormData({...formData, totalGrossArea: parseFloat(e.target.value)})}
                                placeholder="0"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-slate-600">整体基准出租率 (%)</span>
                            <input 
                                type="number" step="0.1" max="100"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm" 
                                value={formData.baselineOccupancy || ''}
                                onChange={e => setFormData({...formData, baselineOccupancy: parseFloat(e.target.value)})}
                                placeholder="0"
                            />
                        </label>
                    </div>

                    {/* Tags */}
                    <div>
                         <span className="text-sm font-medium text-slate-700">佣金/政策标签</span>
                         <div className="flex flex-wrap gap-2 mt-2 mb-2">
                            {formData.tags.map((tag, i) => (
                                <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm flex items-center">
                                    {tag}
                                    <button onClick={() => setFormData({...formData, tags: formData.tags.filter((_, idx) => idx !== i)})} className="ml-1 hover:text-blue-900">×</button>
                                </span>
                            ))}
                         </div>
                         <div className="flex gap-2">
                             <input 
                                value={newTag} onChange={e => setNewTag(e.target.value)} 
                                className="border rounded px-2 py-1 text-sm flex-1" placeholder="如：2.5个月佣金"
                                onKeyDown={e => {
                                    if(e.key === 'Enter') {
                                        e.preventDefault();
                                        if(newTag.trim()) {
                                            setFormData({...formData, tags: [...formData.tags, newTag.trim()]});
                                            setNewTag('');
                                        }
                                    }
                                }}
                             />
                             <button type="button" onClick={() => {
                                 if(newTag.trim()) {
                                     setFormData({...formData, tags: [...formData.tags, newTag.trim()]});
                                     setNewTag('');
                                 }
                             }} className="text-sm bg-slate-200 px-3 py-1 rounded hover:bg-slate-300">添加</button>
                         </div>
                    </div>

                    {/* Buildings Section */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                         <div className="flex justify-between items-center mb-3">
                             <div>
                                 <h4 className="font-bold text-slate-700 flex items-center gap-2"><BuildingIcon size={16}/> 楼栋明细</h4>
                                 <p className="text-xs text-slate-500">请详细录入各楼栋指标，用于精确测算去化压力</p>
                             </div>
                             <button type="button" onClick={addBuilding} className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-50 shadow-sm font-medium transition-colors">
                                 + 新增楼栋
                             </button>
                         </div>
                         
                         {/* Header Row */}
                         <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 mb-2 px-1">
                             <div className="col-span-3">楼栋号/名称 *</div>
                             <div className="col-span-2 text-center">总面积(㎡) *</div>
                             <div className="col-span-2 text-center">指导租金(元)</div>
                             <div className="col-span-2 text-center">预计出租率(%)</div>
                             <div className="col-span-2 text-center">空置(㎡)</div>
                             <div className="col-span-1"></div>
                         </div>

                         <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                             {formData.buildings.map((b, i) => (
                                 <div key={b.id} className="grid grid-cols-12 gap-2 items-center text-sm bg-white p-2 rounded border border-slate-200 shadow-sm">
                                     <div className="col-span-3">
                                        <input 
                                            value={b.name} 
                                            onChange={e => updateBuilding(i, 'name', e.target.value)} 
                                            className="w-full border-b border-dashed border-slate-300 focus:border-blue-500 outline-none px-1 py-1" 
                                            placeholder="楼栋名"
                                        />
                                     </div>
                                     <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={b.totalArea || ''} 
                                            onChange={e => updateBuilding(i, 'totalArea', parseFloat(e.target.value))} 
                                            className="w-full text-center bg-slate-50 rounded px-1 py-1 text-xs" 
                                            placeholder="0"
                                        />
                                     </div>
                                     <div className="col-span-2">
                                        <input 
                                            type="number" step="0.1"
                                            value={b.guidancePrice || ''} 
                                            onChange={e => updateBuilding(i, 'guidancePrice', parseFloat(e.target.value))} 
                                            className="w-full text-center bg-slate-50 rounded px-1 py-1 text-xs" 
                                            placeholder="0.0"
                                        />
                                     </div>
                                     <div className="col-span-2 relative">
                                        <input 
                                            type="number" max="100"
                                            value={b.targetOccupancy || ''} 
                                            onChange={e => updateBuilding(i, 'targetOccupancy', parseFloat(e.target.value))} 
                                            className="w-full text-center bg-slate-50 rounded px-1 py-1 text-xs" 
                                            placeholder="100"
                                        />
                                     </div>
                                     <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={b.vacantArea || ''} 
                                            onChange={e => updateBuilding(i, 'vacantArea', parseFloat(e.target.value))} 
                                            className="w-full text-center bg-orange-50 text-orange-600 font-medium rounded px-1 py-1 text-xs" 
                                            placeholder="自动计算"
                                        />
                                     </div>
                                     <div className="col-span-1 text-right">
                                        <button onClick={() => removeBuilding(i)} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16}/></button>
                                     </div>
                                 </div>
                             ))}
                             {formData.buildings.length === 0 && (
                                 <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                     <p className="text-xs text-slate-400">暂无楼栋数据，请点击上方按钮添加</p>
                                 </div>
                             )}
                         </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                    <button onClick={() => onSave(formData)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2">
                        <Save size={18} /> 保存档案
                    </button>
                </div>
            </div>
        </div>
    );
};

const RecordFormModal = ({ parkId, initialData, defaultSurveyor, buildings, supabaseSettings, onClose, onSave }: any) => {
    const [formData, setFormData] = useState<SurveyRecord>(initialData || {
        id: generateId(),
        parkId,
        date: new Date().toISOString().split('T')[0],
        surveyor: defaultSurveyor,
        buildingName: '',
        occupancyRate: 0,
        price: 0,
        commissionPolicy: '',
        deliveryStandard: '',
        trend: 'flat',
        remarks: '',
        images: []
    });
    
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const newImages = [...(formData.images || [])];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const { success, url, message } = await uploadSurveyImage(file, supabaseSettings.url, supabaseSettings.key);
            
            if (success && url) {
                newImages.push(url);
            } else {
                alert(`上传 ${file.name} 失败: ${message}`);
            }
        }
        
        setFormData({ ...formData, images: newImages });
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        const newImages = [...(formData.images || [])];
        newImages.splice(index, 1);
        setFormData({ ...formData, images: newImages });
    };

    return (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                    <h3 className="font-bold">{initialData ? '编辑记录' : '新增调研记录'}</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs text-slate-500">调研日期</span>
                            <input type="date" value={formData.date.split('T')[0]} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border rounded p-2 mt-1"/>
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-500">负责人</span>
                            <input value={formData.surveyor} onChange={e => setFormData({...formData, surveyor: e.target.value})} className="w-full border rounded p-2 mt-1"/>
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <label className="block">
                            <span className="text-xs text-slate-500">租金 (元/㎡/天)</span>
                            <input type="number" step="0.1" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full border rounded p-2 mt-1"/>
                        </label>
                         <label className="block">
                            <span className="text-xs text-slate-500">出租率 (%)</span>
                            <input type="number" step="1" max="100" value={formData.occupancyRate} onChange={e => setFormData({...formData, occupancyRate: parseFloat(e.target.value)})} className="w-full border rounded p-2 mt-1"/>
                        </label>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">市场趋势判断</label>
                        <div className="flex gap-4">
                            {[ {v:'up', l:'上涨', c:'text-red-500'}, {v:'flat', l:'持平', c:'text-slate-500'}, {v:'down', l:'下跌', c:'text-green-500'} ].map(opt => (
                                <label key={opt.v} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" checked={formData.trend === opt.v} onChange={() => setFormData({...formData, trend: opt.v as any})} />
                                    <span className={opt.c}>{opt.l}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <label className="block">
                        <span className="text-xs text-slate-500">佣金政策</span>
                        <input value={formData.commissionPolicy} onChange={e => setFormData({...formData, commissionPolicy: e.target.value})} className="w-full border rounded p-2 mt-1" placeholder="如：2.4+2"/>
                    </label>
                    
                    {/* Image Upload Section */}
                    <div>
                        <span className="text-xs text-slate-500 block mb-2">现场照片</span>
                        <div className="grid grid-cols-4 gap-2">
                            {formData.images?.map((url, index) => (
                                <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                                    <img src={url} alt={`img-${index}`} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <X size={12}/>
                                    </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors bg-slate-50"
                            >
                                {isUploading ? <Loader2 size={20} className="animate-spin"/> : <Camera size={20}/>}
                                <span className="text-[10px] mt-1">{isUploading ? '上传中' : '添加照片'}</span>
                            </button>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            multiple 
                            className="hidden" 
                        />
                        <p className="text-[10px] text-slate-400 mt-1">需先连接云端并在“系统设置”初始化存储桶才能上传</p>
                    </div>

                    <label className="block">
                        <span className="text-xs text-slate-500">备注</span>
                        <textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="w-full border rounded p-2 mt-1" rows={3}/>
                    </label>
                </div>
                 <div className="p-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600">取消</button>
                    <button onClick={() => onSave(formData)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">保存</button>
                </div>
            </div>
        </div>
    );
}

export default ParkManager;