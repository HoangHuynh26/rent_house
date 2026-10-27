import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

/**
 * Initializes mobile native plugins (Status Bar, Splash Screen, Back button handling)
 */
export async function initMobileApp() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Configure native status bar
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0f172a' });
    }
  } catch (err) {
    console.warn('[Mobile] StatusBar init error:', err);
  }

  try {
    // Hide splash screen smoothly after app is ready
    setTimeout(async () => {
      await SplashScreen.hide({ fadeOutDuration: 300 });
    }, 500);
  } catch (err) {
    console.warn('[Mobile] SplashScreen hide error:', err);
  }

  try {
    // Android hardware back button handler
    App.addListener('backButton', ({ canGoBack }) => {
      if (window.location.pathname === '/' || window.location.pathname === '/tenant/bills' || window.location.pathname === '/admin/dashboard') {
        // At home or main dashboard, minimize app
        App.minimizeApp();
      } else if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });
  } catch (err) {
    console.warn('[Mobile] BackButton listener error:', err);
  }
}
