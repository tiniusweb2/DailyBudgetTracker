import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { db } from "@db";
import { refreshTokens, type InsertRefreshToken, type RefreshToken } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { AppError } from "../domain/errors/AppError";

const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;

export class TokenService {
  static generateRefreshToken(): string {
    return randomBytes(40).toString('hex');
  }

  static async createRefreshToken(userId: number): Promise<RefreshToken> {
    try {
      const token = this.generateRefreshToken();
      const expiresAt = addDays(new Date(), REFRESH_TOKEN_EXPIRES_IN_DAYS);

      const [refreshToken] = await db
        .insert(refreshTokens)
        .values({
          userId,
          token,
          expiresAt,
        })
        .returning();

      return refreshToken;
    } catch (error) {
      console.error('Error creating refresh token:', error);
      throw new AppError('Failed to create refresh token', 500);
    }
  }

  static async replaceRefreshToken(oldToken: string): Promise<RefreshToken> {
    try {
      // First check if token exists and is valid
      const [existingToken] = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.token, oldToken),
            isNull(refreshTokens.revokedAt),
          )
        )
        .limit(1);

      if (!existingToken) {
        throw AppError.unauthorized("Invalid refresh token");
      }

      if (existingToken.expiresAt < new Date()) {
        throw AppError.unauthorized("Refresh token has expired");
      }

      const newToken = this.generateRefreshToken();

      // Revoke the old token
      await db
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
          replacedByToken: newToken,
        })
        .where(eq(refreshTokens.id, existingToken.id));

      // Create new token
      const [refreshToken] = await db
        .insert(refreshTokens)
        .values({
          userId: existingToken.userId,
          token: newToken,
          expiresAt: addDays(new Date(), REFRESH_TOKEN_EXPIRES_IN_DAYS),
        })
        .returning();

      return refreshToken;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error replacing refresh token:', error);
      throw AppError.unauthorized('Invalid refresh token');
    }
  }

  static async revokeRefreshToken(token: string): Promise<void> {
    try {
      const [existingToken] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token, token))
        .limit(1);

      if (!existingToken || existingToken.revokedAt) {
        throw AppError.notFound("Token not found or already revoked");
      }

      await db
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
        })
        .where(eq(refreshTokens.id, existingToken.id));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error revoking refresh token:', error);
      throw AppError.unauthorized('Invalid refresh token');
    }
  }

  static async revokeAllUserTokens(userId: number): Promise<void> {
    try {
      await db
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
          )
        );
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
      throw AppError.internal('Failed to revoke user tokens');
    }
  }
}