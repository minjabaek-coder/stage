import { defineConfig } from "vitest/config";
import path from "node:path";

// 순수 로직 단위 테스트 전용 설정 (roadmap S1-12).
//
// 이 프로젝트의 검증은 그동안 `.scratch/`의 일회성 스크립트로만 이뤄져 git에 남지 않았고,
// 코드를 고칠 때마다 이전 검증이 여전히 통과하는지 알 수 없었다. 여기에는 **DB·네트워크·
// API 키가 필요 없는 순수 로직만** 담는다 — CI에서 비밀값 없이 항상 돌아야 하기 때문이다.
// DB나 Gemini가 필요한 검증은 `.scratch/`의 수동 스크립트로 남긴다.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 생성 산출물·임시 작업물은 제외
    exclude: ["node_modules/**", "src/generated/**", ".scratch/**", ".next/**"],
  },
});
