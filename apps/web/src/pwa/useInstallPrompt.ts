import { useCallback, useEffect, useState } from 'react';

/** Chrome/Edge/Android event that lets the page show the install dialog on demand. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** iOS has no install API; users must use Share → Add to Home Screen. */
export type InstallPlatform = 'ios' | 'prompt';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPromptState {
  canInstall: boolean;
  isInstalled: boolean;
  platform: InstallPlatform;
  promptInstall: () => Promise<InstallOutcome>;
}

export function detectPlatform(userAgent: string): InstallPlatform {
  return /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : 'prompt';
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return {
    canInstall: deferred !== null && !isInstalled,
    isInstalled,
    platform: detectPlatform(navigator.userAgent),
    promptInstall,
  };
}
