import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async generate(creatorAddress: string, name: string, permissions: string[]) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    const plainKey = `spk_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(plainKey);

    await this.prisma.apiKey.create({
      data: { name, keyHash, creatorId: creator.id, permissions },
    });

    return { key: plainKey, name, permissions, message: 'Save this key — it will not be shown again' };
  }

  async revoke(creatorAddress: string, keyId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!apiKey) throw new NotFoundException('API key not found');
    if (apiKey.creatorId !== creator.id) throw new ForbiddenException('Key does not belong to this creator');

    await this.prisma.apiKey.delete({ where: { id: keyId } });
    return { deleted: true };
  }

  async list(creatorAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.prisma.apiKey.findMany({
      where: { creatorId: creator.id },
      select: { id: true, name: true, permissions: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateKey(rawKey: string) {
    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey) throw new UnauthorizedException('Invalid API key');

    await this.prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

    return apiKey;
  }
}
