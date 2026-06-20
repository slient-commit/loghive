import { Table, Tag, Button, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { formatDate } from '../utils/formatters';

export default function ApiKeyTable({ keys, onRevoke, loading, canManage }) {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Prefix',
      dataIndex: 'key_prefix',
      key: 'key_prefix',
      render: (v) => <code>{v}...</code>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Active' : 'Revoked'}</Tag>
      ),
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (v) => (v ? formatDate(v) : 'Never'),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => formatDate(v),
    },
  ];

  if (canManage) {
    columns.push({
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) =>
        record.is_active && (
          <Popconfirm
            title="Revoke this API key?"
            description="This action cannot be undone."
            onConfirm={() => onRevoke(record.id)}
            okText="Revoke"
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        ),
    });
  }

  return <Table dataSource={keys} columns={columns} rowKey="id" loading={loading} size="small" />;
}
