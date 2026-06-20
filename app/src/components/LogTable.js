import { Table, Tag, Typography, Button, Space, Dropdown, message } from 'antd';
import { CopyOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import LogLevelTag from './LogLevelTag';
import { formatDate, truncate } from '../utils/formatters';

const { Text } = Typography;

function copyToClipboard(log) {
  const text = JSON.stringify({
    timestamp: log.timestamp,
    level: log.level,
    message: log.message,
    tags: log.tags,
    metadata: log.metadata,
  }, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    message.success('Log copied to clipboard');
  });
}

function exportLogs(logs, format) {
  let content, filename, type;

  if (format === 'json') {
    const data = logs.map(({ timestamp, level, message, tags, metadata }) => ({
      timestamp, level, message, tags, metadata,
    }));
    content = JSON.stringify(data, null, 2);
    filename = `logs-${new Date().toISOString().slice(0, 10)}.json`;
    type = 'application/json';
  } else {
    const header = 'timestamp,level,message,tags';
    const rows = logs.map((log) => {
      const msg = `"${(log.message || '').replace(/"/g, '""')}"`;
      const tags = `"${(log.tags || []).join(', ')}"`;
      return `${log.timestamp},${log.level},${msg},${tags}`;
    });
    content = [header, ...rows].join('\n');
    filename = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
    type = 'text/csv';
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  message.success(`Exported ${logs.length} logs as ${format.toUpperCase()}`);
}

const columns = [
  {
    title: 'Time',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 165,
    render: (val) => (
      <Text className="mono" style={{ fontSize: 12, color: '#8c869a', letterSpacing: -0.2 }}>
        {formatDate(val)}
      </Text>
    ),
    sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  },
  {
    title: 'Level',
    dataIndex: 'level',
    key: 'level',
    width: 90,
    render: (level) => <LogLevelTag level={level} />,
  },
  {
    title: 'Message',
    dataIndex: 'message',
    key: 'message',
    render: (msg) => (
      <Text style={{ fontSize: 13, color: '#2b2833', lineHeight: 1.5 }}>
        {truncate(msg, 120)}
      </Text>
    ),
  },
  {
    title: 'Tags',
    dataIndex: 'tags',
    key: 'tags',
    width: 200,
    render: (tags) =>
      (tags || []).map((tag) => (
        <Tag key={tag} style={{ marginBottom: 3, background: '#f0eff2', border: 'none', color: '#5b5468' }}>
          {tag}
        </Tag>
      )),
  },
];

export default function LogTable({ logs, pagination, onPageChange, loading }) {
  const exportMenuItems = [
    { key: 'json', icon: <FileTextOutlined />, label: 'Export as JSON', onClick: () => exportLogs(logs, 'json') },
    { key: 'csv', icon: <FileTextOutlined />, label: 'Export as CSV', onClick: () => exportLogs(logs, 'csv') },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
          <Button size="small" icon={<DownloadOutlined />}>Export</Button>
        </Dropdown>
      </div>
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="_id"
        loading={loading}
        size="small"
        pagination={{
          current: pagination?.page || 1,
          pageSize: pagination?.limit || 50,
          total: pagination?.total || 0,
          showSizeChanger: true,
          size: 'small',
          showTotal: (total) => <Text style={{ fontSize: 12, color: '#8c869a' }}>{total.toLocaleString()} logs</Text>,
          onChange: onPageChange,
        }}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(record)}>
                  Copy Log
                </Button>
              </div>

              <Text strong style={{ fontSize: 12, color: '#5b5468', display: 'block', marginBottom: 4 }}>Message</Text>
              <pre className="mono" style={{
                margin: '0 0 12px', padding: 14,
                background: '#f6f5f8', borderRadius: 6, fontSize: 12,
                overflow: 'auto', border: '1px solid #e4e2e8', color: '#2b2833',
                lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {record.message}
              </pre>

              {record.metadata && Object.keys(record.metadata).length > 0 && (
                <>
                  <Text strong style={{ fontSize: 12, color: '#5b5468', display: 'block', marginBottom: 4 }}>Metadata</Text>
                  <pre className="mono" style={{
                    margin: 0, padding: 14,
                    background: '#f6f5f8', borderRadius: 6, fontSize: 12,
                    overflow: 'auto', border: '1px solid #e4e2e8', color: '#2b2833',
                    lineHeight: 1.7,
                  }}>
                    {JSON.stringify(record.metadata, null, 2)}
                  </pre>
                </>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
