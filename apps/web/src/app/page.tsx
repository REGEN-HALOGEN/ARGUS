import { WelcomePanel } from '@/components/onboarding/welcome-panel';
import { BackgroundRippleEffect } from '@/components/ui/background-ripple-effect';

export default function HomePage() {
  return (
    <>
      <BackgroundRippleEffect />
      <WelcomePanel />
    </>
  );
}
