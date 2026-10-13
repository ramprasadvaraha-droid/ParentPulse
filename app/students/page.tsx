import StudentRegistrationDashboard from '../../components/StudentRegistrationDashboard';
import PortalAuthGate from '../../components/PortalAuthGate';

export default function StudentsPage() {
  return (
    <PortalAuthGate portal="institution">
      <StudentRegistrationDashboard />
    </PortalAuthGate>
  );
}