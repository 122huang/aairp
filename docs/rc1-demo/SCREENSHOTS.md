# RC1-Demo 截图

## 说明

当前目录下的 PNG 为 **演示用 UI 效果图**（基于 RC1 Demo 界面设计生成），用于 PPT / 文档占位。

**真实系统截图**（推荐对外 Demo 使用）请在 API 启动后自行截取：

```powershell
pnpm dev:api
# 浏览器打开 http://localhost:3000/demo-ui/
# Win+Shift+S 或浏览器 DevTools 截图
```

## 推荐演示顺序（4 张）

| # | 文件 | 对应 Tab | 演示话术 |
|---|------|----------|----------|
| 1 | `demo-01-review-flow-reject.png` | 审核流程 | Rule BLOCKER + 9 步 Stepper |
| 2 | `demo-02-review-report-reject.png` | 审核报告 | HTML 报告 REJECT |
| 3 | `demo-03-knowledge-trace.png` | Knowledge Trace | 法规→规则→LLM 跳过→决策 |
| 4 | `demo-04-case-library.png` | Case Library | 判例沉淀 |

## 真实截图 Checklist

- [ ] 左上角 API 绿点 `API ok`
- [ ] REJECT 样例 LLM 步骤为 skipped
- [ ] 报告 iframe 显示 findings 表
- [ ] Case Library ≥ 5 条（`pnpm seed:rc1-cases`）
