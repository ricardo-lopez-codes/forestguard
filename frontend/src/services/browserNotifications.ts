// Browser Desktop Notifications and Web Audio Chime Service

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return null;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return null;
  }
}

export function playAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    
    // Play a distinct dual-tone warble (880Hz / 587Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(587, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.30);
    osc.frequency.setValueAtTime(587, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.warn('Audio tone error:', e);
  }
}

let lastNotificationTime = 0;

export function triggerBrowserAlert(title: string, body: string, tag = 'forestguard-fire-alert') {
  const now = Date.now();
  // Throttle to at most one desktop notification every 10 seconds to avoid spamming
  if (now - lastNotificationTime < 10000) {
    return;
  }
  lastNotificationTime = now;

  // Play audio alarm chime
  playAlertTone();

  // Trigger system notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag,
        requireInteraction: true
      });
    } catch (e) {
      console.warn('Desktop notification error:', e);
    }
  }
}
