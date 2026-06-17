import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;      // userId
  email: string;
  iat: number;
  exp: number;
}

/**
 * Parameter decorator to extract the current user from the JWT payload.
 * Usage: @CurrentUser() user: JwtPayload
 * Usage: @CurrentUser('sub') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
