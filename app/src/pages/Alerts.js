import { useState } from 'react';
import {
  Typography, Button, Switch, Tag, Tooltip, Popconfirm, Empty,
  Drawer, Form, Input, Select, Radio, InputNumber,
  Divider, Row, Col, Checkbox, message, Spin, Space, Slider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined,
  AlertOutlined, ClockCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule,
  toggleAlertRule, testAlertRule, getMetaApps,
} from '../api/alerts';

const { Text } = Typography;
const { Option } = Select;

const ALL_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const LEVEL_COLOR = { DEBUG: 'default', INFO: 'green', WARN: 'orange', ERROR: 'red', FATAL: 'magenta' };

const ALERT_TYPES = {
  error_spike: { label: 'Error Spike', color: '#dc2626', desc: 'Alert when error count exceeds a threshold in a time window' },
  low_volume:  { label: 'Low Volume',  color: '#d97706', desc: 'Alert when log volume drops below a percentage of the historical average' },
  no_logs:     { label: 'Silent App',  color: '#7c3aed', desc: 'Alert when an app stops sending logs for a period' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const C = {
  border: '#e4e2e8', bg: '#faf9fb', surface: '#fff',
  text: '#2b2833', textSub: '#6b7280', textMuted: '#9ca3af',
  primary: '#6c47ff', shadow: '0 1px 3px rgba(43,40,51,0.06)',
};

// ── Alert card ──────────────────────────────────────────────────────────────
function AlertCard({ rule, onEdit, onToggle, onTest, onDelete }) {
  const t = ALERT_TYPES[rule.alert_type] || {};
  const daysLabel = (rule.schedule_days?.length > 0 && rule.schedule_days.length < 7)
    ? rule.schedule_days.map((d) => DAY_NAMES[d]).join(', ')
    : 'Every day';

  let configLabel = '';
  if (rule.alert_type === 'error_spike') {
    configLabel = `${rule.spike_threshold}+ ${(rule.spike_levels || []).join('/')} in ${rule.spike_window_minutes}min`;
  } else if (rule.alert_type === 'low_volume') {
    configLabel = `Below ${rule.volume_percentage}% of ${rule.volume_baseline_days}-day avg`;
  } else if (rule.alert_type === 'no_logs') {
    configLabel = `Silent for ${rule.silence_hours}h+`;
  }

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '16px 20px', boxShadow: C.shadow,
      borderLeft: `3px solid ${rule.enabled ? (t.color || C.primary) : C.textMuted}`,
      opacity: rule.enabled ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text strong style={{ fontSize: 14, color: C.text }}>{rule.name}</Text>
            <Tag color={t.color} style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>{t.label}</Tag>
            {!rule.enabled && <Tag style={{ margin: 0 }}>Disabled</Tag>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: C.textSub }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined />
              {(rule.schedule_times || []).join(', ')} UTC · {daysLabel}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ThunderboltOutlined />
              {configLabel}
            </span>
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: C.textMuted }}>
            Cooldown: {rule.cooldown_hours}h
            {rule.last_triggered_at && ` · Last alert: ${new Date(rule.last_triggered_at).toUTCString().replace(' GMT', ' UTC')}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Tooltip title={rule.enabled ? 'Disable' : 'Enable'}>
            <Switch checked={rule.enabled} onChange={() => onToggle(rule)} size="small"
              style={{ background: rule.enabled ? (t.color || C.primary) : undefined }} />
          </Tooltip>
          <Tooltip title="Test now">
            <Button icon={<SendOutlined />} size="small" type="text" style={{ color: C.textSub }}
              onClick={() => onTest(rule)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} size="small" type="text" style={{ color: C.textSub }}
              onClick={() => onEdit(rule)} />
          </Tooltip>
          <Popconfirm title="Delete this alert rule?" okText="Delete" okType="danger" cancelText="Cancel"
            onConfirm={() => onDelete(rule)}>
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" type="text" danger />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

// ── Alert form drawer ───────────────────────────────────────────────────────
function AlertDrawer({ open, rule, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [alertType, setAlertType] = useState('error_spike');
  const [recipientType, setRecipientType] = useState('org_users');
  const [emailConfigType, setEmailConfigType] = useState('system');
  const qc = useQueryClient();

  const { data: apps = [], isLoading: loadingApps } = useQuery({ queryKey: ['alert-meta-apps'], queryFn: getMetaApps });

  const saveMut = useMutation({
    mutationFn: (values) => rule ? updateAlertRule(rule.uuid, values) : createAlertRule(values),
    onSuccess: () => {
      qc.invalidateQueries(['alert-rules']);
      message.success(rule ? 'Alert updated' : 'Alert created');
      onSaved();
    },
    onError: (err) => message.error(err.response?.data?.error || 'Failed to save'),
  });

  const handleOpen = () => {
    if (rule) {
      form.setFieldsValue(rule);
      setAlertType(rule.alert_type || 'error_spike');
      setRecipientType(rule.recipient_type || 'org_users');
      setEmailConfigType(rule.email_config_type || 'system');
    } else {
      form.resetFields();
      form.setFieldsValue({
        enabled: true, alert_type: 'error_spike',
        schedule_days: [], spike_window_minutes: 60,
        spike_threshold: 50, spike_levels: ['ERROR', 'FATAL'],
        volume_percentage: 10, volume_baseline_days: 7,
        silence_hours: 2, cooldown_hours: 24,
        recipient_type: 'org_users', email_config_type: 'system',
      });
      setAlertType('error_spike');
      setRecipientType('org_users');
      setEmailConfigType('system');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      saveMut.mutate(values);
    } catch { /* validation error */ }
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.textSub };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertOutlined style={{ color: ALERT_TYPES[alertType]?.color || C.primary }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {rule ? 'Edit Alert Rule' : 'New Alert Rule'}
          </span>
        </div>
      }
      open={open} onClose={onClose}
      afterOpenChange={(v) => v && handleOpen()}
      width={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saveMut.isPending} onClick={handleSubmit}
            style={{ background: C.primary, borderColor: C.primary }}>
            {rule ? 'Save changes' : 'Create alert'}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" size="middle">

        {/* ── Basic ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Basic
        </Text>

        <Form.Item name="name" label={<span style={labelStyle}>Alert name</span>} style={{ marginTop: 8 }}
          rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Error spike — production" />
        </Form.Item>

        <Form.Item name="alert_type" label={<span style={labelStyle}>Alert type</span>}
          rules={[{ required: true }]}>
          <Radio.Group onChange={(e) => setAlertType(e.target.value)}>
            {Object.entries(ALERT_TYPES).map(([key, { label, desc, color }]) => (
              <Radio key={key} value={key} style={{ display: 'block', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color }}>{label}</span>
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>{desc}</span>
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item name="enabled" label={<span style={labelStyle}>Enabled</span>} valuePropName="checked">
          <Switch />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Type-specific config ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Condition
        </Text>

        {alertType === 'error_spike' && (
          <>
            <Form.Item name="spike_levels" label={<span style={labelStyle}>Log levels to count</span>} style={{ marginTop: 8 }}>
              <Checkbox.Group>
                <Row gutter={[8, 8]}>
                  {ALL_LEVELS.map((l) => (
                    <Col key={l}>
                      <Checkbox value={l}>
                        <Tag color={LEVEL_COLOR[l]} style={{ margin: 0, fontSize: 11 }}>{l}</Tag>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="spike_threshold" label={<span style={labelStyle}>Threshold (count)</span>}
                  rules={[{ required: true }]}>
                  <InputNumber min={1} max={100000} style={{ width: '100%' }} placeholder="e.g. 50" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="spike_window_minutes" label={<span style={labelStyle}>Window (minutes)</span>}
                  rules={[{ required: true }]}>
                  <InputNumber min={5} max={1440} style={{ width: '100%' }} placeholder="e.g. 60" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {alertType === 'low_volume' && (
          <>
            <Form.Item name="volume_percentage" label={<span style={labelStyle}>Alert if below this % of average</span>}
              style={{ marginTop: 8 }} rules={[{ required: true }]}>
              <Slider min={0} max={100} step={5}
                marks={{ 0: '0%', 10: '10%', 25: '25%', 50: '50%', 100: '100%' }} />
            </Form.Item>
            <Form.Item name="volume_baseline_days" label={<span style={labelStyle}>Baseline period (days)</span>}
              rules={[{ required: true }]}>
              <Select>
                <Option value={3}>Last 3 days</Option>
                <Option value={7}>Last 7 days</Option>
                <Option value={14}>Last 14 days</Option>
                <Option value={30}>Last 30 days</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {alertType === 'no_logs' && (
          <Form.Item name="silence_hours" label={<span style={labelStyle}>Alert if no logs for (hours)</span>}
            style={{ marginTop: 8 }} rules={[{ required: true }]}>
            <InputNumber min={1} max={168} style={{ width: '100%' }} addonAfter="hours" placeholder="e.g. 2" />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Apps ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Scope
        </Text>

        <Form.Item name="app_uuids" label={<span style={labelStyle}>Applications (empty = all)</span>} style={{ marginTop: 8 }}>
          <Select mode="multiple" placeholder="All applications" loading={loadingApps}
            optionFilterProp="label" allowClear>
            {apps.map((a) => (
              <Option key={a.uuid} value={a.uuid} label={a.name}>
                {a.name}
                <Text style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>{a.environment}</Text>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Schedule ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Schedule (UTC)
        </Text>

        <Form.Item name="schedule_times" label={<span style={labelStyle}>Check at (UTC times)</span>}
          style={{ marginTop: 8 }} rules={[{ required: true, message: 'At least one time' }]}>
          <Select mode="tags" placeholder='Type "HH:MM" and press Enter' tokenSeparators={[',',' ']}
            dropdownRender={(menu) => (
              <>
                <div style={{ padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['06:00','08:00','09:00','12:00','13:00','17:00','18:00','22:00'].map((t) => (
                    <Button key={t} size="small" type="text"
                      style={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 4 }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const cur = form.getFieldValue('schedule_times') || [];
                        if (!cur.includes(t)) form.setFieldValue('schedule_times', [...cur, t]);
                      }}>{t}</Button>
                  ))}
                </div>
                {menu}
              </>
            )} />
        </Form.Item>

        <Form.Item name="schedule_days" label={<span style={labelStyle}>Days of week (empty = every day)</span>}>
          <Checkbox.Group>
            <Row gutter={[8, 8]}>
              {DAY_NAMES.map((label, value) => (
                <Col key={value}><Checkbox value={value}><span style={{ fontSize: 12 }}>{label}</span></Checkbox></Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item name="cooldown_hours" label={<span style={labelStyle}>Cooldown (don't re-alert within)</span>}>
          <InputNumber min={1} max={168} style={{ width: 120 }} addonAfter="hours" />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Recipients ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Recipients
        </Text>

        <Form.Item name="recipient_type" label={<span style={labelStyle}>Send to</span>} style={{ marginTop: 8 }}>
          <Radio.Group onChange={(e) => setRecipientType(e.target.value)}>
            <Radio value="org_users">All organization members</Radio>
            <Radio value="custom">Custom email list</Radio>
          </Radio.Group>
        </Form.Item>

        {recipientType === 'custom' && (
          <Form.Item name="recipients" label={<span style={labelStyle}>Email addresses</span>}
            rules={[{ required: true, message: 'Add at least one email' }]}>
            <Select mode="tags" placeholder="Type email and press Enter" tokenSeparators={[',',' ']} />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Email config ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Email Config
        </Text>

        <Form.Item name="email_config_type" label={<span style={labelStyle}>Send via</span>} style={{ marginTop: 8 }}>
          <Radio.Group onChange={(e) => setEmailConfigType(e.target.value)}>
            <Radio value="system">System email config</Radio>
            <Radio value="custom">Custom SMTP for this rule</Radio>
          </Radio.Group>
        </Form.Item>

        {emailConfigType === 'custom' && (
          <>
            <Row gutter={12}>
              <Col span={16}>
                <Form.Item name="smtp_host" label={<span style={labelStyle}>SMTP Host</span>}
                  rules={[{ required: true }]}><Input placeholder="smtp.example.com" /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="smtp_port" label={<span style={labelStyle}>Port</span>}>
                  <InputNumber style={{ width: '100%' }} /></Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="smtp_user" label={<span style={labelStyle}>Username</span>}>
                  <Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="smtp_pass" label={<span style={labelStyle}>Password</span>}>
                  <Input.Password /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="smtp_from" label={<span style={labelStyle}>From address</span>}
              rules={[{ required: true }]}><Input placeholder="alerts@yourcompany.com" /></Form.Item>
          </>
        )}

      </Form>
    </Drawer>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Alerts() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const qc = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: getAlertRules,
  });

  const toggleMut = useMutation({
    mutationFn: (rule) => toggleAlertRule(rule.uuid),
    onSuccess: (data) => {
      qc.invalidateQueries(['alert-rules']);
      message.success(`Alert ${data.enabled ? 'enabled' : 'disabled'}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (rule) => deleteAlertRule(rule.uuid),
    onSuccess: () => {
      qc.invalidateQueries(['alert-rules']);
      message.success('Alert deleted');
    },
  });

  const testMut = useMutation({
    mutationFn: (rule) => testAlertRule(rule.uuid),
    onSuccess: (data) => message.success(data.message),
    onError: (err) => message.error(err.response?.data?.error || 'Failed'),
  });

  const openCreate = () => { setEditingRule(null); setDrawerOpen(true); };
  const openEdit = (rule) => { setEditingRule(rule); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingRule(null); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Text style={{ fontSize: 20, fontWeight: 700, color: '#2b2833', letterSpacing: -0.4, display: 'block' }}>
            Alert Rules
          </Text>
          <Text style={{ fontSize: 13, color: C.textSub, marginTop: 2, display: 'block' }}>
            Monitor your apps for error spikes, low volume, and silence
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: C.primary, borderColor: C.primary }}>
          New alert
        </Button>
      </div>

      {/* Info box */}
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
        padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#991b1b',
      }}>
        <strong>How it works:</strong> Each alert runs at scheduled UTC times. It checks the condition
        (error spike, low volume, or silence) and sends an email if the threshold is breached.
        A cooldown prevents repeated alerts within a configurable window.
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : rules.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 60, textAlign: 'center', boxShadow: C.shadow,
        }}>
          <Empty
            image={<AlertOutlined style={{ fontSize: 48, color: C.textMuted }} />}
            description={
              <div>
                <Text style={{ fontSize: 14, color: C.textSub, display: 'block', marginBottom: 4 }}>
                  No alert rules yet
                </Text>
                <Text style={{ fontSize: 13, color: C.textMuted }}>
                  Create your first alert to monitor for error spikes, low volume, or silent apps
                </Text>
              </div>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ background: C.primary, borderColor: C.primary }}>
              Create first alert
            </Button>
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.map((rule) => (
            <AlertCard key={rule.uuid} rule={rule} onEdit={openEdit}
              onToggle={(r) => toggleMut.mutate(r)}
              onTest={(r) => testMut.mutate(r)}
              onDelete={(r) => deleteMut.mutate(r)} />
          ))}
        </div>
      )}

      <AlertDrawer open={drawerOpen} rule={editingRule} onClose={closeDrawer} onSaved={closeDrawer} />
    </div>
  );
}
