import { Controller } from '@nestjs/common';
import { contract } from '@erp/contracts';
import { Implement, implement } from '@orpc/nest';
import { Roles } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller()
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  // NFR-03's trail is sensitive: only the Administrator (the user-management role) may read it.
  // The global AuthGuard enforces this coarse, payload-independent rule before the handler runs.
  @Roles('ADMINISTRATOR')
  @Implement(contract.audit.list)
  list() {
    return implement(contract.audit.list).handler(async () => {
      const records = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
      return records.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    });
  }
}
