import { useState } from 'react';
import { Typography, Row, Col, Skeleton, Empty, Button, Segmented, Tooltip } from 'antd';
import {
  AppstoreOutlined, TeamOutlined, DatabaseOutlined, WarningOutlined,
  CloseCircleOutlined, ArrowRightOutlined, AlertOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  getOverview, getLogsOverTime, getAppHealth, getTopErrors,
  getErrorSpike, getHeatmap, getRecentFatals, getTodayVsYesterday, getAppBreakdown,
} from '../api/dashboard';
import { useAuth } from '../auth/AuthContext';
import { formatRelative } from '../utils/formatters';

const { Text } = Typography;

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:   '#6c47ff',
  error:     '#e5254b',
  warn:      '#f59e0b',
  info:      '#10b981',
  debug:     '#94a3b8',
  fatal:     '#e84393',
  border:    '#e4e2e8',
  borderSub: '#f0eff2',
  bg:        '#faf9fb',
  surface:   '#ffffff',
  text:      '#2b2833',
  textSub:   '#6b7280',
  textMuted: '#9ca3af',
  shadow:    '0 1px 3px rgba(43,40,51,0.06), 0 1px 2px rgba(43,40,51,0.04)',
  shadowHov: '0 4px 12px rgba(43,40,51,0.10), 0 2px 4px rgba(43,40,51,0.06)',
};

const LEVEL_COLORS = {
  DEBUG: C.debug, INFO: C.info, WARN: C.warn, ERROR: C.error, FATAL: C.fatal,
};

const HEALTH_COLOR  = { healthy: '#10b981', degraded: '#f59e0b', critical: '#e5254b' };
const HEALTH_BG     = { healthy: '#ecfdf5', degraded: '#fffbeb', critical: '#fff1f2' };
const HEALTH_BORDER = { healthy: '#a7f3d0', degraded: '#fde68a', critical: '#fecdd3' };

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ title, children, style }) {
  return (
    <div style={style}>
      <Text style={{
        display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: C.textMuted, marginBottom: 10,
      }}>
        {title}
      </Text>
      {children}
    </div>
  );
}

// ─── Panel card ───────────────────────────────────────────────────────────────
function Panel({ title, action, children, noPadding, style }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      boxShadow: C.shadow, overflow: 'hidden', height: '100%', ...style,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 18px', borderBottom: `1px solid ${C.borderSub}`,
        background: '#fcfbfd',
      }}>
        <Text style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{title}</Text>
        {action}
      </div>
      <div style={noPadding ? {} : { padding: 18 }}>
        {children}
      </div>
    </div>
  );
}

// ─── KPI stat card ────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, accentColor, trend }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${accentColor}`, borderRadius: 10,
      padding: '16px 18px', boxShadow: C.shadow,
      transition: 'box-shadow 180ms',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = C.shadowHov; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = C.shadow; }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
      }}>
        <span style={{ fontSize: 13, color: accentColor }}>{icon}</span>
        <Text style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.7,
          textTransform: 'uppercase', color: C.textMuted,
        }}>
          {label}
        </Text>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.text, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      {trend}
    </div>
  );
}

// ─── Trend badge ─────────────────────────────────────────────────────────────
function TrendBadge({ today, yesterday, invert = false }) {
  if (yesterday === 0 && today === 0) {
    return <Text style={{ fontSize: 11, color: C.textMuted }}>No data yesterday</Text>;
  }
  if (yesterday === 0) {
    return <Text style={{ fontSize: 11, color: C.info }}>New activity today</Text>;
  }
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const isUp = pct >= 0;
  // invert: for errors/warnings, going up is bad
  const isGood = invert ? !isUp : isUp;
  const color = pct === 0 ? C.textMuted : isGood ? C.info : C.error;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {pct !== 0 && (isUp
        ? <RiseOutlined style={{ fontSize: 10, color }} />
        : <FallOutlined style={{ fontSize: 10, color }} />
      )}
      <Text style={{ fontSize: 11, color, fontWeight: 500 }}>
        {pct === 0 ? 'Same as yesterday' : `${Math.abs(pct)}% vs yesterday`}
      </Text>
    </div>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function HeatmapGrid({ data }) {
  if (!data?.cells?.length) {
    return <Empty description="No data for this period" style={{ padding: 32 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  const { cells, maxCount } = data;
  const DOW   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const cellMap = {};
  cells.forEach((c) => { cellMap[`${c.dow}-${c.hour}`] = c.count; });
  const alpha = (n) => Math.max(0.07, n / maxCount);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 0, minWidth: 560 }}>
        {/* DOW labels */}
        <div style={{ paddingTop: 18, paddingRight: 8, flexShrink: 0 }}>
          {DOW.map((d) => (
            <div key={d} style={{
              height: 18, lineHeight: '18px', marginBottom: 2,
              fontSize: 10, color: C.textMuted, textAlign: 'right', width: 26,
            }}>
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ flex: 1 }}>
          {/* Hour labels */}
          <div style={{ display: 'flex', height: 16, marginBottom: 2 }}>
            {HOURS.map((h) => (
              <div key={h} style={{
                flex: 1, fontSize: 9, color: C.textMuted, textAlign: 'center', lineHeight: '16px',
              }}>
                {h % 6 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {DOW.map((_, dow) => (
            <div key={dow} style={{ display: 'flex', marginBottom: 2 }}>
              {HOURS.map((h) => {
                const count = cellMap[`${dow}-${h}`] || 0;
                return (
                  <Tooltip key={h} title={`${DOW[dow]} ${h}:00 — ${count} logs`} mouseEnterDelay={0}>
                    <div style={{
                      flex: 1, height: 18, borderRadius: 2,
                      background: count
                        ? `rgba(108,71,255,${alpha(count)})`
                        : '#f3f2f5',
                      cursor: 'default',
                    }} />
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: C.textMuted }}>Low</Text>
        {[0.07, 0.22, 0.42, 0.65, 1].map((a) => (
          <div key={a} style={{
            width: 13, height: 13, borderRadius: 2,
            background: `rgba(108,71,255,${a})`,
          }} />
        ))}
        <Text style={{ fontSize: 10, color: C.textMuted }}>High</Text>
      </div>
    </div>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
const ChartTooltipStyle = {
  fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)', background: '#fff',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [trendPeriod, setTrendPeriod] = useState('7d');
  const { organization } = useAuth();
  const navigate = useNavigate();

  const { data: overview,        isLoading: loadingOverview }  = useQuery({ queryKey: ['dashboard-overview'],          queryFn: getOverview });
  const { data: logsOverTime,    isLoading: loadingTrend }     = useQuery({ queryKey: ['dashboard-logs-over-time', trendPeriod], queryFn: () => getLogsOverTime(trendPeriod) });
  const { data: appHealth }      = useQuery({ queryKey: ['dashboard-app-health'],         queryFn: getAppHealth });
  const { data: topErrors }      = useQuery({ queryKey: ['dashboard-top-errors'],         queryFn: getTopErrors });
  const { data: spike }          = useQuery({ queryKey: ['dashboard-error-spike'],        queryFn: getErrorSpike });
  const { data: heatmap }        = useQuery({ queryKey: ['dashboard-heatmap'],            queryFn: getHeatmap });
  const { data: recentFatals }   = useQuery({ queryKey: ['dashboard-recent-fatals'],     queryFn: getRecentFatals });
  const { data: todayVsYday }    = useQuery({ queryKey: ['dashboard-today-vs-yesterday'],queryFn: getTodayVsYesterday });
  const { data: appBreakdown }   = useQuery({ queryKey: ['dashboard-app-breakdown'],     queryFn: getAppBreakdown });

  if (loadingOverview) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
        <Row gutter={[12, 12]}><Col span={24}><Skeleton active paragraph={{ rows: 8 }} /></Col></Row>
      </div>
    );
  }

  const tvyT = todayVsYday?.today;
  const tvyY = todayVsYday?.yesterday;

  const trendData = (logsOverTime?.data || []).map((d) => ({
    ...d,
    label: d.bucket?.slice(5),
    errors: (d.ERROR || 0) + (d.FATAL || 0),
  }));

  const breakdownData = (appBreakdown || []).slice(0, 8).map((a) => ({
    name: a.name.length > 12 ? a.name.slice(0, 12) + '…' : a.name,
    Info:  a.INFO  || 0,
    Debug: a.DEBUG || 0,
    Warn:  a.WARN  || 0,
    Error: (a.ERROR || 0) + (a.FATAL || 0),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <Text style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: -0.4, display: 'block' }}>
          {organization?.name || 'Dashboard'}
        </Text>
        <Text style={{ fontSize: 13, color: C.textSub, marginTop: 2, display: 'block' }}>
          Real-time overview of your organization
        </Text>
      </div>

      {/* ── Spike alert ─────────────────────────────────────── */}
      {spike?.isSpike && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', borderRadius: 8,
          background: '#fff1f2', border: `1px solid ${C.error}30`,
        }}>
          <AlertOutlined style={{ fontSize: 15, color: C.error, flexShrink: 0 }} />
          <div>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#be123c', display: 'block' }}>
              Error spike detected
            </Text>
            <Text style={{ fontSize: 12, color: '#e5254b' }}>
              {spike.lastHour} errors in the last hour — {spike.spikeRatio}× your {spike.avgHourly} hourly average
            </Text>
          </div>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────── */}
      <Section title="At a glance">
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} lg={4}>
            <KpiCard
              icon={<AppstoreOutlined />}
              label="Applications"
              value={overview?.apps ?? 0}
              accentColor={C.primary}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <KpiCard
              icon={<TeamOutlined />}
              label="Members"
              value={overview?.members ?? 0}
              accentColor={C.primary}
            />
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <KpiCard
              icon={<DatabaseOutlined />}
              label="Total Logs"
              value={(overview?.totalLogs ?? 0).toLocaleString()}
              accentColor={C.primary}
              trend={tvyT && <TrendBadge today={tvyT.total} yesterday={tvyY?.total ?? 0} />}
            />
          </Col>
          <Col xs={12} sm={8} lg={5}>
            <KpiCard
              icon={<CloseCircleOutlined />}
              label="Errors"
              value={(overview?.errors ?? 0).toLocaleString()}
              accentColor={C.error}
              trend={tvyT && <TrendBadge today={tvyT.errors} yesterday={tvyY?.errors ?? 0} invert />}
            />
          </Col>
          <Col xs={12} sm={8} lg={5}>
            <KpiCard
              icon={<WarningOutlined />}
              label="Warnings"
              value={(overview?.warnings ?? 0).toLocaleString()}
              accentColor={C.warn}
              trend={tvyT && <TrendBadge today={tvyT.warnings} yesterday={tvyY?.warnings ?? 0} invert />}
            />
          </Col>
        </Row>
      </Section>

      {/* ── Trends + Health ─────────────────────────────────── */}
      <Section title="Trends & Health">
        <Row gutter={[12, 12]}>
          {/* Log trend line chart */}
          <Col xs={24} lg={15}>
            <Panel
              title="Log Volume Over Time"
              action={
                <Segmented
                  size="small"
                  value={trendPeriod}
                  onChange={setTrendPeriod}
                  options={[
                    { label: '24 h', value: '24h' },
                    { label: '7 d',  value: '7d'  },
                    { label: '30 d', value: '30d' },
                  ]}
                  style={{ fontSize: 12 }}
                />
              }
            >
              {loadingTrend
                ? <Skeleton active paragraph={{ rows: 5 }} />
                : trendData.length > 0
                  ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.borderSub} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: C.textMuted }}
                          axisLine={{ stroke: C.border }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: C.textMuted }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip
                          contentStyle={ChartTooltipStyle}
                          cursor={{ stroke: C.primary, strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={7}
                          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        />
                        <Line type="monotone" dataKey="total"  name="Total"    stroke={C.primary} strokeWidth={2}   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="errors" name="Errors"   stroke={C.error}   strokeWidth={2}   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="WARN"   name="Warnings" stroke={C.warn}    strokeWidth={1.5} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )
                  : <Empty description="No log data for this period" style={{ padding: 48 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              }
            </Panel>
          </Col>

          {/* App health */}
          <Col xs={24} lg={9}>
            <Panel title="App Health" style={{ minHeight: 280 }}>
              {!(appHealth?.length)
                ? <Empty description="No applications" style={{ padding: 32 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {appHealth.map((app) => (
                      <div
                        key={app.uuid}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/logs/${app.uuid}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/logs/${app.uuid}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 7, cursor: 'pointer',
                          border: `1px solid ${HEALTH_BORDER[app.status]}`,
                          background: HEALTH_BG[app.status],
                          transition: 'box-shadow 150ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: HEALTH_COLOR[app.status],
                          boxShadow: app.status === 'critical' ? `0 0 0 3px ${HEALTH_COLOR.critical}30` : 'none',
                        }} />
                        <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {app.name}
                        </Text>
                        <div style={{
                          fontSize: 11, fontWeight: 700, color: HEALTH_COLOR[app.status],
                          background: '#fff', borderRadius: 4, padding: '1px 7px',
                          border: `1px solid ${HEALTH_BORDER[app.status]}`,
                        }}>
                          {app.errorRatio}% err
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
                      {[['healthy','Healthy'],['degraded','Degraded'],['critical','Critical']].map(([k, l]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: HEALTH_COLOR[k] }} />
                          <Text style={{ fontSize: 10, color: C.textMuted }}>{l}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
            </Panel>
          </Col>
        </Row>
      </Section>

      {/* ── Insights row ────────────────────────────────────── */}
      <Section title="Insights">
        <Row gutter={[12, 12]}>

          {/* Today vs Yesterday */}
          <Col xs={24} sm={12} lg={6}>
            <Panel title="Today vs Yesterday" style={{ minHeight: 260 }}>
              {!tvyT
                ? <Skeleton active paragraph={{ rows: 5 }} />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: 'Total',    today: tvyT.total,    yday: tvyY?.total    ?? 0, color: C.primary },
                      { label: 'Errors',   today: tvyT.errors,   yday: tvyY?.errors   ?? 0, color: C.error   },
                      { label: 'Warnings', today: tvyT.warnings, yday: tvyY?.warnings ?? 0, color: C.warn    },
                      { label: 'Info',     today: tvyT.info,     yday: tvyY?.info     ?? 0, color: C.info    },
                    ].map(({ label, today, yday, color }) => {
                      const pct = Math.min(100, (Math.max(today, yday) > 0
                        ? (today / Math.max(today, yday)) * 100 : 0));
                      return (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ fontSize: 12, color: C.textSub }}>{label}</Text>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                              <Text style={{ fontSize: 11, color: C.textMuted }}>{yday.toLocaleString()}</Text>
                              <Text style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{today.toLocaleString()}</Text>
                            </div>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: '#f0eff2', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3, background: color,
                              width: `${pct}%`, transition: 'width 500ms ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                    <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                      Numbers: yesterday · <strong>today</strong>
                    </Text>
                  </div>
                )
              }
            </Panel>
          </Col>

          {/* Top Errors */}
          <Col xs={24} sm={12} lg={10}>
            <Panel title="Top Errors" noPadding style={{ minHeight: 260 }}>
              {!(topErrors?.length)
                ? <div style={{ padding: 18 }}><Empty description="No errors — looking good!" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
                : topErrors.map((err, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '11px 18px',
                      borderBottom: i < topErrors.length - 1 ? `1px solid ${C.borderSub}` : 'none',
                    }}
                  >
                    {/* Rank + count */}
                    <div style={{ flexShrink: 0, textAlign: 'center', width: 36 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: C.textMuted,
                        lineHeight: 1, marginBottom: 3,
                      }}>
                        #{i + 1}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: C.error,
                        background: '#fff1f2', borderRadius: 4, padding: '2px 4px',
                        border: '1px solid #fecdd3',
                      }}>
                        {err.count}×
                      </div>
                    </div>
                    {/* Message + app */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: C.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 3,
                      }}>
                        {err.message}
                      </div>
                      <Text style={{ fontSize: 11, color: C.textMuted }}>{err.app_name}</Text>
                    </div>
                  </div>
                ))
              }
            </Panel>
          </Col>

          {/* Recent Fatals */}
          <Col xs={24} lg={8}>
            <Panel title="Recent Fatal Logs" noPadding style={{ minHeight: 260 }}>
              {!(recentFatals?.length)
                ? <div style={{ padding: 18 }}><Empty description="No fatal logs" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
                : recentFatals.map((log, i) => (
                  <div
                    key={log.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/logs/${log.app_uuid}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/logs/${log.app_uuid}`)}
                    style={{
                      padding: '11px 18px', cursor: 'pointer',
                      borderBottom: i < recentFatals.length - 1 ? `1px solid ${C.borderSub}` : 'none',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#faf9fb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {log.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: C.fatal,
                        background: '#fdf2f8', border: '1px solid #fbcfe8',
                        borderRadius: 3, padding: '1px 6px', letterSpacing: 0.3,
                      }}>
                        FATAL
                      </span>
                      <Text style={{ fontSize: 11, color: C.textMuted }}>{log.app_name} · {formatRelative(log.timestamp)}</Text>
                    </div>
                  </div>
                ))
              }
            </Panel>
          </Col>
        </Row>
      </Section>

      {/* ── Activity row ────────────────────────────────────── */}
      <Section title="Activity Patterns">
        <Row gutter={[12, 12]}>
          {/* Heatmap */}
          <Col xs={24} lg={12}>
            <Panel title="Peak Hours — last 30 days">
              <HeatmapGrid data={heatmap} />
            </Panel>
          </Col>

          {/* Per-app stacked bar */}
          <Col xs={24} lg={12}>
            <Panel title="Log Breakdown by App">
              {!breakdownData.length
                ? <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={breakdownData}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C.borderSub} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: C.textMuted }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: C.textSub }}
                        axisLine={false}
                        tickLine={false}
                        width={76}
                      />
                      <RTooltip contentStyle={ChartTooltipStyle} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar dataKey="Info"  stackId="s" fill={C.info}  />
                      <Bar dataKey="Debug" stackId="s" fill={C.debug} />
                      <Bar dataKey="Warn"  stackId="s" fill={C.warn}  />
                      <Bar dataKey="Error" stackId="s" fill={C.error} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </Panel>
          </Col>
        </Row>
      </Section>

      {/* ── Applications table ──────────────────────────────── */}
      <Section title="Applications">
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, boxShadow: C.shadow, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 18px', borderBottom: `1px solid ${C.borderSub}`,
            background: '#fcfbfd',
          }}>
            <Text style={{ fontSize: 13, fontWeight: 600, color: C.text }}>All Applications</Text>
            <Button
              type="link" size="small" icon={<ArrowRightOutlined />}
              onClick={() => navigate('/apps')}
              style={{ fontSize: 12, color: C.primary, fontWeight: 500, padding: 0 }}
            >
              Manage
            </Button>
          </div>

          {!(overview?.appActivity?.length)
            ? (
              <Empty description="No applications yet" style={{ padding: 40 }} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="primary" size="small" onClick={() => navigate('/apps')}>Create App</Button>
              </Empty>
            )
            : (
              <>
                {/* Table header */}
                <div style={{
                  display: 'flex', padding: '8px 18px',
                  borderBottom: `1px solid ${C.borderSub}`, background: '#faf9fb',
                }}>
                  <Text style={{ flex: 1, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>Name</Text>
                  <Text style={{ width: 90, textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>Log Count</Text>
                  <Text style={{ width: 130, textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>Last Active</Text>
                </div>
                {overview.appActivity.map((app, i) => (
                  <div
                    key={app.uuid}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/logs/${app.uuid}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/logs/${app.uuid}`)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '11px 18px',
                      borderBottom: i < overview.appActivity.length - 1 ? `1px solid ${C.borderSub}` : 'none',
                      cursor: 'pointer', transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f6f5f8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: app.logCount > 0 ? C.info : C.textMuted,
                      }} />
                      <Text style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{app.name}</Text>
                    </div>
                    <div style={{ width: 90, textAlign: 'right' }}>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        {app.logCount.toLocaleString()}
                      </Text>
                    </div>
                    <div style={{ width: 130, textAlign: 'right' }}>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>
                        {app.lastActivity ? formatRelative(app.lastActivity) : '—'}
                      </Text>
                    </div>
                  </div>
                ))}
              </>
            )
          }
        </div>
      </Section>

    </div>
  );
}
