import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const sourceFiles = ["src/**/*.ts"];
const testFiles = ["tests/**/*.ts"];
const typescriptFiles = [...sourceFiles, ...testFiles, "*.config.ts"];
const codeFiles = ["**/*.{js,mjs,cjs,ts}"];

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/generated/**",
    "**/__generated__/**",
    "**/*.min.js",
    "main.js"
  ]),
  {
    name: "heading-mindmap/javascript",
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended]
  },
  {
    name: "heading-mindmap/typescript",
    files: typescriptFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts"]
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    name: "heading-mindmap/browser-source",
    files: sourceFiles,
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    name: "heading-mindmap/node-tooling",
    files: ["*.{js,mjs,cjs}", "*.config.ts", "scripts/**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    name: "heading-mindmap/vitest",
    files: testFiles,
    extends: [vitest.configs.recommended],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    name: "heading-mindmap/maintainability",
    files: codeFiles,
    rules: {
      "max-lines": ["warn", {
        max: 500,
        skipBlankLines: true,
        skipComments: true
      }],
      "max-lines-per-function": ["warn", {
        max: 100,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
      }],
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
      "max-statements": ["warn", 40]
    }
  },
  {
    // 测试套件以 describe 回调聚合独立用例和多行 Markdown 样本，使用测试专属上限。
    name: "heading-mindmap/declarative-test-suites",
    files: testFiles,
    rules: {
      "max-lines": ["warn", {
        max: 1000,
        skipBlankLines: true,
        skipComments: true
      }],
      "max-lines-per-function": ["warn", {
        max: 800,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
      }]
    }
  },
  {
    // 真实 Obsidian E2E 是一条按顺序执行的单场景脚本，保留线性结构便于现场诊断。
    name: "heading-mindmap/obsidian-e2e-scenario",
    files: ["scripts/verify-obsidian-e2e.mjs"],
    rules: {
      "max-lines": ["warn", {
        max: 800,
        skipBlankLines: true,
        skipComments: true
      }],
      "max-lines-per-function": ["warn", {
        max: 600,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
      }],
      "max-statements": ["warn", 80]
    }
  }
);
