import { HealthStatus } from '@/components/health-status';

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ยินดีต้อนรับ 👋</h1>
        <p className="text-muted-foreground">
          ระบบพร้อมใช้งานแล้ว เมนูสำหรับงานจัดซื้อ รับสินค้า ขาย
          และคลังสินค้าจะเพิ่มเข้ามาในลำดับถัดไป
        </p>
      </div>
      <HealthStatus />
    </div>
  );
}
