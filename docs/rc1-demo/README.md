# RC1-Demo v1

**Release Candidate:** RC1-Demo — UI 打磨，冻结新增业务能力。

## 启动

```powershell
.\scripts\start-deps.ps1
pnpm install
pnpm seed:rc1-cases   # 预置 5 条 Case Library
pnpm dev:api
start http://localhost:3000/demo-ui/
```

## 入口

- **Demo UI:** http://localhost:3000/demo-ui/
- **API health:** http://localhost:3000/health

## 5 条固定 Demo 数据

见 `apps/demo-ui/public/demo-cases.json`

| ID | 预期 |
|----|------|
| demo-01-reject-cure | REJECT |
| demo-02-pass-food | PASS |
| demo-03-warn-disclosure | WARN |
| demo-04-warn-superlative | WARN |
| demo-05-pass-wellness | PASS |

## 文档

- [DEMO-SCRIPT-3MIN.md](./DEMO-SCRIPT-3MIN.md)
- [DEMO-CHECKLIST.md](./DEMO-CHECKLIST.md)
- [DEMO-RISKS.md](./DEMO-RISKS.md)

## RC1 约束

- 不新增审核逻辑 / 不改架构 / 不新增 DB
- 仅静态 UI + Case 种子 JSON + 文档
