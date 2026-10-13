import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f6f1] text-[#15251f]">
      <header className="border-b border-[#dce4dc] bg-[#f8faf6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="ParentPulse home">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#174d3b] text-sm font-bold text-white">PP</span>
            <span className="text-lg font-bold">ParentPulse</span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#617168]">Hostel safety & family updates</span>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl gap-12 px-5 py-14 md:py-20 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#c7dbcf] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#285b45]">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            A clearer connection to campus life
          </p>
          <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[1.08] text-[#12241d] sm:text-6xl lg:text-7xl">
            Welcome to <span className="text-[#287552]">ParentPulse</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#53645c]">
            A reassuring pulse on your child&apos;s safety and whereabouts. Parents and hostel teams can sign in to access the information meant for them.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#68776f]">
            Student details, gate activity, leave requests, and institution records are available only inside their respective portals, not on this public page.
          </p>
        </div>

        <section aria-label="Choose a portal" className="relative mx-auto w-full max-w-lg">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border-[18px] border-[#dce9df] opacity-70" aria-hidden="true" />
          <div className="relative border border-[#cdd9d0] bg-white p-6 shadow-[0_24px_70px_rgba(20,50,37,0.12)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#397557]">Secure portal access</p>
            <h2 className="mt-2 text-2xl font-bold text-[#18372a]">Choose your portal</h2>
            <div className="mt-6 divide-y divide-[#e3e9e3] border-y border-[#e3e9e3]">
              <Link href="/institution-login" className="group flex items-center justify-between gap-4 py-5">
                <span>
                  <span className="block text-base font-semibold text-[#18372a]">Institution Portal</span>
                  <span className="mt-1 block text-sm text-[#68776f]">For administrators and hostel staff</span>
                </span>
                <span aria-hidden="true" className="text-2xl text-[#397557] transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link href="/institution-login?owner=1" className="group flex items-center justify-between gap-4 py-5">
                <span>
                  <span className="block text-base font-semibold text-[#18372a]">Employer / Owner Login</span>
                  <span className="mt-1 block text-sm text-[#68776f]">For the ParentPulse owner to manage institutions</span>
                </span>
                <span aria-hidden="true" className="text-2xl text-[#397557] transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link href="/parent-login" className="group flex items-center justify-between gap-4 py-5">
                <span>
                  <span className="block text-base font-semibold text-[#18372a]">Parent Portal</span>
                  <span className="mt-1 block text-sm text-[#68776f]">For parents and guardians</span>
                </span>
                <span aria-hidden="true" className="text-2xl text-[#397557] transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#718078]">
              Institution accounts are created by the ParentPulse owner. Parent portal identity verification is not yet connected.
            </p>
          </div>
        </section>
      </section>

      <footer className="border-t border-[#dce4dc] bg-[#f8faf6]">
        <div className="mx-auto max-w-7xl px-5 py-5 text-xs text-[#68776f] lg:px-8">
          ParentPulse · Public pages do not display student or institution records.
        </div>
      </footer>
    </main>
  );
}