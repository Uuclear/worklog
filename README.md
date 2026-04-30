# 工作日志 (Worklog)

每日工作任务管理与回顾系统 — PWA 应用，支持手机桌面直接使用。

## 功能

- **每日任务管理** — 添加、完成、跳过任务，按日期切换查看
- **工作回顾** — 自动汇总当日任务统计，手写工作日志（自动保存）
- **天气与定位** — 自动获取当前位置和天气信息
- **多媒体记录** — 语音录音、拍照、图片上传
- **长期任务** — 跨日期的持续性待办事项
- **历史回顾** — 查看任意日期的任务和日志
- **PWA 支持** — 可添加到手机桌面，离线可用

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (内置 `node:sqlite`)
- **前端**: 原生 HTML/CSS/JavaScript（无框架）
- **文件上传**: Multer
- **部署**: PM2 进程管理 + Nginx 反向代理

## 本地开发

```bash
npm install
node server.js
```

默认运行在 `http://localhost:8090`

## 部署

```bash
# 安装依赖
npm install

# 启动服务
pm2 start server.js --name worklog -- 8090
pm2 save
```

## 目录结构

```
├── server.js           # 后端 API
├── package.json
├── .gitignore
├── data/               # SQLite 数据库
│   └── worklog.db
├── uploads/            # 用户上传的文件
├── public/
│   ├── index.html      # 主页面
│   ├── style.css       # 样式
│   ├── app.js          # 前端逻辑
│   ├── manifest.json   # PWA 配置
│   ├── sw.js           # Service Worker
│   └── logo.png        # 公司 Logo
```

## API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/tasks?date=YYYY-MM-DD` | 获取某天的任务 |
| POST | `/api/tasks` | 创建任务 |
| PATCH | `/api/tasks/:id` | 更新任务状态 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/long-tasks` | 获取长期任务 |
| POST | `/api/long-tasks` | 创建长期任务 |
| PATCH | `/api/long-tasks/:id` | 更新长期任务状态 |
| DELETE | `/api/long-tasks/:id` | 删除长期任务 |
| GET | `/api/journal?date=YYYY-MM-DD` | 获取某天的日志 |
| PUT | `/api/journal` | 保存/更新日志 |
| GET | `/api/context?date=YYYY-MM-DD` | 获取天气和位置 |
| PUT | `/api/context` | 保存天气和位置 |
| GET | `/api/weather?lat=X&lon=Y` | 查询天气 |
| POST | `/api/media` | 上传文件 |
| GET | `/api/media?date=YYYY-MM-DD` | 获取某天的媒体文件 |
| DELETE | `/api/media/:id` | 删除媒体文件 |
| GET | `/api/history?limit=30` | 获取历史日志列表 |
