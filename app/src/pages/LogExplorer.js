import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Switch, Space, Skeleton, Select, Input, Table, Tag, Segmented, Button } from 'antd';
import { ReloadOutlined, UnorderedListOutlined, GroupOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import LogFilters from '../components/LogFilters';
import LogTable from '../components/LogTable';
import StatsCards from '../components/StatsCards';
import { useLogs, useLogStats } from '../hooks/useLogs';
import { useApp } from '../hooks/useApps';
import { getLogGroups } from '../api/logs';
import { formatDate } from '../utils/formatters';

const { Text } = Typography;

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: start.toISOString(), to: now.toISOString() };
}

const defaultFilters = {
  level: undefined,
  ...todayRange(),
  search: undefined, tag: undefined,
  metaKey: undefined, metaValue: undefined,
  page: 1, limit: 50,
};

function GroupView({ appUuid, groupBy, metaKey, filters, onDrillDown }) {
  const [groupSearch, setGroupSearch] = useState('');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['logGroups', appUuid, groupBy, metaKey, filters.from, filters.to, filters.level, filters.search, filters.tag, groupSearch],
    queryFn: () => getLogGroups(appUuid, { by: groupBy, metaKey, from: filters.from, to: filters.to, level: filters.level, search: filters.search, tag: filters.tag, groupSearch: groupSearch || undefined }),
    enabled: !!appUuid && !!groupBy && (groupBy !== 'metadata' || !!metaKey),
  });

  const columns = [
    {
      title: groupBy === 'metadata' ? metaKey : groupBy,
      dataIndex: 'key',
      key: 'key',
      render: (val) => val != null ? (
        <Tag style={{ background: '#f0f0f2', border: 'none', color: '#3e3b45' }}>{String(val)}</Tag>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a, b) => a.count - b.count,
      render: (val) => <Text strong>{val.toLocaleString()}</Text>,
    },
    {
      title: 'Latest',
      dataIndex: 'latest',
      key: 'latest',
      width: 160,
      render: (val) => <Text style={{ fontSize: 12, color: '#80748c' }}>{val ? formatDate(val) : '—'}</Text>,
    },
    {
      title: 'Sample',
      dataIndex: 'sample',
      key: 'sample',
      ellipsis: true,
      render: (val) => <Text style={{ fontSize: 12, color: '#5b5864' }}>{val}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Input.Search
          placeholder={`Search by ${groupBy === 'metadata' ? metaKey : groupBy} value...`}
          allowClear
          size="small"
          style={{ width: 280 }}
          value={groupSearch}
          onChange={(e) => setGroupSearch(e.target.value)}
          onSearch={(v) => setGroupSearch(v)}
        />
      </div>
      <Table
        dataSource={groups || []}
        columns={columns}
        rowKey="key"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20, size: 'small', showTotal: (t) => <Text style={{ fontSize: 12, color: '#80748c' }}>{t} groups</Text> }}
        onRow={(record) => ({
          onClick: () => onDrillDown(record.key),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}

export default function LogExplorer() {
  const { appUuid } = useParams();
  const [filters, setFilters] = useState(defaultFilters);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [groupBy, setGroupBy] = useState('level');
  const [groupMetaKey, setGroupMetaKey] = useState('');
  const [drillDown, setDrillDown] = useState(null);

  const { data: app } = useApp(appUuid);

  // When drilled down, build proper filter for the group type
  const activeFilters = (() => {
    if (!drillDown) return filters;

    const base = { ...filters, page: 1 };

    if (drillDown.type === 'level') {
      return { ...base, level: drillDown.value };
    }
    if (drillDown.type === 'tag') {
      return { ...base, tag: drillDown.value };
    }
    if (drillDown.type === 'metadata') {
      return { ...base, metaKey: drillDown.metaKey, metaValue: String(drillDown.value) };
    }
    return base;
  })();

  const { data: logsData, isLoading } = useLogs(appUuid, activeFilters, {
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const { data: stats } = useLogStats(appUuid, { from: filters.from, to: filters.to });

  const handlePageChange = (page, pageSize) => {
    if (drillDown) {
      setFilters((prev) => ({ ...prev, page, limit: pageSize }));
    } else {
      setFilters((prev) => ({ ...prev, page, limit: pageSize }));
    }
  };

  const handleDrillDown = (groupValue) => {
    setDrillDown({
      type: groupBy,
      value: groupValue,
      metaKey: groupBy === 'metadata' ? groupMetaKey : undefined,
    });
    setViewMode('list');
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const handleBackToGroups = () => {
    setDrillDown(null);
    setViewMode('group');
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setDrillDown(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          {drillDown && (
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBackToGroups} size="small" style={{ color: '#7553ff' }} />
          )}
          <Text strong style={{ fontSize: 20, color: '#3e3b45' }}>
            {app?.name || 'Logs'}
          </Text>
          {drillDown && (
            <Tag color="purple" style={{ marginLeft: 4 }}>
              {drillDown.type === 'metadata' ? drillDown.metaKey : drillDown.type}: {String(drillDown.value)}
            </Tag>
          )}
        </Space>
        <Space size={12}>
          <Segmented
            size="small"
            value={drillDown ? 'list' : viewMode}
            onChange={(v) => { setViewMode(v); setDrillDown(null); }}
            options={[
              { value: 'list', icon: <UnorderedListOutlined />, label: 'List' },
              { value: 'group', icon: <GroupOutlined />, label: 'Group' },
            ]}
          />
          <Space size={4}>
            <ReloadOutlined style={{ fontSize: 12, color: autoRefresh ? '#7553ff' : '#b5b0bd' }} />
            <Text style={{ fontSize: 12, color: '#80748c' }}>Auto-refresh</Text>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          </Space>
        </Space>
      </div>

      <div style={{ marginBottom: 12 }}>
        <StatsCards stats={stats} />
      </div>

      {!drillDown && (
        <LogFilters appUuid={appUuid} filters={filters} onChange={setFilters} onClear={handleClearFilters} />
      )}

      {viewMode === 'group' && !drillDown ? (
        <div>
          <Space style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: '#80748c' }}>Group by:</Text>
            <Select
              value={groupBy}
              onChange={(v) => { setGroupBy(v); setGroupMetaKey(''); }}
              size="small"
              style={{ width: 130 }}
              options={[
                { value: 'level', label: 'Level' },
                { value: 'tag', label: 'Tag' },
                { value: 'metadata', label: 'Metadata key' },
              ]}
            />
            {groupBy === 'metadata' && (
              <Input
                size="small"
                placeholder="e.g. user_id, module"
                value={groupMetaKey}
                onChange={(e) => setGroupMetaKey(e.target.value)}
                style={{ width: 160 }}
              />
            )}
          </Space>
          <GroupView appUuid={appUuid} groupBy={groupBy} metaKey={groupMetaKey} filters={filters} onDrillDown={handleDrillDown} />
        </div>
      ) : isLoading && !logsData ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <LogTable
          logs={logsData?.logs || []}
          pagination={logsData?.pagination}
          onPageChange={handlePageChange}
          loading={isLoading}
        />
      )}
    </div>
  );
}
