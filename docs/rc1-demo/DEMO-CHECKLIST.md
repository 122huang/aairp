# RC1-Demo — 演示检查清单

**版本：** RC1-Demo v1 · 2026-06-26

---

## A. 演示前（T-30 min）

| # | 检查项 | 命令 / 操作 | 预期 |
|---|--------|-------------|------|
| A1 | Node ≥ 20 + pnpm | `node -v` `pnpm -v` | 版本满足 |
| A2 | PG + Redis 运行 | `.\scripts\start-deps.ps1` | 容器 healthy |
| A3 | 环境变量 | `copy .env.example .env` | DATABASE_URL / REDIS_URL 已设 |
| A4 | 依赖安装 | `pnpm install` | 无 error |
| A5 | 构建 | `pnpm build` | 全包通过 |
| A6 | API 启动 | `pnpm dev:api` | 监听 :3000 |
| A7 | Health | `curl http://localhost:3000/health` | 200 |
| A8 | Demo UI | 浏览器打开 http://localhost:3000/demo-ui/ | 页面加载，API 绿点 |
| A9 | Case 种子 | `case-library/index/manifest.json` 含 5 条 | Case Library 非空 |
| A10 | 浏览器 | Chrome/Edge 最新，100% 缩放 | 无缓存旧 JS |

---

## B. 演示中（Live）

| # | 检查项 | 说明 |
|---|--------|------|
| B1 | 默认选中 demo-01-reject-cure | 左侧高亮 |
| B2 | Stepper 9 格顺序点亮 | upload → case |
| B3 | REJECT 样例 LLM 步骤为 skipped | 灰色/跳过态 |
| B4 | 报告 tab 显示 HTML iframe | REJECT 色块 |
| B5 | Knowledge Trace 有 Regulation/Rule 行 | 含 citation |
| B6 | Case Library ≥ 5 卡片 | 含种子 + 新跑审核 |
| B7 | （可选）PASS 样例 30s 内完成 | 全 step done |

---

## C. 演示后

| # | 检查项 | 说明 |
|---|--------|------|
| C1 | 收集反馈 | docs/trial-feedback-template.md |
| C2 | 记录 review_id | 页脚或 Network 面板 |
| C3 | 若 API 报错 | 查 docs/known-issues.md |

---

## D. 快速冒烟（5 min）

```powershell
.\scripts\start-rc1-demo.ps1
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/admin/cases
start http://localhost:3000/demo-ui/
```

手动：选 reject 样例 → 开始审核 → 确认 REJECT 报告。

---

## E. 失败回退

| 现象 | 回退 |
|------|------|
| API 离线 | 重启 `pnpm dev:api`，检查 PG/Redis |
| UI 404 | 确认 `apps/demo-ui/public/index.html` 存在 |
| Case 空 | 检查 `case-library/index/manifest.json` |
| 审核 500 | 看 API 日志 |
| 演示超时 | 仅跑 demo-01 + Trace + Case Library |
