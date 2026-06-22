import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PlatformConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig() {
    const config = await this.prisma.platformConfig.findUnique({ where: { id: 'singleton' } });
    return config ?? { id: 'singleton', feeBps: 250, updatedAt: new Date(), updatedBy: null };
  }

  async updateFee(feeBps: number, updatedBy: string) {
    if (feeBps < 0 || feeBps > 1000) {
      throw new BadRequestException('feeBps must be between 0 and 1000 (0–10%)');
    }

    return this.prisma.platformConfig.upsert({
      where: { id: 'singleton' },
      update: { feeBps, updatedBy },
      create: { id: 'singleton', feeBps, updatedBy },
    });
  }
}
