import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, BarChart } from './charts/Charts';
import { AnalyticsService } from '../services/analytics';
import { TemporalMetricsResponse } from '../types';
import { Loader2, Download } from 'lucide-react';

interface TemporalMetricsChartsProps {
  defaultGranularity?: 'daily' | 'weekly' | 'monthly';
  defaultMonths?: number;
  compact?: boolean;
}

export const TemporalMetricsCharts: React.FC<TemporalMetricsChartsProps> = ({
  defaultGranularity = 'monthly',
  defaultMonths = 12,
}) => {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>(defaultGranularity);
  const [monthsBack, setMonthsBack] = useState(defaultMonths);
  const [temporalData, setTemporalData] = useState<TemporalMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadTemporalMetrics(); }, [granularity, monthsBack]);

  const loadTemporalMetrics = async () => {
    setLoading(true);
    try {
      const data = await AnalyticsService.getTemporalMetrics(granularity, monthsBack);
      setTemporalData(data);
    } catch (error) {
      console.error('Failed to load temporal metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => temporalData?.metrics || [], [temporalData]);

  const handleExportCSV = () => {
    if (!temporalData || chartData.length === 0) return;
    const headers = ['Date', 'Workload (Tasks in Progress)', 'Completion Velocity (Tasks Completed)', 'Avg Time to Completion (Hours)', 'Failed/Missed Deadlines'];
    const rows = chartData.map(m => [m.date, m.workload.toString(), m.completionVelocity.toString(), m.avgTimeToCompletion.toFixed(1), m.failedDeadlines.toString()]);
    const summaryRows = [
      [],
      ['Summary Statistics'],
      ['Total Completed', temporalData.summary.totalCompleted.toString()],
      ['Total Failed', temporalData.summary.totalFailed.toString()],
      ['Average Workload', temporalData.summary.avgWorkload.toFixed(1)],
      ['Average Completion Time (Hours)', temporalData.summary.avgCompletionTime.toFixed(1)],
    ];
    const csvContent = [headers.join(','), ...rows.map(r => r.join(',')), ...summaryRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `temporal-metrics-${granularity}-${monthsBack}months-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!loading && chartData.length === 0) {
    return (
      <div className="empty"><span className="ic"><Download className="w-7 h-7" /></span><h4>No data for this period</h4><p>Complete tasks to see temporal trends.</p></div>
    );
  }

  const summaryCards = temporalData?.summary ? [
    { l: 'Total Completed', v: String(temporalData.summary.totalCompleted), c: 'var(--green-ink)' },
    { l: 'Total Failed', v: String(temporalData.summary.totalFailed), c: 'var(--red-ink)' },
    { l: 'Avg Workload', v: temporalData.summary.avgWorkload.toFixed(1), c: 'var(--accent)' },
    { l: 'Avg Completion Time', v: temporalData.summary.avgCompletionTime.toFixed(1) + 'h', c: '#8b5cf6' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }} className="print:hidden">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="seg">
            {(['daily', 'weekly', 'monthly'] as const).map(g => (
              <button key={g} className={granularity === g ? 'on' : ''} onClick={() => setGranularity(g)} style={{ textTransform: 'capitalize' }}>{g}</button>
            ))}
          </div>
          <select className="input" style={{ width: 'auto' }} value={monthsBack} onChange={e => setMonthsBack(parseInt(e.target.value))}>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
            <option value={0}>All time</option>
          </select>
        </div>
        <button className="btn-g btn" onClick={handleExportCSV} disabled={!temporalData || chartData.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {summaryCards.length > 0 && (
        <div className="grid-4">
          {summaryCards.map((s, i) => (
            <div className="subpanel" key={i}>
              <div className="kl" style={{ color: s.c }}>{s.l}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="subpanel">
            <div className="card-h"><div><h3>Workload Over Time</h3><div className="sub">Tasks in progress per period</div></div></div>
            <AreaChart vals={chartData.map(d => d.workload)} id="tm-workload" w={520} h={220} stroke="var(--accent)" />
          </div>
          <div className="subpanel">
            <div className="card-h"><div><h3>Completion Velocity</h3><div className="sub">Tasks completed per period</div></div></div>
            <BarChart data={chartData.map(d => ({ label: d.date, value: d.completionVelocity, color: '#0d9488' }))} w={520} h={220} />
          </div>
          <div className="subpanel">
            <div className="card-h"><div><h3>Time to Completion</h3><div className="sub">Avg hours start → done</div></div></div>
            <AreaChart vals={chartData.map(d => d.avgTimeToCompletion)} id="tm-time" w={520} h={220} stroke="#8b5cf6" />
          </div>
          <div className="subpanel">
            <div className="card-h"><div><h3>Failed / Missed Deadlines</h3><div className="sub">Tasks overdue or failed</div></div></div>
            <BarChart data={chartData.map(d => ({ label: d.date, value: d.failedDeadlines, color: '#ef4444' }))} w={520} h={220} />
          </div>
        </div>
      )}
    </div>
  );
};
