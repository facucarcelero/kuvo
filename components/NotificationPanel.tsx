'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { NotificationItem } from '@/features/dashboard/panel-data';
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '@/features/notifications/api';

type Props = {
  accountId: string;
  demo?: boolean;
  onError?: (message: string) => void;
};

function countUnread(items: NotificationItem[]) {
  return items.filter(n => !n.readAt).length;
}

export function NotificationPanel({ accountId, demo = false, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const syncUnreadCount = useCallback((next: NotificationItem[]) => {
    setUnreadCount(countUnread(next));
  }, []);

  useEffect(() => {
    if (demo || !isSupabaseConfigured()) return;

    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      const [{ data, error }, { count, error: countErr }] = await Promise.all([
        listNotifications(supabase, accountId),
        countUnreadNotifications(supabase, accountId),
      ]);
      if (cancelled) return;
      setLoading(false);

      if (error) {
        onErrorRef.current?.(error.message);
        return;
      }
      if (countErr) {
        onErrorRef.current?.(countErr.message);
        return;
      }

      const mapped = (data ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        actionUrl: n.action_url,
        readAt: n.read_at,
        createdAt: n.created_at,
      }));
      setItems(mapped);
      setUnreadCount(count ?? countUnread(mapped));
    })();

    const unsubscribe = subscribeToNotifications(supabase, accountId, {
      onInsert: (item) => {
        setItems(prev => {
          if (prev.some(n => n.id === item.id)) return prev;
          const next = [item, ...prev];
          syncUnreadCount(next);
          return next;
        });
      },
      onUpdate: (item) => {
        setItems(prev => {
          const next = prev.map(n => (n.id === item.id ? item : n));
          syncUnreadCount(next);
          return next;
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [accountId, demo, syncUnreadCount]);

  async function readOne(id: string) {
    const target = items.find(n => n.id === id);
    if (!target || target.readAt) return;

    if (demo) {
      setItems(prev => {
        const next = prev.map(n => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
        syncUnreadCount(next);
        return next;
      });
      return;
    }

    const supabase = createClient();
    if (!supabase) return;
    const { error } = await markNotificationRead(supabase, id);
    if (error) {
      onError?.(error.message);
      return;
    }

    setItems(prev => {
      const next = prev.map(n => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
      syncUnreadCount(next);
      return next;
    });
  }

  async function readAll() {
    if (demo) {
      setItems(prev => {
        const next = prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
        syncUnreadCount(next);
        return next;
      });
      return;
    }

    const supabase = createClient();
    if (!supabase) return;
    const { error } = await markAllNotificationsRead(supabase, accountId);
    if (error) {
      onError?.(error.message);
      return;
    }

    setItems(prev => {
      const next = prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
      syncUnreadCount(next);
      return next;
    });
  }

  return (
    <div className="notificationCenter">
      <button
        className="iconButton"
        type="button"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {unreadCount > 0 && <i aria-hidden />}
        <Bell size={18} />
      </button>

      {open && (
        <section className="dashPanel notificationsPanel" role="dialog" aria-label="Notificaciones">
          <div className="panelTitle">
            <div>
              <h3>Notificaciones</h3>
              <p>{unreadCount} sin leer</p>
            </div>
            <button type="button" onClick={() => void readAll()}>Marcar todas</button>
          </div>
          {loading && <p className="loadingLine" />}
          {items.length === 0 && !loading && <p className="emptyInline">No tenés notificaciones.</p>}
          <ul className="notificationList">
            {items.map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  className={n.readAt ? 'read' : ''}
                  onClick={() => void readOne(n.id)}
                >
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <time>{new Date(n.createdAt).toLocaleString('es-AR')}</time>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
