import { useState } from 'react';
import { Typography, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import MemberTable from '../components/MemberTable';
import InviteMemberModal from '../components/InviteMemberModal';
import { useMembers } from '../hooks/useOrganization';
import { useAuth } from '../auth/AuthContext';

const { Title } = Typography;

export default function Members() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: members, isLoading } = useMembers();
  const { user } = useAuth();

  const isAdmin = user?.role === 'org_admin';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Team Members</Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Invite Member
          </Button>
        )}
      </div>

      <MemberTable members={members || []} loading={isLoading} />

      <InviteMemberModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
