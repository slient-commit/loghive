import { useState } from 'react';
import {
  Typography, Button, Switch, Tag, Tooltip, Popconfirm, Empty,
  Drawer, Form, Input, Select, Radio, InputNumber, TimePicker,
  Divider, Row, Col, Checkbox, message, Spin, Space,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined,
  BellOutlined, ClockCircleOutlined, MailOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  getRules, createRule, updateRule, deleteRule, toggleRule,
  testRule, getMetaApps, getMetaMembers,
} from '../api/notifications';

const { Text, Title } = Typography;
const { Option } = Select;

const ALL_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const LEVEL_COLOR = { DEBUG: 'default', INFO: 'green', WARN: 'orange', ERROR: 'red', FATAL: 'magenta' };

const GROUPED_COL_DEFS = [
  { key: 'group',     label: 'Group',     required: true },
  { key: 'level',     label: 'Level',     required: true },
  { key: 'count',     label: 'Count',     required: true },
  { key: 'app',       label: 'App',       required: false, defaultShow: true },
  { key: 'last_seen', label: 'Last Seen', required: false, defaultShow: true },
  { key: 'sample',    label: 'Sample',    required: false, defaultShow: true },
];
const FLAT_COL_DEFS = [
  { key: 'time',    label: 'Time (UTC)', required: true },
  { key: 'level',   label: 'Level',      required: true },
  { key: 'message', label: 'Message',    required: true },
  { key: 'app',     label: 'App',        required: false, defaultShow: true },
  { key: 'tags',    label: 'Tags',       required: false, defaultShow: false },
];

const buildDefaultColConfig = () => ({
  grouped: {
    group:    { label: '' }, level: { label: '' }, count: { label: '' },
    app:      { show: true,  label: '' },
    last_seen:{ show: true,  label: '' },
    sample:   { show: true,  label: '' },
  },
  flat: {
    time:    { label: '' }, level: { label: '' }, message: { label: '' },
    app:     { show: true,  label: '' },
    tags:    { show: false, label: '' },
  },
});

const C = {
  border: '#e4e2e8', borderSub: '#f0eff2', bg: '#faf9fb', surface: '#fff',
  text: '#2b2833', textSub: '#6b7280', textMuted: '#9ca3af',
  primary: '#6c47ff',
  shadow: '0 1px 3px rgba(43,40,51,0.06)',
};

// ── Rule card ────────────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function RuleCard({ rule, onEdit, onToggle, onTest, onDelete }) {
  const rangeLabel = rule.time_range_type === 'last_24h'
    ? 'Last 24 h'
    : `Last ${rule.time_range_hours} h`;

  const daysLabel = (rule.schedule_days?.length > 0 && rule.schedule_days.length < 7)
    ? rule.schedule_days.map((d) => DAY_NAMES[d]).join(', ')
    : 'Every day';

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '16px 20px', boxShadow: C.shadow,
      borderLeft: `3px solid ${rule.enabled ? C.primary : C.textMuted}`,
      opacity: rule.enabled ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text strong style={{ fontSize: 14, color: C.text }}>{rule.name}</Text>
            {!rule.enabled && <Tag style={{ margin: 0 }}>Disabled</Tag>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: C.textSub }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined />
              {(rule.schedule_times || []).join(', ')} UTC · {daysLabel} · {rangeLabel}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MailOutlined />
              {rule.email_config_type === 'custom' ? 'Custom SMTP' : 'System config'}
              {' · '}
              {rule.recipient_type === 'org_users'
                ? 'All members'
                : `${(rule.recipients || []).length} email(s)`}
            </span>
          </div>

          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(rule.log_levels || []).map((l) => (
              <Tag key={l} color={LEVEL_COLOR[l]} style={{ margin: 0, fontSize: 10 }}>{l}</Tag>
            ))}
            {rule.group_by !== 'none' && (
              <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>
                grouped by {rule.group_by}{rule.group_meta_key ? `:${rule.group_meta_key}` : ''}
              </Tag>
            )}
            <Tag style={{ margin: 0, fontSize: 10, color: C.textMuted, background: '#f3f2f5', border: 'none' }}>
              {rule.lines_per_email} lines/email · {rule.email_delay_seconds}s delay
            </Tag>
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Tooltip title={rule.enabled ? 'Disable' : 'Enable'}>
            <Switch
              checked={rule.enabled}
              onChange={() => onToggle(rule)}
              size="small"
              style={{ background: rule.enabled ? C.primary : undefined }}
            />
          </Tooltip>
          <Tooltip title="Send test now">
            <Button
              icon={<SendOutlined />} size="small" type="text"
              style={{ color: C.textSub }}
              onClick={() => onTest(rule)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />} size="small" type="text"
              style={{ color: C.textSub }}
              onClick={() => onEdit(rule)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this notification rule?"
            description="This cannot be undone."
            okText="Delete" okType="danger" cancelText="Cancel"
            onConfirm={() => onDelete(rule)}
          >
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" type="text" danger />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

// ── Rule form drawer ──────────────────────────────────────────────────────────
function RuleDrawer({ open, rule, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [emailConfigType, setEmailConfigType] = useState('system');
  const [recipientType, setRecipientType] = useState('org_users');
  const [groupBy, setGroupBy] = useState('none');
  const [timeRangeType, setTimeRangeType] = useState('last_24h');
  const [templateType, setTemplateType] = useState('default');
  const [colConfig, setColConfig] = useState(buildDefaultColConfig());

  const qc = useQueryClient();

  const { data: apps = [], isLoading: loadingApps } = useQuery({ queryKey: ['notif-meta-apps'], queryFn: getMetaApps });
  const { data: members = [] } = useQuery({ queryKey: ['notif-meta-members'], queryFn: getMetaMembers });

  const saveMut = useMutation({
    mutationFn: (values) => rule ? updateRule(rule.uuid, values) : createRule(values),
    onSuccess: () => {
      qc.invalidateQueries(['notification-rules']);
      message.success(rule ? 'Rule updated' : 'Rule created');
      onSaved();
    },
    onError: (err) => {
      message.error(err.response?.data?.error || 'Failed to save rule');
    },
  });

  // Populate form when editing
  const handleOpen = () => {
    if (rule) {
      form.setFieldsValue({
        ...rule,
        schedule_times_picker: rule.schedule_times || [],
      });
      setEmailConfigType(rule.email_config_type || 'system');
      setRecipientType(rule.recipient_type || 'org_users');
      setGroupBy(rule.group_by || 'none');
      setTimeRangeType(rule.time_range_type || 'last_24h');
      setTemplateType(rule.email_template_type || 'default');
      const saved = rule.email_columns || {};
      const def = buildDefaultColConfig();
      const mergeMode = (defaults, savedMode) => {
        const result = {};
        Object.keys(defaults).forEach((k) => { result[k] = { ...defaults[k], ...(savedMode?.[k] || {}) }; });
        return result;
      };
      setColConfig({ grouped: mergeMode(def.grouped, saved.grouped), flat: mergeMode(def.flat, saved.flat) });
    } else {
      form.resetFields();
      form.setFieldsValue({
        enabled: true,
        email_config_type: 'system',
        recipient_type: 'org_users',
        log_levels: ['ERROR', 'FATAL'],
        group_by: 'none',
        time_range_type: 'last_24h',
        time_range_hours: 24,
        lines_per_email: 10,
        email_delay_seconds: 6,
        smtp_port: 587,
        email_template_type: 'default',
        schedule_days: [],
      });
      setEmailConfigType('system');
      setRecipientType('org_users');
      setGroupBy('none');
      setTimeRangeType('last_24h');
      setTemplateType('default');
      setColConfig(buildDefaultColConfig());
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const times = (values.schedule_times_picker || []).map((t) =>
        dayjs.isDayjs(t) ? t.format('HH:mm') : String(t)
      );
      const { schedule_times_picker: _, ...rest } = values;
      saveMut.mutate({ ...rest, schedule_times: times, email_columns: colConfig });
    } catch {
      // validation error shown by form
    }
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: C.textSub };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellOutlined style={{ color: C.primary }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {rule ? 'Edit Notification Rule' : 'New Notification Rule'}
          </span>
        </div>
      }
      open={open}
      onClose={onClose}
      afterOpenChange={(v) => v && handleOpen()}
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saveMut.isPending} onClick={handleSubmit}
            style={{ background: C.primary, borderColor: C.primary }}>
            {rule ? 'Save changes' : 'Create rule'}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" size="middle">

        {/* ── Basic ── */}
        <div style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
            Basic
          </Text>
        </div>

        <Form.Item name="name" label={<span style={labelStyle}>Rule name</span>}
          rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Daily error summary" />
        </Form.Item>

        <Form.Item
          name="subject_template"
          label={<span style={labelStyle}>Email subject</span>}
          extra={
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, color: C.textMuted, marginRight: 6 }}>Insert variable:</span>
              {['{rule_name}', '{date}', '{time}', '{app_names}', '{log_count}', '{levels}', '{range}'].map((v) => (
                <span
                  key={v}
                  style={{
                    display: 'inline-block', marginRight: 4, marginBottom: 4,
                    fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                    background: '#f0ebff', color: C.primary, border: `1px solid #d4c5ff`,
                    borderRadius: 4, padding: '1px 5px',
                  }}
                  onClick={() => {
                    const cur = form.getFieldValue('subject_template') || '';
                    form.setFieldValue('subject_template', cur + v);
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          }
        >
          <Input placeholder="[LogHive] {rule_name} — {log_count} log(s)  (leave blank for default)" />
        </Form.Item>

        <Form.Item name="enabled" label={<span style={labelStyle}>Enabled</span>} valuePropName="checked">
          <Switch />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Schedule ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Schedule (UTC)
        </Text>

        <Form.Item
          name="schedule_times_picker"
          label={<span style={labelStyle}>Send at (UTC times, one or more)</span>}
          style={{ marginTop: 8 }}
          rules={[{ required: true, message: 'At least one time is required' }]}
        >
          <Select
            mode="tags"
            placeholder='Type "HH:MM" and press Enter, or pick below'
            tokenSeparators={[',',' ']}
            dropdownRender={(menu) => (
              <>
                <div style={{ padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['06:00','08:00','09:00','12:00','17:00','18:00','22:00'].map((t) => (
                    <Button
                      key={t}
                      size="small"
                      type="text"
                      style={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 4 }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const cur = form.getFieldValue('schedule_times_picker') || [];
                        if (!cur.includes(t)) form.setFieldValue('schedule_times_picker', [...cur, t]);
                      }}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
                {menu}
              </>
            )}
          />
        </Form.Item>

        <Form.Item name="schedule_days" label={<span style={labelStyle}>Days of week (empty = every day)</span>}>
          <Checkbox.Group>
            <Row gutter={[8, 8]}>
              {[
                { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 },
                { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
                { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
                { label: 'Sat', value: 6 },
              ].map(({ label, value }) => (
                <Col key={value}>
                  <Checkbox value={value}>
                    <span style={{ fontSize: 12 }}>{label}</span>
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item name="time_range_type" label={<span style={labelStyle}>Log time range</span>}>
          <Radio.Group onChange={(e) => setTimeRangeType(e.target.value)}>
            <Radio value="last_24h">Everything in the last 24 hours</Radio>
            <Radio value="interval">Custom interval before send time</Radio>
          </Radio.Group>
        </Form.Item>

        {timeRangeType === 'interval' && (
          <Form.Item name="time_range_hours" label={<span style={labelStyle}>Hours before send time</span>}
            rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={0.25} max={168} step={0.5} style={{ width: 120 }}
              addonAfter="hours" placeholder="e.g. 3" />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Log filters ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Log Filters
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

        <Form.Item name="log_levels" label={<span style={labelStyle}>Log levels</span>}>
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

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Grouping ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Grouping
        </Text>

        <Form.Item name="group_by" label={<span style={labelStyle}>Group logs by</span>} style={{ marginTop: 8 }}>
          <Select onChange={setGroupBy}>
            <Option value="none">No grouping (flat list)</Option>
            <Option value="level">Level</Option>
            <Option value="tag">Tag</Option>
            <Option value="metadata">Metadata key</Option>
          </Select>
        </Form.Item>

        {groupBy === 'metadata' && (
          <Form.Item name="group_meta_key" label={<span style={labelStyle}>Metadata key</span>}
            rules={[{ required: true, message: 'Required when grouping by metadata' }]}>
            <Input placeholder="e.g. service or userId" />
          </Form.Item>
        )}

        {groupBy !== 'none' && (
          <Form.Item
            name="group_link_url"
            label={<span style={labelStyle}>Group value link URL</span>}
            extra={<span style={{ fontSize: 11, color: C.textMuted }}>Use <code style={{ fontSize: 11 }}>{'{grouping_value}'}</code> as a variable — e.g. <code style={{ fontSize: 11 }}>https://app.example.com/errors/{'{grouping_value}'}</code></span>}
          >
            <Input placeholder={`https://app.example.com/errors/{grouping_value}`} />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Columns ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Email Columns
        </Text>
        <div style={{ marginTop: 8 }}>
          {[
            { mode: 'grouped', defs: GROUPED_COL_DEFS, title: 'Grouped view columns' },
            { mode: 'flat',    defs: FLAT_COL_DEFS,    title: 'Flat list columns' },
          ].map(({ mode, defs, title }) => (
            <div key={mode} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
                {title}
                {((mode === 'grouped' && groupBy === 'none') || (mode === 'flat' && groupBy !== 'none')) && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: C.textMuted, fontWeight: 400 }}>(not active with current grouping)</span>
                )}
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                {defs.map((col, idx) => (
                  <div key={col.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                    background: idx % 2 === 0 ? '#fff' : C.bg,
                    borderBottom: idx < defs.length - 1 ? `1px solid ${C.borderSub}` : 'none',
                  }}>
                    {/* Visibility toggle (optional only) */}
                    <div style={{ width: 30, display: 'flex', justifyContent: 'center' }}>
                      {col.required ? (
                        <Tag style={{ margin: 0, fontSize: 9, padding: '0 4px', lineHeight: '16px' }}>req</Tag>
                      ) : (
                        <Switch
                          size="small"
                          checked={colConfig[mode][col.key]?.show ?? col.defaultShow}
                          onChange={(checked) => setColConfig((prev) => ({
                            ...prev,
                            [mode]: { ...prev[mode], [col.key]: { ...prev[mode][col.key], show: checked } },
                          }))}
                          style={{ background: (colConfig[mode][col.key]?.show ?? col.defaultShow) ? C.primary : undefined }}
                        />
                      )}
                    </div>
                    {/* Default column name */}
                    <span style={{ width: 80, fontSize: 12, color: C.textSub, flexShrink: 0 }}>{col.label}</span>
                    {/* Custom label input */}
                    <Input
                      size="small"
                      placeholder={`Custom label (default: ${col.label})`}
                      value={colConfig[mode][col.key]?.label || ''}
                      onChange={(e) => setColConfig((prev) => ({
                        ...prev,
                        [mode]: { ...prev[mode], [col.key]: { ...prev[mode][col.key], label: e.target.value } },
                      }))}
                      style={{ flex: 1, fontSize: 12 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Batching ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Email Batching
        </Text>

        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Form.Item name="lines_per_email" label={<span style={labelStyle}>Lines per email</span>}>
              <InputNumber min={1} max={500} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email_delay_seconds" label={<span style={labelStyle}>Delay between emails (seconds)</span>}>
              <InputNumber min={1} max={300} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

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
            <Select
              mode="tags"
              placeholder="Type email and press Enter"
              tokenSeparators={[',',' ']}
              options={members.map((m) => ({ value: m.email, label: m.email }))}
            />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Email Template ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Email Template
        </Text>

        <Form.Item name="email_template_type" label={<span style={labelStyle}>Template style</span>} style={{ marginTop: 8 }}>
          <Radio.Group onChange={(e) => setTemplateType(e.target.value)}>
            <Radio value="default">Default</Radio>
            <Radio value="teams">Microsoft Teams style</Radio>
            <Radio value="custom">Custom HTML</Radio>
          </Radio.Group>
        </Form.Item>

        {templateType === 'default' && (
          <div style={{ fontSize: 12, color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
            Clean table layout with log rows, filters summary, and pagination info.
          </div>
        )}

        {templateType === 'teams' && (
          <div style={{ fontSize: 12, color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
            Rich dark-header email with stats cards (log count, levels, apps) and grouped or flat log cards.
          </div>
        )}

        {templateType === 'custom' && (
          <Form.Item
            name="email_template_custom"
            label={<span style={labelStyle}>Custom HTML body</span>}
            rules={[{ required: true, message: 'Paste your HTML template' }]}
            extra={
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: C.textMuted, marginRight: 6 }}>Available variables:</span>
                {['{rule_name}', '{date}', '{time}', '{app_names}', '{log_count}', '{levels}', '{range}', '{log_table}'].map((v) => (
                  <span
                    key={v}
                    style={{
                      display: 'inline-block', marginRight: 4, marginBottom: 4,
                      fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                      background: v === '{log_table}' ? '#fff7ed' : '#f0ebff',
                      color: v === '{log_table}' ? '#c2410c' : C.primary,
                      border: `1px solid ${v === '{log_table}' ? '#fed7aa' : '#d4c5ff'}`,
                      borderRadius: 4, padding: '1px 5px',
                    }}
                    onClick={() => {
                      const cur = form.getFieldValue('email_template_custom') || '';
                      form.setFieldValue('email_template_custom', cur + v);
                    }}
                  >
                    {v}
                  </span>
                ))}
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  <strong style={{ color: '#c2410c' }}>{'{log_table}'}</strong> injects the full log table HTML at that position.
                </div>
              </div>
            }
          >
            <Input.TextArea
              rows={10}
              placeholder={`<!DOCTYPE html>\n<html><body>\n  <h2>{rule_name}</h2>\n  <p>{date} · {range} · {log_count} log(s)</p>\n  {log_table}\n</body></html>`}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Email config ── */}
        <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: C.textMuted }}>
          Email Config
        </Text>

        <Form.Item name="email_config_type" label={<span style={labelStyle}>Send via</span>} style={{ marginTop: 8 }}>
          <Radio.Group onChange={(e) => setEmailConfigType(e.target.value)}>
            <Radio value="system">System email config (Settings → Email)</Radio>
            <Radio value="custom">Custom SMTP for this rule only</Radio>
          </Radio.Group>
        </Form.Item>

        {emailConfigType === 'custom' && (
          <>
            <Row gutter={12}>
              <Col span={16}>
                <Form.Item name="smtp_host" label={<span style={labelStyle}>SMTP Host</span>}
                  rules={[{ required: true, message: 'Required' }]}>
                  <Input placeholder="smtp.example.com" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="smtp_port" label={<span style={labelStyle}>Port</span>}>
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="smtp_user" label={<span style={labelStyle}>Username</span>}>
                  <Input placeholder="user@example.com" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="smtp_pass" label={<span style={labelStyle}>Password</span>}>
                  <Input.Password placeholder="••••••••" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="smtp_from" label={<span style={labelStyle}>From address</span>}
              rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="alerts@yourcompany.com" />
            </Form.Item>
          </>
        )}

      </Form>
    </Drawer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Notifications() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const qc = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['notification-rules'],
    queryFn: getRules,
  });

  const toggleMut = useMutation({
    mutationFn: (rule) => toggleRule(rule.uuid),
    onSuccess: (data, rule) => {
      qc.invalidateQueries(['notification-rules']);
      message.success(`Rule ${data.enabled ? 'enabled' : 'disabled'}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (rule) => deleteRule(rule.uuid),
    onSuccess: () => {
      qc.invalidateQueries(['notification-rules']);
      message.success('Rule deleted');
    },
  });

  const testMut = useMutation({
    mutationFn: (rule) => testRule(rule.uuid),
    onSuccess: (data) => message.success(data.message),
    onError: (err) => message.error(err.response?.data?.error || 'Failed to trigger test'),
  });

  const openCreate = () => { setEditingRule(null); setDrawerOpen(true); };
  const openEdit = (rule) => { setEditingRule(rule); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingRule(null); };
  const onSaved = () => closeDrawer();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Text style={{ fontSize: 20, fontWeight: 700, color: '#2b2833', letterSpacing: -0.4, display: 'block' }}>
            Notification Rules
          </Text>
          <Text style={{ fontSize: 13, color: C.textSub, marginTop: 2, display: 'block' }}>
            Schedule email digests for your log data
          </Text>
        </div>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={openCreate}
          style={{ background: C.primary, borderColor: C.primary }}
        >
          New rule
        </Button>
      </div>

      {/* How it works */}
      <div style={{
        background: '#f0ebff', border: '1px solid #d4c5ff', borderRadius: 10,
        padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#5b3fd6',
      }}>
        <strong>How it works:</strong> Each rule runs on a cron schedule (UTC). When triggered it queries your logs
        for the chosen time range, groups them if configured, splits into batches of N lines per email,
        and sends them out with a configurable delay between emails.
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : rules.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 60, textAlign: 'center', boxShadow: C.shadow,
        }}>
          <Empty
            image={<BellOutlined style={{ fontSize: 48, color: C.textMuted }} />}
            description={
              <div>
                <Text style={{ fontSize: 14, color: C.textSub, display: 'block', marginBottom: 4 }}>
                  No notification rules yet
                </Text>
                <Text style={{ fontSize: 13, color: C.textMuted }}>
                  Create your first rule to receive scheduled log digests by email
                </Text>
              </div>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ background: C.primary, borderColor: C.primary }}>
              Create first rule
            </Button>
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.uuid}
              rule={rule}
              onEdit={openEdit}
              onToggle={(r) => toggleMut.mutate(r)}
              onTest={(r) => testMut.mutate(r)}
              onDelete={(r) => deleteMut.mutate(r)}
            />
          ))}
        </div>
      )}

      <RuleDrawer
        open={drawerOpen}
        rule={editingRule}
        onClose={closeDrawer}
        onSaved={onSaved}
      />
    </div>
  );
}
