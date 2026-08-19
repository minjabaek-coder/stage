import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Native <img> is an intentional project-wide choice (avoids Vercel Image
  // Optimization limits/cost; images are served from Supabase Storage).
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 프로젝트 규칙 1의 임시 작업 산출물(git 미추적). 일회성 검증 스크립트가
    // lint 경고를 만들어 실제 문제의 신호를 흐리게 하므로 제외한다.
    ".scratch/**",
    "backups/**",
  ]),
]);

export default eslintConfig;
