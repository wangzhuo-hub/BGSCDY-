import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ComposedChart, Line, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Calendar } from 'lucide-react';
import { Park, SurveyRecord } from '../types';
import { formatMoney } from '../utils';

interface DashboardProps {
  parks: Park[];
  records: SurveyRecord[];
}

const Dashboard: React.FC<DashboardProps> = ({ parks, records }) => {
  // --- Data Processing ---
  const myPark = parks.find(p => p.isMyProject);
  const competitors = parks.filter(p => !p.isMyProject);

  // Helper: Get statistics for all competitors at a specific point in time
  const getMarketStatsAtDate = (targetDate: Date) => {
    let totalPrice = 0;
    let totalOccupancy = 0;
    let count = 0;
    let totalVacantArea = 0;

    competitors.forEach(comp => {
      // Find the latest record on or before targetDate
      const rec = records
        .filter(r => r.parkId === comp.id && new Date(r.date) <= targetDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (rec) {
        totalPrice += rec.price;
        totalOccupancy += rec.occupancyRate;
        count++;

        // Calculate Vacancy: Prioritize (TotalGrossArea * (1 - Rate)), fallback to static building vacancy
        if (comp.totalGrossArea && comp.totalGrossArea > 0) {
            totalVacantArea += comp.totalGrossArea * (1 - rec.occupancyRate / 100);
        } else {
            // Fallback to static sum if GFA is missing
            totalVacantArea += comp.buildings.reduce((sum, b) => sum + b.vacantArea, 0);
        }
      }
    });

    return {
      avgPrice: count ? totalPrice / count : 0,
      avgOccupancy: count ? totalOccupancy / count : 0,
      totalVacant: totalVacantArea,
      validSample: count
    };
  };

  // 1. Current Stats (Now)
  const currentStats = useMemo(() => getMarketStatsAtDate(new Date()), [parks, records]);
  
  // 2. Historical Stats for Comparison
  const historyStats = useMemo(() => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastQuarterDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

    return {
        lastMonth: getMarketStatsAtDate(lastMonthDate),
        lastQuarter: getMarketStatsAtDate(lastQuarterDate)
    };
  }, [parks, records]);

  // 3. Trend Data (Last 6 Months)
  const trendData = useMemo(() => {
      const data = [];
      const now = new Date();
      // Generate last 6 months
      for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          // Set to end of that month to capture full month's data state
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          
          const stats = getMarketStatsAtDate(endOfMonth);
          data.push({
              name: `${d.getMonth() + 1}月`,
              fullDate: d.toISOString(),
              price: Number(stats.avgPrice.toFixed(1)),
              occupancy: Number(stats.avgOccupancy.toFixed(1)),
              vacancy: Math.round(stats.totalVacant)
          });
      }
      return data;
  }, [parks, records]);


  // My Project Latest Record
  const myRecord = useMemo(() => {
      if (!myPark) return null;
      return records
        .filter(r => r.parkId === myPark.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [myPark, records]);

  const myStats = useMemo(() => {
    if (!myPark) return { vacant: 0 };
    // Try to calc from GFA first for consistency
    if (myPark.totalGrossArea && myRecord) {
        return { vacant: myPark.totalGrossArea * (1 - myRecord.occupancyRate / 100) };
    }
    return {
      vacant: myPark.buildings.reduce((sum, b) => sum + b.vacantArea, 0)
    };
  }, [myPark, myRecord]);

  // --- Charts Data (Comparison) ---
  const priceData = [
    { name: '本案项目', value: myRecord?.price || 0, type: 'mine' },
    { name: '竞品平均', value: currentStats.avgPrice, type: 'comp' }
  ];

  const occupancyData = [
    { name: '本案项目', value: myRecord?.occupancyRate || 0, type: 'mine' },
    { name: '竞品平均', value: currentStats.avgOccupancy, type: 'comp' }
  ];

  // --- Policy Trends ---
  const topPolicies = useMemo(() => {
    const counts: Record<string, number> = {};
    parks.forEach(p => p.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [parks]);

  // --- Render Helpers ---
  const renderDiff = (mine: number, comp: number, isPercent = false, inverseColor = false) => {
    const diff = mine - comp;
    if (Math.abs(diff) < 0.01) return <span className="text-slate-400 flex items-center text-xs ml-auto"><Minus size={12} /> 持平</span>;
    const isPositive = diff > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    
    // Default: Green is Good (High Price, High Occ). Red is Bad.
    // Inverse: High Vacancy is Bad (Red), Low Vacancy is Good (Green).
    let colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
    if (inverseColor) {
        colorClass = isPositive ? 'text-rose-600' : 'text-emerald-600';
    }

    return (
      <span className={`${colorClass} flex items-center gap-1 text-xs font-medium ml-auto`}>
        <Icon size={12} />
        {isPositive ? '+' : ''}{isPercent ? diff.toFixed(1) + '%' : diff.toFixed(1)}
      </span>
    );
  };

  const renderTrendChange = (current: number, prev: number, label: string) => {
      const diff = current - prev;
      const isUp = diff > 0;
      const color = isUp ? 'text-rose-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400';
      return (
          <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500">{label}</span>
              <span className={`flex items-center ${color}`}>
                  {diff !== 0 ? (isUp ? <TrendingUp size={10} className="mr-0.5"/> : <TrendingDown size={10} className="mr-0.5"/>) : <Minus size={10} className="mr-0.5"/>}
                  {Math.abs(Math.round(diff)).toLocaleString()} ㎡
              </span>
          </div>
      )
  };

  if (!myPark) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
        <AlertCircle size={48} className="mb-4 text-blue-400" />
        <p className="text-lg">请先在“园区档案”中添加并标记您的【本案项目】</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">市场概览 Dashboard</h2>
        <p className="text-slate-500 text-sm">数据截止: {new Date().toLocaleDateString('zh-CN')}</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Left: My Project, Right: Market Avg */}
        
        {/* Price Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium mb-4">平均租金 (元/㎡/天)</h3>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">本案</p>
              <div className="text-3xl font-bold text-slate-900">{formatMoney(myRecord?.price || 0)}</div>
            </div>
            <div className="h-12 w-px bg-slate-200 mx-4"></div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">竞品平均</p>
              <div className="text-2xl font-semibold text-slate-600">{formatMoney(currentStats.avgPrice)}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
             <span className="text-xs text-slate-400">对比差距</span>
             {renderDiff(myRecord?.price || 0, currentStats.avgPrice)}
          </div>
        </div>

        {/* Occupancy Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium mb-4">出租率 (%)</h3>
           <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">本案</p>
              <div className="text-3xl font-bold text-slate-900">{(myRecord?.occupancyRate || 0).toFixed(1)}%</div>
            </div>
            <div className="h-12 w-px bg-slate-200 mx-4"></div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">竞品平均</p>
              <div className="text-2xl font-semibold text-slate-600">{currentStats.avgOccupancy.toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
             <span className="text-xs text-slate-400">对比差距</span>
             {renderDiff(myRecord?.occupancyRate || 0, currentStats.avgOccupancy, true)}
          </div>
        </div>

        {/* Vacancy Card (Enhanced) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <h3 className="text-slate-500 text-sm font-medium mb-4 flex justify-between">
              空置库存 (㎡)
              <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">动态计算</span>
          </h3>
           <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">本案空置</p>
              <div className="text-2xl font-bold text-slate-900">{Math.round(myStats.vacant).toLocaleString()}</div>
            </div>
            <div className="h-10 w-px bg-slate-200 mx-4"></div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">竞品总空置</p>
              <div className="text-2xl font-semibold text-slate-600">{Math.round(currentStats.totalVacant).toLocaleString()}</div>
            </div>
          </div>
           <div className="pt-3 border-t border-slate-100 space-y-1">
             {renderTrendChange(currentStats.totalVacant, historyStats.lastMonth.totalVacant, '较上月')}
             {renderTrendChange(currentStats.totalVacant, historyStats.lastQuarter.totalVacant, '较上季')}
          </div>
        </div>
      </div>

      {/* Market Trend Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={20} className="text-blue-500"/> 市场核心指标走势 (Market Trends)
            </h3>
            <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm"></span> 平均租金</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> 平均出租率</div>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                    
                    {/* Y Axis 1: Price */}
                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} 
                        label={{ value: '租金', angle: -90, position: 'insideLeft', style: {textAnchor: 'middle', fill: '#94a3b8', fontSize: 10} }}
                    />
                    
                    {/* Y Axis 2: Occupancy */}
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} unit="%" domain={[0, 100]}
                        label={{ value: '出租率', angle: 90, position: 'insideRight', style: {textAnchor: 'middle', fill: '#94a3b8', fontSize: 10} }}
                    />
                    
                    <Tooltip 
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        formatter={(value: number, name: string) => {
                            if (name === '平均租金') return [`¥${value}`, name];
                            if (name === '平均出租率') return [`${value}%`, name];
                            return [value, name];
                        }}
                    />
                    
                    <Area yAxisId="left" type="monotone" dataKey="price" name="平均租金" fill="url(#colorPrice)" stroke="#3b82f6" strokeWidth={2}/>
                    <Line yAxisId="right" type="monotone" dataKey="occupancy" name="平均出租率" stroke="#10b981" strokeWidth={2} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}}/>
                    
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                </ComposedChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* Comparisons Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">租金水平对比</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceData} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val) => formatMoney(Number(val))} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {priceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.type === 'mine' ? '#3b82f6' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-slate-500 mt-2">
            本案单价{myRecord?.price && myRecord.price > currentStats.avgPrice ? '高于' : '低于'}市场平均 
            <span className="font-bold text-slate-800 ml-1">
                {formatMoney(Math.abs((myRecord?.price || 0) - currentStats.avgPrice))}
            </span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">出租率对比</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} unit="%" />
                <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(val) => Number(val).toFixed(1) + '%'} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {occupancyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.type === 'mine' ? '#10b981' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Market List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">市场监测总表</h3>
            <div className="text-xs text-slate-400">
                市场热点：
                {topPolicies.map(([tag], i) => (
                    <span key={i} className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded ml-2">{tag}</span>
                ))}
             </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">园区名称</th>
                <th className="px-6 py-3 font-medium">最新租金</th>
                <th className="px-6 py-3 font-medium">出租率</th>
                <th className="px-6 py-3 font-medium">空置库存 (㎡)</th>
                <th className="px-6 py-3 font-medium">佣金政策</th>
                <th className="px-6 py-3 font-medium">趋势</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[myPark, ...competitors].filter(Boolean).map((park) => {
                  // Logic here is consistent with the getMarketStatsAtDate function
                  const rec = records
                    .filter(r => r.parkId === park!.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  
                  let vacant = 0;
                  if (park!.totalGrossArea && park!.totalGrossArea > 0 && rec) {
                      vacant = park!.totalGrossArea * (1 - rec.occupancyRate / 100);
                  } else {
                      vacant = park!.buildings.reduce((s, b) => s + b.vacantArea, 0);
                  }

                  const isMine = park!.isMyProject;
                  return (
                    <tr key={park!.id} className={`hover:bg-slate-50 ${isMine ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-2">
                            {isMine && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">本案</span>}
                            {park!.name}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{rec ? formatMoney(rec.price) : '-'}</td>
                        <td className="px-6 py-4 text-slate-600">{rec ? rec.occupancyRate.toFixed(1)+'%' : '-'}</td>
                        <td className="px-6 py-4 text-slate-600">{Math.round(vacant).toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                            {park!.tags.slice(0, 2).join(', ')}
                        </td>
                         <td className="px-6 py-4">
                            {rec?.trend === 'up' && <TrendingUp size={16} className="text-red-500" />}
                            {rec?.trend === 'down' && <TrendingDown size={16} className="text-green-500" />}
                            {(rec?.trend === 'flat' || !rec) && <Minus size={16} className="text-slate-400" />}
                        </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;