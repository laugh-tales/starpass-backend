import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async setCreatorCategories(creatorId: string, categoryIds: string[]) {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    if (categories.length !== categoryIds.length) {
      throw new NotFoundException('One or more category IDs not found');
    }

    await this.prisma.$transaction([
      this.prisma.categoryOnCreator.deleteMany({ where: { creatorId } }),
      this.prisma.categoryOnCreator.createMany({
        data: categoryIds.map((categoryId) => ({ creatorId, categoryId })),
      }),
    ]);

    return this.prisma.creator.findUnique({
      where: { id: creatorId },
      include: { categories: { include: { category: true } } },
    });
  }
}
