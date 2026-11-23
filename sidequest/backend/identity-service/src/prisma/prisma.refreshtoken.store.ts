import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { AuthenticationStorage, RefreshTokenRecord, RefreshTokenStore } from "@nestjs/authentication";
import { Prisma } from ".prisma/client/default.js";


@Injectable()

export class PrismaRefreshTokenStore implements RefreshTokenStore{
    constructor(
        private readonly prisma: PrismaService,
        private readonly authenticationStorage: AuthenticationStorage
    ){
        authenticationStorage.registerSource({ refreshTokens: this });
    }

    async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            await tx.session.upsert({
                where: { id: record.familyId },
                create: {
                    id: record.familyId,
                    user: { connect: { id: record.userId } },
                    expiresAt: record.familyExpiresAt,
                },
                update: {
                    user: { connect: { id: record.userId } },
                    expiresAt: record.familyExpiresAt,
                },
            } 
            );
            await tx.refreshToken.create({
                data: {
                    id: record.id,
                    sessionId: record.familyId,
                    userId: record.userId,
                    createdAt: record.createdAt,
                    expiresAt: record.expiresAt,
                    usedAt: record.usedAt,
                    claims: record.claims as Prisma.InputJsonValue | undefined,
                }
            });
            await tx.session.deleteMany({
                where: {
                    expiresAt: { lt: record.createdAt },
                }
            });
        });
    }
    
    async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
        const raw = await this.prisma.refreshToken.findUnique({
        where: { id },
        include: { session: { select: { expiresAt: true } } },
        });
        if (!raw) return undefined;

        return {
            id: raw.id,
            familyId: raw.sessionId,
            userId: raw.userId,
            createdAt: raw.createdAt,
            expiresAt: raw.expiresAt,
            familyExpiresAt: raw.session.expiresAt ?? raw.expiresAt,
            usedAt: raw.usedAt ?? undefined,
            claims: raw.claims as Record<string, unknown> | undefined,
        };
    }

    async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
        const {count} = await this.prisma.refreshToken.updateMany({
            where: {
                id,
                usedAt: null,
            },
            data: {
                usedAt: at,
            }
        });
        return count === 1;
    }
    
    async revokeRefreshTokenFamily(familyId: string): Promise<void> {
        const at = new Date();
        await this.prisma.session.upsert({
            where: { id: familyId },
            create: {
                id: familyId,
                revokedAt: at,
            },
            update: {
                revokedAt: at,
            },
        });
    }

    async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
        const session = await this.prisma.session.findUnique({
            where: { id: familyId },
            select: { revokedAt: true },
        });
        return session?.revokedAt != null;
    }

    async revokeUserRefreshTokens(userId: string): Promise<void> {
        const at = new Date();
        await this.prisma.session.updateMany({
            where: { userId,
                    revokedAt: null
            },
            data: { revokedAt: at },
        });
    }
}