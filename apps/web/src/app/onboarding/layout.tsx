import { BackgroundRippleEffect } from '@/components/ui/background-ripple-effect';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <BackgroundRippleEffect />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
