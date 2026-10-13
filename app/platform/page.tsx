import PortalAuthGate from '../../components/PortalAuthGate';
import PlatformDashboard from '../../components/PlatformDashboard';

export default function PlatformPage() {
  return (
    <PortalAuthGate portal="platform">
      <PlatformDashboard />
    </PortalAuthGate>
  );
}