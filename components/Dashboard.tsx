import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Building, AlertCircle } from 'lucide-react';
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

  const getLatestRecord = (parkId: string) => {
    return records
      .filter(r => r.parkId === parkId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const myRecord = myPark ? getLatestRecord(myPark.id) : null;

  const compStats = useMemo(() => {
    if (competitors.length === 0) return { avgPrice: 0, avgOccupancy: 0, totalVacant: 0 };
    
    let totalPrice = 0;
    let totalOccupancy = 0;
    let count = 0;
    let totalVacant = 0;

    competitors.forEach(comp => {
      const rec = getLatestRecord(comp.id);
      if (rec) {
        totalPrice += rec.price;
        totalOccupancy += rec.occupancyRate;
        count++;
      }
      const parkVacant = comp.buildings.reduce((sum, b) => sum + b.vacantArea, 0);
      totalVacant += parkVacant;
    });

    return {
      avgPrice: count ? totalPrice / count : 0,
      avgOccupancy: count ? totalOccupancy / count : 0,
      totalVacant
    };
  }, [competitors, records]);

  const myStats = useMemo(() => {
    if (!myPark) return { vacant: 0 };
    return {
      vacant: myPark.buildings.reduce((sum, b) => sum + b.vacantArea, 0)
    };
  }, [myPark]);

  // --- Charts Data ---
  const priceData = [
    { name: '本案项目', value: myRecord?.price || 0, type: 'mine' },
    { name: '竞品平均', value: compStats.avgPrice, type: 'comp' }
  ];

  const occupancyData = [
    { name: '本案项目', value: myRecord?.occupancyRate || 0, type: 'mine' },
    { name: '竞品平均', value: compStats.avgOccupancy, type: 'comp' }
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
  const renderDiff = (mine: number, comp: number, isPercent = false) => {
    const diff = mine - comp;
    if (diff === 0) return <span className="text-slate-500 flex items-center text-sm"><Minus size={14} /> 持平</span>;
    const isPositive = diff > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-emerald-600' : 'text-rose-600';
    return (
      <span className={`${color} flex items-center gap-1 text-sm font-medium`}>
        <Icon size={14} />
        {isPositive ? '+' : ''}{isPercent ? diff.toFixed(1) + '%' : diff.toFixed(1)}
      </span>
    );
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
    <div className="space-y-6 max-w-7xl mx-auto">
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
              <div className="text-2xl font-semibold text-slate-600">{formatMoney(compStats.avgPrice)}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
             <span className="text-xs text-slate-400">对比差距</span>
             {renderDiff(myRecord?.price || 0, compStats.avgPrice)}
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
              <div className="text-2xl font-semibold text-slate-600">{compStats.avgOccupancy.toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
             <span className="text-xs text-slate-400">对比差距</span>
             {renderDiff(myRecord?.occupancyRate || 0, compStats.avgOccupancy, true)}
          </div>
        </div>

        {/* Vacancy Card */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium mb-4">空置面积 (㎡)</h3>
           <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">本案</p>
              <div className="text-3xl font-bold text-slate-900">{myStats.vacant.toLocaleString()}</div>
            </div>
            <div className="h-12 w-px bg-slate-200 mx-4"></div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">竞品总存量</p>
              <div className="text-2xl font-semibold text-slate-600">{compStats.totalVacant.toLocaleString()}</div>
            </div>
          </div>
           <div className="mt-4 pt-4 border-t border-slate-100">
             <div className="text-xs text-slate-500">
                市场风向标：
                {topPolicies.map(([tag], i) => (
                    <span key={i} className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded mr-2 mt-1">{tag}</span>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
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
            本案单价{myRecord?.price && myRecord.price > compStats.avgPrice ? '高于' : '低于'}市场平均 
            <span className="font-bold text-slate-800 ml-1">
                {formatMoney(Math.abs((myRecord?.price || 0) - compStats.avgPrice))}
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">园区名称</th>
                <th className="px-6 py-3 font-medium">最新租金</th>
                <th className="px-6 py-3 font-medium">出租率</th>
                <th className="px-6 py-3 font-medium">空置(㎡)</th>
                <th className="px-6 py-3 font-medium">佣金政策</th>
                <th className="px-6 py-3 font-medium">趋势</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[myPark, ...competitors].filter(Boolean).map((park) => {
                  const rec = getLatestRecord(park!.id);
                  const vacant = park!.buildings.reduce((s, b) => s + b.vacantArea, 0);
                  const isMine = park!.isMyProject;
                  return (
                    <tr key={park!.id} className={`hover:bg-slate-50 ${isMine ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-2">
                            {isMine && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">本案</span>}
                            {park!.name}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{rec ? formatMoney(rec.price) : '-'}</td>
                        <td className="px-6 py-4 text-slate-600">{rec ? rec.occupancyRate.toFixed(1)+'%' : '-'}</td>
                        <td className="px-6 py-4 text-slate-600">{vacant}</td>
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
