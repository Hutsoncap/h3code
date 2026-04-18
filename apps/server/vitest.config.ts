import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Server integration tests exercise sqlite/git orchestration and can
      // legitimately exceed the default timeout when the full workspace suite
      // is running under CI load.
      testTimeout: 45_000,
      hookTimeout: 45_000,
      // CI has been intermittently timing out while terminating Vitest fork
      // workers after the server suite completes. Running server test files
      // serially in CI trades some speed for deterministic worker teardown.
      fileParallelism: !process.env.CI,
    },
  }),
);
