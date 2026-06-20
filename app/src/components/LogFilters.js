import { Row, Col, Select, DatePicker, Input, Button, Space } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { LOG_LEVELS } from '../utils/constants';
import { getLogTags } from '../api/logs';

const { RangePicker } = DatePicker;
const { Search } = Input;

const LEVEL_DOTS = {
  DEBUG: '#b5b0bd', INFO: '#00f261', WARN: '#ffce00', ERROR: '#ff002b', FATAL: '#ff45a8',
};

export default function LogFilters({ appUuid, filters, onChange, onClear }) {
  const { data: tags } = useQuery({
    queryKey: ['logTags', appUuid],
    queryFn: () => getLogTags(appUuid),
    enabled: !!appUuid,
  });

  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value, page: 1 });
  };

  return (
    <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
      <Col xs={24} sm={12} md={6}>
        <Select
          placeholder="Log Level"
          value={filters.level}
          onChange={(v) => handleChange('level', v)}
          allowClear
          style={{ width: '100%' }}
          options={LOG_LEVELS.map((level) => ({
            value: level,
            label: (
              <span>
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', backgroundColor: LEVEL_DOTS[level],
                  marginRight: 8,
                }} />
                {level}
              </span>
            ),
          }))}
        />
      </Col>
      <Col xs={24} sm={12} md={6}>
        <RangePicker
          style={{ width: '100%' }}
          showTime
          onChange={(dates) => {
            onChange({
              ...filters,
              from: dates?.[0]?.toISOString(),
              to: dates?.[1]?.toISOString(),
              page: 1,
            });
          }}
          presets={[
            { label: 'Last 1h', value: [new Date(Date.now() - 3600000), new Date()] },
            { label: 'Last 6h', value: [new Date(Date.now() - 21600000), new Date()] },
            { label: 'Last 24h', value: [new Date(Date.now() - 86400000), new Date()] },
            { label: 'Last 7d', value: [new Date(Date.now() - 604800000), new Date()] },
          ]}
        />
      </Col>
      <Col xs={24} sm={12} md={5}>
        <Search
          placeholder="Search logs..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          onSearch={(v) => handleChange('search', v)}
          allowClear
        />
      </Col>
      <Col xs={24} sm={12} md={5}>
        <Select
          placeholder="Filter by tag"
          value={filters.tag}
          onChange={(v) => handleChange('tag', v)}
          allowClear
          style={{ width: '100%' }}
          options={(tags || []).map((tag) => ({ value: tag, label: tag }))}
          showSearch
        />
      </Col>
      <Col xs={24} sm={12} md={2}>
        <Button icon={<ClearOutlined />} onClick={onClear} block>
          Clear
        </Button>
      </Col>
    </Row>
  );
}
