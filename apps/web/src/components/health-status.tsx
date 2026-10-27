import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { orpc } from '@/lib/orpc';

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <Badge variant={ok ? 'default' : 'destructive'}>{ok ? '✅ ปกติ' : '❌ ไม่พร้อมใช้งาน'}</Badge>
  );
}

/** Calls GET /api/health through the typed oRPC client. */
export function HealthStatus() {
  const health = useQuery(orpc.health.check.queryOptions());

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>สถานะระบบ</CardTitle>
        <CardDescription>
          {health.isPending
            ? 'กำลังตรวจสอบ…'
            : health.data
              ? `ตรวจสอบล่าสุด ${formatTime(health.data.timestamp)}`
              : errorMessage(health.error)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span>API</span>
          {!health.isPending && <StatusBadge ok={health.data?.api === 'ok'} />}
        </div>
        <div className="flex items-center justify-between">
          <span>ฐานข้อมูล</span>
          {!health.isPending && <StatusBadge ok={health.data?.database === 'ok'} />}
        </div>
      </CardContent>
    </Card>
  );
}
