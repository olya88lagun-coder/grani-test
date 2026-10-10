import { z } from "zod";
export const MAX_ATLAS_EXPECTED_REVISION=2_147_483_646;
export const atlasDataSchema=z.strictObject({
  done:z.array(z.boolean()).length(7), notes:z.array(z.string().max(2000)).length(7),
  decision:z.string().max(2000), interaction:z.array(z.string().max(2000)).length(3),
  memo:z.strictObject({quote:z.string().max(2000),items:z.array(z.string().max(2000)).length(5)}),
});
