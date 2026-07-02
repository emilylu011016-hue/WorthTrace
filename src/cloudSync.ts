export const CLOUD_SYNC_URL = "https://yyhuxgxohiguyaskhqco.supabase.co";
export const CLOUD_SYNC_PUBLISHABLE_KEY = "sb_publishable_TW9SJoYzougEOl5vvHZVpg_17iMWHH9";

export type CloudSession = {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
  };
};

export type CloudDraft = {
  id: string;
  user_id: string;
  device_id?: string | null;
  local_id: string;
  record_kind: string;
  transaction_type?: string | null;
  transaction_date?: string | null;
  period_month?: string | null;
  amount?: number | null;
  currency?: string | null;
  category?: string | null;
  note?: string | null;
  payload_json?: Record<string, unknown>;
  sync_status: string;
  created_at?: string;
  updated_at?: string;
};

export type CloudDashboardSnapshot = {
  id?: string;
  user_id: string;
  snapshot_month: string;
  payload_json: Record<string, unknown>;
  updated_at?: string;
};

export function cloudSyncConfigured() {
  return Boolean(
    CLOUD_SYNC_URL &&
      CLOUD_SYNC_PUBLISHABLE_KEY &&
      !CLOUD_SYNC_PUBLISHABLE_KEY.includes("PASTE_")
  );
}

function cloudHeaders(session?: CloudSession) {
  return {
    apikey: CLOUD_SYNC_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session?.access_token ?? CLOUD_SYNC_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}

export async function cloudSignIn(email: string, password: string): Promise<CloudSession> {
  if (!cloudSyncConfigured()) {
    throw new Error("云同步还没有配置完成。");
  }
  const response = await fetch(`${CLOUD_SYNC_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: cloudHeaders(),
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error("账号或密码不正确。");
  }
  return response.json();
}

export async function cloudSignUp(email: string, password: string): Promise<CloudSession> {
  if (!cloudSyncConfigured()) {
    throw new Error("云同步还没有配置完成。");
  }
  const response = await fetch(`${CLOUD_SYNC_URL}/auth/v1/signup`, {
    method: "POST",
    headers: cloudHeaders(),
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function listPendingCloudDrafts(session: CloudSession): Promise<CloudDraft[]> {
  const response = await fetch(
    `${CLOUD_SYNC_URL}/rest/v1/mobile_cloud_drafts?sync_status=eq.pending&order=created_at.asc`,
    {
      headers: {
        ...cloudHeaders(session),
        Accept: "application/json"
      }
    }
  );
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function markCloudDraftsPulled(session: CloudSession, ids: string[]) {
  if (!ids.length) return;
  const quotedIds = ids.map((id) => `"${id}"`).join(",");
  const response = await fetch(`${CLOUD_SYNC_URL}/rest/v1/mobile_cloud_drafts?id=in.(${quotedIds})`, {
    method: "PATCH",
    headers: {
      ...cloudHeaders(session),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ sync_status: "pulled", updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function upsertCloudDashboardSnapshot(
  session: CloudSession,
  snapshotMonth: string,
  payload: Record<string, unknown>
) {
  if (!snapshotMonth) {
    throw new Error("当前没有可同步的已发布月报。");
  }
  const response = await fetch(
    `${CLOUD_SYNC_URL}/rest/v1/mobile_dashboard_snapshots?on_conflict=user_id,snapshot_month`,
    {
      method: "POST",
      headers: {
        ...cloudHeaders(session),
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        user_id: session.user.id,
        snapshot_month: snapshotMonth,
        payload_json: payload,
        updated_at: new Date().toISOString()
      })
    }
  );
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
