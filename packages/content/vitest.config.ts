import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "content", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
});
