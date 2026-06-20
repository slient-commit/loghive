import { Tag } from 'antd';
import { ROLE_LABELS, ROLE_COLORS } from '../utils/constants';

export default function RoleBadge({ role }) {
  return <Tag color={ROLE_COLORS[role] || 'default'}>{ROLE_LABELS[role] || role}</Tag>;
}
