import { BackgroundRippleEffect } from '@/components/ui/background-ripple-effect';
import { Header } from '@/components/layout/header';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <BackgroundRippleEffect />
      <div className="sticky top-0 z-50 w-full">
        <Header />
      </div>
      <div className="relative z-10 flex-1">{children}</div>
    </div>
  );
}
