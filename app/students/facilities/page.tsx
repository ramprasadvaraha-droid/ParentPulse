'use client';

import PortalAuthGate from '../../../components/PortalAuthGate';
import InstitutionFacilitiesManager from '../../../components/InstitutionFacilitiesManager';
import { usePortalSession } from '@/lib/use-portal-session';

function RoomLayoutEditor() {
  const session = usePortalSession();
  if (!session?.institutionCode) return null;
  return <InstitutionFacilitiesManager institutionCode={session.institutionCode} editable />;
}

export default function InstitutionFacilitiesPage() {
  return (
    <PortalAuthGate portal="institution">
      <RoomLayoutEditor />
    </PortalAuthGate>
  );
}
