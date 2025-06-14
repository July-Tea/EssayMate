# EssayMate

[![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/) [![Vue](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/) [![Node](https://img.shields.io/badge/Node-18.20.7-blue.svg)](https://nodejs.org/) [![Version](https://img.shields.io/badge/Version-v0.1.1-orange.svg)](https://github.com/July-Tea/EssayMate)

EssayMate 是一个基于 AI 的雅思/托福/GRE作文批改助手，支持自动评分、详细反馈和智能建议。
EssayMate is an AI-powered IELTS / TOEFL / GRE essay correction assistant that provides automated scoring, detailed feedback, and intelligent suggestions.

![image](https://github.com/July-Tea/For-Images/blob/main/Image_1.png)

## ✨ 特性 | Features

- 🎯 支持雅思、托福、GRE等作文批改 / Supports essay correction for IELTS, TOEFL, GRE, and more

- 🤖 集成主流 AI 模型（目前支持 Doubao、Tongyi、Kimi） / Integrates mainstream AI models (currently supports Doubao, Tongyi, and Kimi)

- 🔒 本地部署，数据安全 / Local deployment for data security

## 🚀 快速开始 | Quick Start

### 环境要求 | Prerequisites
> 推荐使用 nvm 进行版本管理 / recommended to use nvm for version management

此项目需要 Node.js 18.20.7 / This project requires Node.js 18.20.7.

### 项目安装与启动 | Project Installation and Startup

```bash
# 克隆项目 | Clone the project
git clone https://github.com/July-Tea/EssayMate

# 进入项目目录 | Enter project directory
cd essaymate

# 安装 Node.js（如果尚未安装）| Install Node.js (if not installed)
nvm install
nvm use

# 安装项目依赖 | Install project dependencies
npm install

# 启动开发服务器 | Start development server
npm start
```

启动后，访问 http://localhost:5173 即可使用。
After starting, visit http://localhost:5173 to use the application

## 🛠️ 技术栈 | Tech Stack
- 前端：Vue 3 + Vite + TypeScript + Element Plus / Frontend: Vue 3 + Vite + TypeScript + Element Plus
- 后端：Node.js + Express / Backend: Node.js + Express
- 数据库：SQLite / Database: SQLite
- 图标：Iconfont / Icon: Iconfont

## 📚 支持的考试类型 | Supported Exam Types
- [x] 雅思写作 / IELTS Writing
  - [x] Task 1（图表作文） / Task 1 (Graph Description)
  - [x] Task 2（议论文） / Task 2 (Essay)
- [ ] 托福写作 / TOEFL Writing
- [ ] GRE写作 / GRE Writing

## 🤖 支持的AI模型 | Supported AI Models
- [x] 豆包 / Doubao
- [x] 通义千问 / Tongyi Qianwen
- [x] Kimi
- [ ] DeepSeek
- [ ] Ollama
- [ ] Gemini
- [ ] OpenAI

## 📋 待办事项 | Todo List
- [ ] 批改等待时间优化（并发批改） / Optimization of Grading Waiting Time (Concurrent Grading)
- [ ] 接入更多AI模型 / Integrate more AI models
- [ ] 加入OCR文字识别功能 / Integrate OCR for image text recognition
- [ ] 完善AI随心问 - 加入上下文 / Improve AI Chat Feature – Add Context Support
- [ ] 在设置界面加入自定义修改Prompt功能 / Add a feature in the settings interface to allow custom modification of prompts.
- [ ] 连词助手 / Conjunction assistant
- [ ] 深色模式支持 / Dark mode support
- [ ] 笔记功能 / Notes feature
- [ ] 错误处理优化 / Error handling optimization
- [ ] 图片理解能力支持（Task 1） / Image understanding support (Task 1)
- [ ] Prompt Engineering 优化 / Prompt Engineering optimization
- [ ] 前端界面语言设置 / Frontend interface langauge settings
- [ ] 优化批改流程的用户界面和交互体验，解决响应延迟问题 / Optimized user interface and interaction experience of the correction process, addressing response latency issues
- [ ] 反馈语言设置 / Feedback language settings
- [x] 统一雅思写作Task 1和Task 2的反馈界面，提升用户体验 / Unified feedback interface for IELTS Writing Task 1 and Task 2, improving user experience
- [x] 项目列表批量管理 / Batch project list management
- [x] 优化等待体验 / Optimize the waiting experience
- [x] 范文功能 / Sample essays feature
- [x] AI随心问 - 于反馈界面加入用户询问AI的前端入口 /  AI Chat Feature - Add a frontend entry for users to ask AI within the feedback interface.

## ℹ️ 实用信息 | Useful Information
- 数据库管理：访问 http://localhost:5173/database 查看后端数据库信息
  Database Management: Visit http://localhost:5173/database to view backend database information
- 日志查看：访问 http://localhost:5173/logs 查看 AI 请求相关日志
  Logs: Visit http://localhost:5173/logs to view AI request logs

## 📝 开源协议 | License
本项目采用 Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License 协议。
This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.

- ✅ 可以自由使用、修改和分享 / Free to use, modify, and share
- ✅ 必须保留原作者署名 / Must retain original author attribution
- ✅ 修改后的作品必须使用相同的协议 / Modified works must use the same license
- ❌ 禁止商业使用 / No commercial use allowed

## 💡 特别鸣谢 | Special Thanks
感谢 Iconfont 的优质SVG资源 / Thanks to Iconfont for providing high-quality SVG resources.

## 📮 联系方式 ｜ Contact Information
欢迎联系juratjan123@outlook.com / Feel free to reach out to juratjan123@outlook.com.
