import { Table, Tag } from 'antd';
import RoleBadge from './RoleBadge';
import { STATUS_COLORS } from '../utils/constants';
import { formatDate } from '../utils/formatters';

const columns = [
  {
    title: 'Email',
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: 'Role',
    dataIndex: 'role',
    key: 'role',
    render: (role) => <RoleBadge role={role} />,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
  },
  {
    title: 'Joined',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (v) => formatDate(v),
  },
];

export default function MemberTable({ members, loading }) {
  return <Table dataSource={members} columns={columns} rowKey="id" loading={loading} size="small" />;
}
