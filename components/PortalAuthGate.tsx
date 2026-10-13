'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { savePortalSession, type PortalSession } from '@/lib/portal-auth';
import { usePortalSession } from '@/lib/use-portal-session';

export default function PortalAuthGate({
  portal,
  children,
}: {
  portal: PortalSession['portal'];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = usePortalSession();
  const authorized = session?.portal === portal;
  const [staffPortalVerified, setStaffPortalVerified] = useState(false);

  useEffect(() => {
    if (portal === 'institution' || portal === 'platform') {
      let active = true;
      fetch(`/api/auth/${portal}`, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error('Portal session is invalid');
          const result = await response.json();
          if (result.session?.portal !== portal || !active) {
            throw new Error('Portal session is invalid');
          }
          savePortalSession(result.session as PortalSession);
          setStaffPortalVerified(true);
        })
        .catch(() => {
          if (active) router.replace(portal === 'platform' ? '/platform-login' : '/institution-login');
        });
      return () => { active = false; };
    }

    if (!authorized) {
      router.replace('/parent-login');
    }
  }, [authorized, portal, router]);

  if (!authorized || (portal !== 'parent' && !staffPortalVerified)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-4 text-sm text-slate-600" aria-busy="true">
        Checking portal access…
      </main>
    );
  }

  return children;
}