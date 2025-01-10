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
  }

  static async replaceRefreshToken(oldToken: string): Promise<RefreshToken> {
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
  }

  static async revokeRefreshToken(token: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(refreshTokens.token, token),
          isNull(refreshTokens.revokedAt),
        )
      );
  }

  static async revokeAllUserTokens(userId: number): Promise<void> {
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
  }
}
