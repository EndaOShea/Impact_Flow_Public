

import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Task, ImpactType } from '../types';
import { Filter } from 'lucide-react';

interface ImpactChartProps {
  tasks: Task[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#64748b', '#ef4444', '#881337'];

type FilterOption = 
    | 'REVENUE_USD' 
    | 'REVENUE_EUR' 
    | 'REVENUE_GBP' 
    | 'EFFICIENCY' 
    | 'SATISFACTION' 
    | 'COST_REDUCTION'
    | 'RISK_MITIGATION';

export const ImpactChart: React.FC<ImpactChartProps> = ({ tasks }) => {
  const [filter, setFilter] = useState<FilterOption>('REVENUE_USD');

  // Helper to determine what we are looking for
  const filterConfig = useMemo(() => {
      switch(filter) {
          case 'REVENUE_USD': return { type: ImpactType.REVENUE, currency: 'USD', label: 'Revenue ($)', color: '#10b981' };
          case 'REVENUE_EUR': return { type: ImpactType.REVENUE, currency: 'EUR', label: 'Revenue (€)', color: '#10b981' };
          case 'REVENUE_GBP': return { type: ImpactType.REVENUE, currency: 'GBP', label: 'Revenue (£)', color: '#10b981' };
          case 'EFFICIENCY': return { type: ImpactType.EFFICIENCY, label: 'Time Saved (Hours)', color: '#3b82f6' };
          case 'SATISFACTION': return { type: ImpactType.SATISFACTION, label: 'CSAT Score', color: '#f59e0b' };
          case 'COST_REDUCTION': return { type: ImpactType.COST_REDUCTION, label: 'Cost Reduction', color: '#6366f1' };
          case 'RISK_MITIGATION': return { type: ImpactType.RISK_MITIGATION, label: 'Risk Mitigation', color: '#ef4444' };
          default: return { type: ImpactType.REVENUE, currency: 'USD', label: 'Revenue', color: '#3b82f6' };
      }
  }, [filter]);

  // Aggregate Data by Time (Month)
  const chartData = useMemo(() => {
    const monthMap: Record<string, number> = {};

    tasks.forEach(task => {
        // Determine date bucket (use Due Date or Created Date)
        const date = task.dueDate ? new Date(task.dueDate) : new Date(task.createdAt);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); // e.g. "Oct 24"
        
        // Initialize if not exists (to ensure sorting later, we might want to pre-fill months, but dense is ok for now)
        if (monthMap[monthKey] === undefined) monthMap[monthKey] = 0;

        task.impactMetrics.forEach(metric => {
            // Check if metric matches current filter
            const typeMatch = metric.type === filterConfig.type;
            let currencyMatch = true;
            
            if (filterConfig.type === ImpactType.REVENUE) {
                currencyMatch = metric.currency === filterConfig.currency;
            }

            if (typeMatch && currencyMatch) {
                monthMap[monthKey] += metric.value;
            }
        });
    });

    // Convert to array and sort chronologically
    return Object.entries(monthMap)
        .map(([name, value]) => ({ name, value, dateObj: new Date(Date.parse(`01 ${name}`)) }))
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        .map(({ name, value }) => ({ name, value }));
  }, [tasks, filterConfig]);

  // Task Completion Status for Pie Chart
  const statusData = React.useMemo(() => {
    const counts = {
      TODO: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      POSTPONED: 0,
      FAILED: 0
    };
    tasks.forEach(t => {
        if (t.status === 'REVIEW') counts.IN_PROGRESS++;
        else if (t.status === 'TODO') counts.TODO++;
        else if (t.status === 'COMPLETED') counts.COMPLETED++;
        else if (t.status === 'IN_PROGRESS') counts.IN_PROGRESS++;
        else if (t.status === 'POSTPONED') counts.POSTPONED++;
        else if (t.status === 'FAILED') counts.FAILED++;
    });
    return [
      { name: 'To Do', value: counts.TODO },
      { name: 'In Progress', value: counts.IN_PROGRESS },
      { name: 'Completed', value: counts.COMPLETED },
      { name: 'Postponed', value: counts.POSTPONED },
      { name: 'Failed', value: counts.FAILED }
    ].filter(d => d.value > 0);
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Total Impact Bar Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
                <h3 className="text-lg font-semibold text-slate-800">Business Impact Over Time</h3>
                <p className="text-sm text-slate-500">Projected value based on task due dates</p>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-4 w-4 text-slate-400" />
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterOption)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer shadow-sm hover:border-slate-400 transition-colors"
                >
                    <option value="REVENUE_USD">Revenue ($ USD)</option>
                    <option value="REVENUE_EUR">Revenue (€ EUR)</option>
                    <option value="REVENUE_GBP">Revenue (£ GBP)</option>
                    <option value="EFFICIENCY">Time Saved (Hours)</option>
                    <option value="SATISFACTION">CSAT Score</option>
                    <option value="COST_REDUCTION">Cost Reduction</option>
                    <option value="RISK_MITIGATION">Risk Mitigation</option>
                </select>
            </div>
        </div>

        <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#64748b" axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{fontSize: 12}} stroke="#64748b" axisLine={false} tickLine={false} tickFormatter={(val) => val >= 1000 ? `${val/1000}k` : val} />
                <Tooltip
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [
                      `${filterConfig.currency === 'USD' ? '$' : filterConfig.currency === 'EUR' ? '€' : filterConfig.currency === 'GBP' ? '£' : ''}${value.toLocaleString()} ${!filter.includes('REVENUE') ? '' : ''}`,
                      filterConfig.label
                  ]}
                />
                <Bar
                    dataKey="value"
                    fill={filterConfig.color}
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                    name={filterConfig.label}
                    animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                <p>No data available for this metric.</p>
                <p className="text-xs mt-1">Try adding metrics to your tasks.</p>
            </div>
          )}
        </div>
      </div>

      {/* Task Status Pie Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[450px]">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Task Progress Overview</h3>
        <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
              <p>No task data available.</p>
              <p className="text-xs mt-1">Create some tasks to see progress.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};