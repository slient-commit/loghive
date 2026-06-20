import { Select } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useApps } from '../hooks/useApps';

export default function AppSelector({ value, onChange, style }) {
  const { data: apps, isLoading } = useApps();

  return (
    <Select
      placeholder="Select an application"
      value={value}
      onChange={onChange}
      loading={isLoading}
      allowClear
      style={{ minWidth: 240, ...style }}
      suffixIcon={<AppstoreOutlined />}
      options={(apps || []).map((app) => ({
        value: app.uuid,
        label: app.name,
      }))}
    />
  );
}
