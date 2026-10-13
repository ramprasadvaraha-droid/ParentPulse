import PortalAuthGate from '../../../components/PortalAuthGate';
import InstitutionStudentManager from '../../../components/InstitutionStudentManager';

export default function InstitutionStudentsPage() {
  return (
    <PortalAuthGate portal="institution">
      <InstitutionStudentManager />
    </PortalAuthGate>
  );
}
