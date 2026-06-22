import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { randomBytes } from 'crypto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(stellarAddress: string, signature: string, message: string) {
    const isValid = this.verifySignature(stellarAddress, message, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    const user = await this.prisma.user.upsert({
      where: { stellarAddress },
      update: {},
      create: { stellarAddress },
    });

    const accessToken = this.signAccess(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return { token: accessToken, refreshToken, user };
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({ where: { token: refreshToken } });

    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token is expired or invalid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = this.signAccess(user);
    return { token: accessToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.deleteMany({ where: { token: refreshToken } });
    return { message: 'Logged out successfully' };
  }

  getChallenge(stellarAddress: string): string {
    const timestamp = Date.now();
    return `StarPass authentication challenge for ${stellarAddress} at ${timestamp}`;
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwt.verify(token);
      return this.prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private signAccess(user: { id: string; stellarAddress: string; role: string }) {
    return this.jwt.sign({ sub: user.id, address: user.stellarAddress, role: user.role });
  }

  private async createRefreshToken(userId: string) {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.session.create({ data: { userId, token, expiresAt } });
    return token;
  }

  private verifySignature(stellarAddress: string, message: string, signature: string): boolean {
    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(stellarAddress);
      const messageBytes = Buffer.from(message, 'utf8');
      const signatureBytes = Buffer.from(signature, 'base64');
      return keypair.verify(messageBytes, signatureBytes);
    } catch {
      return false;
    }
  }
}
