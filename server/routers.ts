import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { mcpClient } from "./_core/mcpClient";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { chatRouter } from "./chat";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  chat: chatRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  mcp: router({
    status: protectedProcedure.query(() => ({ enabled: mcpClient.enabled(), readOnly: mcpClient.isReadOnly() })),
    tools: protectedProcedure.query(() => mcpClient.listTools()),
    call: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(200), args: z.record(z.string(), z.unknown()).optional() }))
      .mutation(({ input }) => mcpClient.callTool(input.name, input.args || {})),
  }),
});

export type AppRouter = typeof appRouter;
