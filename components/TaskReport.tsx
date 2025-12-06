import React, { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Task, WorkCategory, ImpactType } from '../types';
import { Clock, CheckCircle2, AlertCircle, FileText, Download, Printer, ArrowRight, Flag } from 'lucide-react';

interface TaskReportProps {
  task: Task;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export const TaskReport: React.FC<TaskReportProps> = ({ task }) => {
  
  const stats = useMemo(() => {
    const totalHours = task.subtasks.reduce((acc, curr) => acc + curr.hoursSpent, 0);
    const completedTasks = task.subtasks.filter(s => s.completed).length;
    const progress = task.subtasks.length ? Math.round((completedTasks / task.subtasks.length) * 100) : 0;
    
    // Group by category
    const categoryMap: Record<string, number> = {};
    Object.values(WorkCategory).forEach(c => categoryMap[c] = 0);
    
    task.subtasks.forEach(s => {
      categoryMap[s.category] = (categoryMap[s.category] || 0) + s.hoursSpent;
    });

    const categoryData = Object.entries(categoryMap)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => ({ name, value }));

    // Complexity Score (Subjective metric based on hours + subtask count)
    const complexityScore = totalHours * 0.5 + task.subtasks.length * 2;

    return { totalHours, progress, categoryData, complexityScore };
  }, [task]);

  const handlePrint = () => {
      window.print();
  };

  const getCategoryColor = (category: WorkCategory) => {
    switch(category) {
        case WorkCategory.DEBUGGING: return 'bg-red-50 text-red-600';
        case WorkCategory.RESEARCH: return 'bg-purple-50 text-purple-600';
        case WorkCategory.DEVELOPMENT: return 'bg-blue-50 text-blue-600';
        case WorkCategory.STRATEGY: return 'bg-indigo-50 text-indigo-600';
        case WorkCategory.MARKETING: return 'bg-pink-50 text-pink-600';
        case WorkCategory.SALES: return 'bg-green-50 text-green-600';
        case WorkCategory.FINANCE: return 'bg-emerald-50 text-emerald-600';
        case WorkCategory.LEGAL: return 'bg-slate-100 text-slate-700 font-bold';
        default: return 'bg-slate-100 text-slate-600';
    }
  };

  const milestones = task.subtasks.filter(s => s.isMilestone);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 print:space-y-4">
      
      {/* Report Header (Visible on print mostly) */}
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
            <p className="text-slate-500">Impact & Execution Report</p>
        </div>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 print:hidden">
            <Printer className="w-4 h-4" /> Export / Print
        </button>
      </div>

      {/* Strategic Context (New Section) */}
      {((milestones && milestones.length > 0) || task.beforeScenario || task.afterScenario) && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
           <h3 className="text-lg font-bold text-indigo-900 mb-4">Strategic Context</h3>
           
           {milestones && milestones.length > 0 && (
               <div className="mb-6">
                   <span className="text-xs font-bold uppercase text-indigo-400 tracking-wider">Strategic Milestones / OKRs</span>
                   <ul className="mt-3 space-y-2">
                       {milestones.map((ms, idx) => (
                           <li key={idx} className="flex items-center gap-3">
                               <Flag className={`w-4 h-4 ${ms.completed ? 'text-green-600 fill-green-600' : 'text-indigo-300'}`} />
                               <span className={`text-base font-medium ${ms.completed ? 'text-green-800 line-through decoration-green-800/50' : 'text-indigo-800'}`}>
                                   {ms.title}
                               </span>
                               {ms.completed && <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">ACHIEVED</span>}
                           </li>
                       ))}
                   </ul>
               </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
               <div className="bg-white/50 p-4 rounded-lg border border-indigo-100">
                   <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Before State</h4>
                   <p className="text-slate-700 text-sm leading-relaxed">{task.beforeScenario || 'No prior state defined.'}</p>
               </div>
               
               <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 border border-indigo-100 shadow-sm z-10">
                   <ArrowRight className="w-4 h-4 text-indigo-500" />
               </div>

               <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
                   <h4 className="text-sm font-bold text-emerald-600 uppercase mb-2">After State</h4>
                   <p className="text-slate-700 text-sm leading-relaxed">{task.afterScenario || 'No outcome defined.'}</p>
               </div>
           </div>
        </div>
      )}

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <Clock className="w-5 h-5" />
            <h4 className="font-semibold">Total Effort</h4>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.totalHours} <span className="text-sm font-normal text-slate-500">hours</span></p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-700 mb-1">
            <CheckCircle2 className="w-5 h-5" />
            <h4 className="font-semibold">Completion</h4>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.progress}% <span className="text-sm font-normal text-slate-500">done</span></p>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <div className="flex items-center gap-2 text-purple-700 mb-1">
            <AlertCircle className="w-5 h-5" />
            <h4 className="font-semibold">Complexity Score</h4>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.complexityScore.toFixed(0)} <span className="text-sm font-normal text-slate-500">points</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block print:space-y-8">
        {/* Effort Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Effort Distribution</h3>
          <div className="flex-1 min-h-[300px] w-full relative">
             {stats.categoryData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data recorded yet</div>
             )}
          </div>
        </div>

        {/* Narrative & Metrics */}
        <div className="space-y-6 print:break-inside-avoid">
             {/* Impact Narrative */}
            {task.impactNarrative && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Impact Narrative</h3>
                    <p className="text-slate-600 text-sm leading-7 italic">
                        "{task.impactNarrative}"
                    </p>
                </div>
            )}

            {/* Quant Metrics (KPIs) */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Key Performance Indicators</h3>
                <div className="space-y-4">
                    {task.impactMetrics.map(m => {
                        const target = m.value;
                        const achieved = m.achievedValue || 0;
                        const percent = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                        const currencySymbol = m.type === ImpactType.REVENUE 
                            ? (m.currency === 'EUR' ? '€' : m.currency === 'GBP' ? '£' : '$') 
                            : '';

                        return (
                        <div key={m.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <p className="text-xs font-bold text-slate-500 uppercase">{m.type}</p>
                                     <p className="text-xs text-slate-400">{m.description}</p>
                                 </div>
                                 <div className="text-right">
                                     <div className="text-lg font-bold text-slate-800">
                                        {currencySymbol}{achieved.toLocaleString()} 
                                        <span className="text-xs font-normal text-slate-400 ml-1">/ {currencySymbol}{target.toLocaleString()}</span>
                                     </div>
                                 </div>
                             </div>
                             {/* Progress Bar */}
                             <div className="relative pt-1">
                                <div className="flex mb-1 items-center justify-between">
                                    <span className={`text-xs font-semibold inline-block py-0.5 px-2 rounded-full ${percent >= 100 ? 'text-green-600 bg-green-200' : 'text-blue-600 bg-blue-200'}`}>
                                        {percent}% Achieved
                                    </span>
                                </div>
                                <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-slate-200">
                                    <div style={{ width: `${percent}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                </div>
                             </div>
                        </div>
                    )})}
                    {task.impactMetrics.length === 0 && <p className="text-slate-400 text-sm">No KPIs defined.</p>}
                </div>
            </div>
        </div>
      </div>

      {/* Detailed Analysis Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:break-before-page">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Detailed Work Logs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Task Stage</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Notes & Observations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {task.subtasks.map(sub => (
                <tr key={sub.id} className={`hover:bg-slate-50/50 ${sub.isMilestone ? 'bg-purple-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                       {sub.completed ? <CheckCircle2 className="w-4 h-4 text-green-500"/> : <div className="w-4 h-4 rounded-full border border-slate-300"/>}
                       {sub.title}
                       {sub.isMilestone && <Flag className="w-3 h-3 text-purple-600 ml-1" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(sub.category)}`}>
                      {sub.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sub.hoursSpent}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-md truncate" title={sub.notes}>{sub.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};