import { Link, Outlet } from 'react-router';
import { UserMenu } from '@/components/user-menu';
import { useCurrentUser } from '@/lib/auth';

export function RootLayout() {
  const user = useCurrentUser();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <span className="font-semibold">ระบบจัดการธุรกิจค้าปลีก</span>
            {/*
              INV-01 is open to every signed-in role (see apps/api/src/stock), so this link is
              never gated by role, unlike the maintenance links below it.
            */}
            {user && (
              <nav aria-label="เมนูหลัก" className="flex items-center gap-6">
                <Link to="/stock" className="text-sm text-muted-foreground hover:text-foreground">
                  ค้นหาคลังสินค้า
                </Link>
                {/*
                  Offering the way in, not enforcing it: the API refuses store and product
                  maintenance to every other role (see apps/api/src/stores, apps/api/src/products),
                  and a hidden link is never the enforcement. This only keeps a Manager from being
                  sent to a screen that would answer 403.
                */}
                {user.role === 'ADMINISTRATOR' && (
                  <>
                    <Link
                      to="/stores"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      จัดการสาขา
                    </Link>
                    <Link
                      to="/products"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      จัดการสินค้า
                    </Link>
                  </>
                )}
              </nav>
            )}
          </div>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
