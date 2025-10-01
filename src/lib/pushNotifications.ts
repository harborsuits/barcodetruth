import { supabase } from "@/integrations/supabase/client";

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('[Push] Already subscribed');
      return true;
    }

    // VAPID public key will be set in env
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('[Push] VAPID public key not configured');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    console.log('[Push] Subscription created:', subscription.endpoint);

    // Send subscription to server
    const { error } = await supabase.functions.invoke('subscribe-push', {
      body: {
        subscription: subscription.toJSON(),
        ua: navigator.userAgent,
      },
    });

    if (error) {
      console.error('[Push] Failed to save subscription:', error);
      await subscription.unsubscribe();
      return false;
    }

    console.log('[Push] Subscription saved');
    return true;
  } catch (error) {
    console.error('[Push] Subscribe error:', error);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[Push] No subscription to unsubscribe');
      return true;
    }

    const endpoint = subscription.endpoint;
    
    // Unsubscribe from push manager
    await subscription.unsubscribe();
    console.log('[Push] Unsubscribed from push manager');

    // Delete from server
    const { error } = await supabase.functions.invoke('unsubscribe-push', {
      body: { endpoint },
    });

    if (error) {
      console.error('[Push] Failed to delete subscription from server:', error);
      return false;
    }

    console.log('[Push] Subscription removed from server');
    return true;
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
