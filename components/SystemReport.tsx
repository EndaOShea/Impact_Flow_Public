
import React, { useState, useMemo, useEffect } from 'react';
import { Task, User, Team, ImpactType, TaskStatus, ReportSchedule, UserRole } from '../types';
import { 
    Calendar, Printer, TrendingUp, Clock, CheckCircle2, 
    DollarSign, BarChart2, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
    PlayCircle, Mail, Plus, Trash, Clock as ClockIcon, CalendarDays, Repeat, Info, HelpCircle, Check
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell 
} from 'recharts';
import { db } from '../services/db';

interface SystemReportProps {
  tasks: Task[];
  users: User[];
  teams: Team[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export const SystemReport: React.FC<SystemReportProps> = ({ tasks, users, teams }) => {
  const [activeTab, setActiveTab] = useState<'GENERATE' | 'SCHEDULE'>('GENERATE');
  
  // Date State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Schedule State
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  
  // Form State for New Schedule
  const [schedName, setSchedName] = useState('');
  const [schedFreq, setSchedFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('WEEKLY');
  const [schedTime, setSchedTime] = useState('09:00');
  
  // Specific Configs
  const [dailyScope, setDailyScope] = useState<'TODAY' | 'YESTERDAY'>('YESTERDAY');
  
  const [monthlyRunDay, setMonthlyRunDay] = useState<number>(1);
  const [monthlyScope, setMonthlyScope] = useState<'CALENDAR_MONTH' | 'ROLLING_DAYS'>('CALENDAR_MONTH');
  const [monthlyRollingDays, setMonthlyRollingDays] = useState<number>(30);

  // Custom / Legacy
  const [schedCustomInterval, setSchedCustomInterval] = useState(2);
  const [schedWeekDays, setSchedWeekDays] = useState<number[]>([]);
  const [schedRangeEnd, setSchedRangeEnd] = useState<number>(0);
  const [schedRangeStart, setSchedRangeStart] = useState<number>(7);

  useEffect(() => {
    // Default: This Month
    const start = new Date();
    start.setDate(1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    
    // Load schedules
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
      const items = await db.getReportSchedules();
      setSchedules(items);
  };

  const handleCreateSchedule = async () => {
      if(!schedName) return;

      // Determine Offsets based on Type for backend compatibility
      let startOffset = schedRangeStart;
      let endOffset = schedRangeEnd;

      if (schedFreq === 'DAILY') {
          if (dailyScope === 'TODAY') { startOffset = 0; endOffset = 0; }
          else { startOffset = 1; endOffset = 1; }
      }
      else if (schedFreq === 'WEEKLY') {
          // Fixed rule: Full 7-day period ending Yesterday.
          // e.g. Run on Sunday. Covers Prev Sunday -> Saturday (Yesterday).
          startOffset = 7;
          endOffset = 1;
      }
      else if (schedFreq === 'MONTHLY') {
          // For Calendar Month, offsets are symbolic (backend handles it)
          startOffset = 30; endOffset = 0; 
          if (monthlyScope === 'ROLLING_DAYS') {
              startOffset = monthlyRollingDays;
              endOffset = 0;
          }
      }
      
      const newSchedule: ReportSchedule = {
          id: crypto.randomUUID(),
          organizationId: 'current',
          name: schedName,
          frequency: schedFreq,
          time: schedTime,
          
          // Specifics
          dailyScope: schedFreq === 'DAILY' ? dailyScope : undefined,
          monthlyRunDay: schedFreq === 'MONTHLY' ? monthlyRunDay : undefined,
          monthlyScope: schedFreq === 'MONTHLY' ? monthlyScope : undefined,
          monthlyRollingValue: schedFreq === 'MONTHLY' && monthlyScope === 'ROLLING_DAYS' ? monthlyRollingDays : undefined,
          
          customInterval: schedFreq === 'CUSTOM' ? schedCustomInterval : undefined,
          weekDays: schedFreq === 'WEEKLY' ? schedWeekDays : undefined,
          
          // Offsets
          rangeStartOffset: startOffset,
          rangeEndOffset: endOffset,
          
          recipients: [],
          active: true
      };
      
      await db.createReportSchedule(newSchedule);
      setIsCreatingSchedule(false);
      
      // Reset Form
      setSchedName('');
      setSchedFreq('WEEKLY');
      setSchedWeekDays([]);
      setDailyScope('YESTERDAY');
      
      loadSchedules();
  };

  const handleDeleteSchedule = async (id: string) => {
      await db.deleteReportSchedule(id);
      loadSchedules();
  };

  const toggleWeekDay = (dayIdx: number) => {
      if (schedWeekDays.includes(dayIdx)) {
          setSchedWeekDays(schedWeekDays.filter(d => d !== dayIdx));
      } else {
          setSchedWeekDays([...schedWeekDays, dayIdx].sort());
      }
  };

  const handlePreset = (preset: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_YEAR') => {
      const now = new Date();
      let start = new Date();
      let end = new Date();

      switch(preset) {
          case 'TODAY':
              // Start/End is today
              break;
          case 'YESTERDAY':
              start.setDate(now.getDate() - 1);
              end.setDate(now.getDate() - 1);
              break;
          case 'THIS_WEEK':
              // Start is Sunday
              start.setDate(now.getDate() - now.getDay());
              break;
          case 'LAST_WEEK':
              start.setDate(now.getDate() - now.getDay() - 7);
              end.setDate(start.getDate() + 6);
              break;
          case 'THIS_MONTH':
              start.setDate(1);
              break;
          case 'LAST_MONTH':
              start.setMonth(now.getMonth() - 1, 1);
              end.setMonth(now.getMonth(), 0); // Last day of prev month
              break;
          case 'THIS_YEAR':
              start.setMonth(0, 1); // Jan 1st
              // End is today
              break;
          case 'LAST_YEAR':
              start.setFullYear(now.getFullYear() - 1, 0, 1); // Jan 1st last year
              end.setFullYear(now.getFullYear() - 1, 11, 31); // Dec 31st last year
              break;
      }
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
  };

  // Filter Logic (Same as before)
  const reportData = useMemo(() => {
    if (!startDate || !endDate) return null;
    const startObj = new Date(startDate); startObj.setHours(0,0,0,0);
    const endObj = new Date(endDate); endObj.setHours(23,59,59,999);
    const completedInPeriod = tasks.filter(t => t.status === TaskStatus.COMPLETED && t.completedAt && new Date(t.completedAt) >= startObj && new Date(t.completedAt) <= endObj);
    const createdInPeriod = tasks.filter(t => new Date(t.createdAt) >= startObj && new Date(t.createdAt) <= endObj);
    const dueInPeriod = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= startObj && new Date(t.dueDate) <= endObj);
    let totalRevenue = 0; let totalTimeSaved = 0; let totalHoursLogged = 0;
    completedInPeriod.forEach(t => {
        totalHoursLogged += t.subtasks.reduce((sum, s) => sum + s.hoursSpent, 0);
        t.impactMetrics.forEach(m => {
            if(m.type === ImpactType.REVENUE) totalRevenue += (m.achievedValue || 0); 
            if(m.type === ImpactType.EFFICIENCY) totalTimeSaved += (m.achievedValue || 0);
        });
    });
    const teamPerformance = teams.map(team => {
        const teamUsers = users.filter(u => u.teamIds.includes(team.id)).map(u => u.id);
        const tasksCount = completedInPeriod.filter(t => t.assigneeIds.some(aid => teamUsers.includes(aid))).length;
        return { name: team.name, value: tasksCount };
    }).filter(d => d.value > 0);
    const categoryMap: Record<string, number> = {};
    completedInPeriod.forEach(t => {
        t.subtasks.forEach(s => categoryMap[s.category] = (categoryMap[s.category] || 0) + s.hoursSpent);
    });
    const categoryDistribution = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    return {
        completed: completedInPeriod, created: createdInPeriod, due: dueInPeriod,
        metrics: { revenue: totalRevenue, timeSaved: totalTimeSaved, hoursLogged: totalHoursLogged, completionRate: dueInPeriod.length > 0 ? Math.round((completedInPeriod.length / dueInPeriod.length) * 100) : 0 },
        charts: { teamPerformance, categoryDistribution }
    };
  }, [tasks, users, teams, startDate, endDate]);

  const handlePrint = () => window.print();

  const getFriendlyDescription = (s: ReportSchedule) => {
      if (s.frequency === 'DAILY') {
          return `Daily (Data from ${s.dailyScope === 'TODAY' ? 'Today' : 'Yesterday'})`;
      }
      if (s.frequency === 'WEEKLY') {
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const dayNames = s.weekDays?.map(d => days[d]).join(', ');
          return `Weekly on ${dayNames} (Prev 7 Days)`;
      }
      if (s.frequency === 'MONTHLY') {
          const dayStr = s.monthlyRunDay === 32 ? 'Last Day' : `${s.monthlyRunDay}${getOrdinal(s.monthlyRunDay || 1)}`;
          const scopeStr = s.monthlyScope === 'CALENDAR_MONTH' ? 'Prev Calendar Month' : `Last ${s.monthlyRollingValue} Days`;
          return `Monthly on the ${dayStr} (${scopeStr})`;
      }
      return `Custom (Every ${s.customInterval} Days)`;
  };

  const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return s[(v - 20) % 10] || s[v] || s[0];
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-12">
        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-slate-200 print:hidden">
            <button 
                onClick={() => setActiveTab('GENERATE')} 
                className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 ${activeTab === 'GENERATE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <BarChart2 className="w-4 h-4"/> Report Generator
            </button>
            <button 
                onClick={() => setActiveTab('SCHEDULE')} 
                className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 ${activeTab === 'SCHEDULE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <ClockIcon className="w-4 h-4"/> Automation & Schedules
            </button>
        </div>

        {activeTab === 'GENERATE' && (
            <>
                {/* Controls */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4 print:hidden">
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full xl:w-auto">
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handlePreset('TODAY')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Today</button>
                            <button onClick={() => handlePreset('YESTERDAY')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Yesterday</button>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button onClick={() => handlePreset('THIS_WEEK')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">This Week</button>
                            <button onClick={() => handlePreset('LAST_WEEK')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Last Week</button>
                             <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button onClick={() => handlePreset('THIS_MONTH')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">This Month</button>
                            <button onClick={() => handlePreset('LAST_MONTH')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Last Month</button>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button onClick={() => handlePreset('THIS_YEAR')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">This Year</button>
                            <button onClick={() => handlePreset('LAST_YEAR')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Last Year</button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-500 pl-2">From</span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border border-slate-300 text-black text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"/>
                            <span className="text-xs font-bold text-slate-500">To</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border border-slate-300 text-black text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"/>
                        </div>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium whitespace-nowrap">
                            <Printer className="w-4 h-4" /> Export
                        </button>
                    </div>
                </div>

                {reportData && (
                <div className="print:block">
                    <div className="mb-8 text-center md:text-left">
                        <h1 className="text-3xl font-bold text-slate-900">System Performance Report</h1>
                        <p className="text-slate-500 mt-2 text-sm font-medium">Period: {new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="text-sm font-bold uppercase">Tasks Completed</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">{reportData.completed.length}</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><DollarSign className="w-5 h-5 text-emerald-500" /><span className="text-sm font-bold uppercase">Revenue Impact</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">${reportData.metrics.revenue.toLocaleString()}</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><Clock className="w-5 h-5 text-blue-500" /><span className="text-sm font-bold uppercase">Hours Logged</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">{reportData.metrics.hoursLogged.toFixed(1)}</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><TrendingUp className="w-5 h-5 text-purple-500" /><span className="text-sm font-bold uppercase">Efficiency Gain</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">{reportData.metrics.timeSaved}</span></div>
                        </div>
                    </div>
                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:break-inside-avoid">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-500" /> Tasks by Team</h3>
                            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={reportData.charts.teamPerformance}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-purple-500" /> Work Categories (Hours)</h3>
                            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={reportData.charts.categoryDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{reportData.charts.categoryDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                        </div>
                    </div>
                </div>
                )}
            </>
        )}

        {activeTab === 'SCHEDULE' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Automated Report Schedules</h2>
                        <p className="text-slate-500 text-sm">Configure reports to run automatically and email stakeholders.</p>
                    </div>
                    {!isCreatingSchedule ? (
                        <button onClick={() => setIsCreatingSchedule(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                            <Plus className="w-4 h-4" /> Create Schedule
                        </button>
                    ) : (
                        <button onClick={() => setIsCreatingSchedule(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
                    )}
                </div>

                {isCreatingSchedule && (
                    <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                        <h3 className="font-bold text-slate-700 mb-4">New Report Schedule</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* General Settings */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-200 pb-2">General Info</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Report Name</label>
                                    <input 
                                        type="text" 
                                        value={schedName}
                                        onChange={(e) => setSchedName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                        placeholder="e.g. Weekly Management Summary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Run Time</label>
                                    <input 
                                        type="time" 
                                        value={schedTime} 
                                        onChange={(e) => setSchedTime(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Run Frequency</label>
                                    <select 
                                        value={schedFreq} 
                                        onChange={(e) => setSchedFreq(e.target.value as any)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                    >
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                        <option value="CUSTOM">Custom Interval</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* Detailed Frequency Config */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-200 pb-2">Configuration</h4>
                                
                                {/* DAILY CONFIG */}
                                {schedFreq === 'DAILY' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Report Data Scope</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg flex-1">
                                                <input type="radio" name="dailyScope" checked={dailyScope === 'TODAY'} onChange={() => setDailyScope('TODAY')} className="bg-white" />
                                                <span className="text-sm font-medium text-slate-700">Data from Today</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg flex-1">
                                                <input type="radio" name="dailyScope" checked={dailyScope === 'YESTERDAY'} onChange={() => setDailyScope('YESTERDAY')} className="bg-white" />
                                                <span className="text-sm font-medium text-slate-700">Data from Yesterday</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* WEEKLY CONFIG */}
                                {schedFreq === 'WEEKLY' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Run on Days</label>
                                            <div className="flex justify-between gap-1 bg-white p-2 rounded-lg border border-slate-200">
                                                {['S','M','T','W','T','F','S'].map((d, i) => (
                                                    <button 
                                                        key={i}
                                                        onClick={() => toggleWeekDay(i)}
                                                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${schedWeekDays.includes(i) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                                            <p className="font-bold flex items-center gap-1"><Info className="w-3 h-3"/> Scope</p>
                                            <p className="mt-1">Weekly reports cover the full 7-day period ending on the day before the run date.</p>
                                        </div>
                                    </div>
                                )}

                                {/* MONTHLY CONFIG */}
                                {schedFreq === 'MONTHLY' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Run on Day</label>
                                            <select 
                                                value={monthlyRunDay}
                                                onChange={(e) => setMonthlyRunDay(parseInt(e.target.value))}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                            >
                                                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                                    <option key={d} value={d}>{d}{getOrdinal(d)}</option>
                                                ))}
                                                <option value={32}>Last Day of Month</option>
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Data Scope</label>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg">
                                                    <input type="radio" name="monthlyScope" checked={monthlyScope === 'CALENDAR_MONTH'} onChange={() => setMonthlyScope('CALENDAR_MONTH')} className="bg-white" />
                                                    <span className="text-sm font-medium text-slate-700">Previous Calendar Month</span>
                                                </label>
                                                
                                                <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg">
                                                    <input type="radio" name="monthlyScope" checked={monthlyScope === 'ROLLING_DAYS'} onChange={() => setMonthlyScope('ROLLING_DAYS')} className="bg-white" />
                                                    <span className="text-sm font-medium text-slate-700">Rolling Days (Custom)</span>
                                                </label>

                                                {monthlyScope === 'ROLLING_DAYS' && (
                                                    <div className="pl-6">
                                                        <label className="text-xs text-slate-500 mr-2">Number of days:</label>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            max="365"
                                                            value={monthlyRollingDays} 
                                                            onChange={(e) => setMonthlyRollingDays(parseInt(e.target.value) || 30)}
                                                            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm bg-white text-black"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CUSTOM CONFIG */}
                                {schedFreq === 'CUSTOM' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Repeat Every (Days)</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                value={schedCustomInterval}
                                                onChange={(e) => setSchedCustomInterval(parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">End Offset</label>
                                                <input type="number" min="0" value={schedRangeEnd} onChange={e => setSchedRangeEnd(parseInt(e.target.value)||0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Lookback</label>
                                                <input type="number" min="0" value={schedRangeStart} onChange={e => setSchedRangeStart(parseInt(e.target.value)||0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                             <button onClick={() => setIsCreatingSchedule(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-lg">Cancel</button>
                             <button onClick={handleCreateSchedule} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md shadow-blue-500/20">Save Schedule</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {schedules.map(schedule => (
                        <div key={schedule.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                             <div className="flex items-center gap-4">
                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${schedule.active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                     <ClockIcon className="w-6 h-6" />
                                 </div>
                                 <div>
                                     <h4 className="font-bold text-slate-800">{schedule.name}</h4>
                                     <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                         <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                             <Info className="w-3 h-3" /> {getFriendlyDescription(schedule)}
                                         </span>
                                         <span>at {schedule.time}</span>
                                     </div>
                                 </div>
                             </div>
                             <div className="flex items-center gap-4">
                                 <span className={`text-xs font-bold px-2 py-1 rounded ${schedule.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                     {schedule.active ? 'ACTIVE' : 'PAUSED'}
                                 </span>
                                 <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                     <Trash className="w-4 h-4" />
                                 </button>
                             </div>
                        </div>
                    ))}
                    {schedules.length === 0 && !isCreatingSchedule && (
                        <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl text-slate-400">
                            No active schedules found.
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
