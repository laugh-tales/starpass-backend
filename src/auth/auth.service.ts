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

  /**
   * Authenticate a user via Stellar signature and issue JWT tokens.
   *
   * @param stellarAddress The Stellar public key of the user.
   * @param signature Base64-encoded signature of the challenge message.
   * @param message The signed challenge message.
   * @returns Access token, refresh token, and user record.
   * @throws {UnauthorizedException} If the signature is invalid.
   */
  async login(stellarAddress: string, signature: string, message: string, tenantId?: string) {
    const isValid = this.verifySignature(stellarAddress, message, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // If no tenantId provided, use default tenant
    const targetTenantId = tenantId || await this.getDefaultTenantId();

    const user = await this.prisma.user.upsert({
      where: { stellarAddress },
      update: {},
      create: { 
        stellarAddress,
        tenantId: targetTenantId,
      },
      include: { tenant: true },
    });

    const accessToken = this.signAccess(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return { token: accessToken, refreshToken, user };
  }

  /**
   * Exchange a valid refresh token for a new access token.
   *
   * @param refreshToken The refresh token from a prior login.
   * @returns A new access token.
   * @throws {UnauthorizedException} If the refresh token is expired, invalid, or the user is not found.
   */
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

  /**
   * Invalidate a refresh token session.
   *
   * @param refreshToken The refresh token to revoke.
   * @returns A confirmation message.
   */
  async logout(refreshToken: string) {
    await this.prisma.session.deleteMany({ where: { token: refreshToken } });
    return { message: 'Logged out successfully' };
  }

  /**
   * Generate a Stellar wallet authentication challenge message.
   *
   * @param stellarAddress The Stellar public key requesting authentication.
   * @returns A challenge string to be signed by the wallet.
   */
  getChallenge(stellarAddress: string): string {
    const timestamp = Date.now();
    return `StarPass authentication challenge for ${stellarAddress} at ${timestamp}`;
  }

  /**
   * Verify a JWT access token and return the associated user.
   *
   * @param token The JWT access token.
   * @returns The user record if the token is valid.
   * @throws {UnauthorizedException} If the token is invalid or expired.
   */
  async validateToken(token: string) {
    try {
      const payload = this.jwt.verify(token);
      return this.prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private signAccess(user: { id: string; stellarAddress: string; role: string; tenantId?: string }) {
    return this.jwt.sign({ 
      sub: user.id, 
      address: user.stellarAddress, 
      role: user.role,
      tenantId: user.tenantId,
    });
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

  private async getDefaultTenantId(): Promise<string> {
    const defaultTenant = await this.prisma.tenant.findUnique({
      where: { slug: 'default' },
    });

    if (!defaultTenant) {
      // Create default tenant if it doesn't exist
      const tenant = await this.prisma.tenant.create({
        data: {
          name: 'Default Tenant',
          slug: 'default',
          status: 'ACTIVE',
          feeBps: 250,
          maxCreators: 1000,
          maxPassesPerCreator: 100,
        },
      });
      return tenant.id;
    }

    return defaultTenant.id;
  }
}
