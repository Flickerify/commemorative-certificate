import { protectedQuery } from '../functions';

export const me = protectedQuery({
  args: {},
  async handler(ctx) {
    return ctx.user;
  },
});
