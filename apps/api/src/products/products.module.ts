import { Module } from '@nestjs/common';
import { ProductStoresController } from './product-stores.controller.js';
import { ProductsController } from './products.controller.js';

@Module({
  controllers: [ProductsController, ProductStoresController],
})
export class ProductsModule {}
