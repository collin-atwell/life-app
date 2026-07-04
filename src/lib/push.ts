import { cloudClient, cloudSession } from './cloud';

// ---------- Background push (app closed) ----------
// The service worker subscribes to the browser's push service; the subscription
// is stored in Supabase, and a scheduled edge function (send-reminders) computes
// due reminders server-side and pushes them — so they arrive even when the app
// isn't open. Requires the app to be installed/served over HTTPS (the live site,
// not dev).

// Public half of the VAPID keypair — safe to ship. The private half lives only
// in the Supabase function secrets.
export const VAPID_PUBLIC_KEY = 'BNxfVcO4ZKnWjs_zNvSl3pifM2UC6qC8XPS86h1ttWO70MB6_8MGy3l5-r0lQKBPpEmTFcuf1EAtt4mzuSXb6Oc';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? await reg.pushManager.getSubscription() : null;
}

/** Subscribe this device and register it with the backend. Returns error or null. */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return 'This browser doesn\'t support background push. On iPhone, add the app to your Home Screen first — Safari only allows push for installed apps.';
  const session = await cloudSession();
  if (!session) return 'Sign in first (Settings → Account & sync) so reminders can find your data.';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'Service worker not active — background push works on the installed/deployed app, not in dev.';
  if (Notification.permission === 'denied') return 'Notifications are blocked for this site in your browser settings.';
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
    const c = cloudClient();
    if (!c) return 'Cloud not configured';
    const { error } = await c.from('push_subscriptions').upsert({
      endpoint: sub.endpoint,
      user_id: session.user.id,
      subscription: sub.toJSON(),
    });
    if (error) return error.message;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Unsubscribe this device and remove it from the backend. */
export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  const c = cloudClient();
  if (c) await c.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
