import { Modal, Typography, Input, Button, message, Space } from 'antd';
import { CopyOutlined, WarningOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export default function ApiKeyModal({ open, apiKey, onClose }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    message.success('API key copied to clipboard');
  };

  return (
    <Modal
      title="API Key Generated"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>,
      ]}
    >
      <div style={{ padding: '16px 0' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: 12 }}>
            <WarningOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
            <Text strong>Save this key now. It will not be shown again.</Text>
          </div>

          <div>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>Your API Key:</Paragraph>
            <Input.Group compact>
              <Input
                value={apiKey}
                readOnly
                style={{ width: 'calc(100% - 40px)', fontFamily: 'monospace', fontSize: 12 }}
              />
              <Button icon={<CopyOutlined />} onClick={handleCopy} />
            </Input.Group>
          </div>

          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            Use this key in the <code>Authorization: Bearer {'<key>'}</code> header when sending logs to the ingestion API.
          </Paragraph>
        </Space>
      </div>
    </Modal>
  );
}
