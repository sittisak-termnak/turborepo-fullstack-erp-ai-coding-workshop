import { Controller } from '@nestjs/common';
import { APP_ERRORS, contract, type Supplier } from '@erp/contracts';
import { Implement, implement } from '@orpc/nest';
import { Roles } from '../auth/auth.decorators.js';
import { isPrismaCode } from '../common/prisma-error.js';
import { PrismaService } from '../database/prisma.service.js';

/** The supplier as the contract publishes it. Drops `createdAt`, which is an ordering key. */
const toSupplier = (row: Supplier): Supplier => ({
  id: row.id,
  code: row.code,
  name: row.name,
  phone: row.phone,
  address: row.address,
});

@Controller()
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}

  // Supplier maintenance is the Administrator's screen (MD-03), mirroring stores.controller.ts
  // and products.controller.ts: no row-level rule applies, because maintaining the list of
  // suppliers is cross-store by definition.
  @Roles('ADMINISTRATOR')
  @Implement(contract.suppliers.list)
  list() {
    return implement(contract.suppliers.list).handler(async ({ input }) => {
      const [rows, total] = await Promise.all([
        this.prisma.supplier.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.supplier.count(),
      ]);

      return { items: rows.map(toSupplier), total };
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.suppliers.create)
  create() {
    return implement(contract.suppliers.create).handler(async ({ input, errors }) => {
      try {
        const supplier = await this.prisma.supplier.create({
          data: { code: input.code, name: input.name, phone: input.phone, address: input.address },
        });
        return toSupplier(supplier);
      } catch (error) {
        // Let the database decide uniqueness rather than checking first: a read-then-write would
        // let two concurrent creates past the check and still breach the constraint.
        if (isPrismaCode(error, 'P2002')) {
          throw errors.SUPPLIER_CODE_TAKEN({
            data: { action: APP_ERRORS.SUPPLIER_CODE_TAKEN.action },
          });
        }
        throw error;
      }
    });
  }

  @Roles('ADMINISTRATOR')
  @Implement(contract.suppliers.update)
  update() {
    return implement(contract.suppliers.update).handler(async ({ input, errors }) => {
      try {
        return toSupplier(
          await this.prisma.supplier.update({
            where: { id: input.id },
            data: {
              code: input.code,
              name: input.name,
              phone: input.phone,
              address: input.address,
            },
          }),
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2002')) {
          throw errors.SUPPLIER_CODE_TAKEN({
            data: { action: APP_ERRORS.SUPPLIER_CODE_TAKEN.action },
          });
        }
        if (isPrismaCode(error, 'P2025')) {
          throw errors.SUPPLIER_NOT_FOUND({
            data: { action: APP_ERRORS.SUPPLIER_NOT_FOUND.action },
          });
        }
        throw error;
      }
    });
  }
}
