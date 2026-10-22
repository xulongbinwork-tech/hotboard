# 🔥 HotBoard —— 我的行业热榜

一个**行业完全由你自己定义**的热榜网站：想关注 AI 就加 AI，想关注 3D 打印就加 3D 打印，每个行业一个标签页，随时切换。

类似 [ai-hot](https://github.com/laolaoshiren/ai-hot)，但 ai-hot 只有 AI 一个行业，HotBoard 的任何行业都可以自己输入创建。

## 特性

- 🏷️ **自定义行业标签页**：每个人输入自己关注的行业（AI / 3D打印 / 游戏 / 烘焙……随便什么）
- 🔍 **自动推荐信息源**：输入行业关键词，从内置目录推荐 RSS 源，勾选即可
- ⚡ **网站 RSS 自动探测**：粘贴任意网站地址，自动发现它的 RSS 订阅
- 🔗 **手动添加 RSS**：任何 RSS 地址都能加
- 🔒 **免登录、配置私有化**：所有配置存在你自己浏览器的 localStorage，多人使用互不影响
- 📤 **导出/导入配置**：JSON 格式，换电脑、换浏览器可以带走
- 💾 **结果缓存 15 分钟**：避免频繁抓取被源站封禁

## 快速开始

```bash
cd backend

# 第一次使用：创建虚拟环境并安装依赖
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt

# 启动
./.venv/Scripts/python.exe app.py
```

然后浏览器打开 **http://localhost:8000**

点击右上角 **＋ 添加行业**，输入「3D打印」，点 **🔍 推荐**，勾选几个源，**✓ 创建行业**，就能看到 3D 打印行业的热榜了。

## 使用说明

| 操作 | 方法 |
|------|------|
| 添加行业 | 右上角「＋ 添加行业」 |
| 切换行业 | 点顶部标签页 |
| 修改行业（改名/删源/删行业） | 点标签上的 ⚙ |
| 刷新热点 | 右上角「🔄 刷新」（缓存 15 分钟） |
| 备份/迁移配置 | 「📤 导出配置」下载 JSON，新浏览器里「📥 导入配置」粘贴 |

## 网络说明（重要）

- 部分境外源（Hugging Face、Hacker News 等）在国内网络下**需要代理**才能抓取。
- 如果你使用 Clash 等代理工具，启动服务前设置环境变量即可让后端走代理：

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
./.venv/Scripts/python.exe app.py
```

- 抓取失败的源会在列表顶部标红显示，不影响其他源。

## 扩充内置行业目录

内置目录在 `backend/seed_catalog.py`，格式：

```python
"行业名": [
    {"name": "源名称", "url": "https://example.com/feed", "note": "说明"},
],
```

加完后重启服务即可。用户即使不依赖目录，也可以完全通过「探测网站」和「手动添加 RSS」自定义任何行业。

## 项目结构

```
hotboard/
├── backend/
│   ├── app.py             # FastAPI 主程序（API + 静态托管）
│   ├── feed_fetcher.py    # RSS 抓取/解析/缓存/探测
│   ├── seed_catalog.py    # 内置行业源目录
│   ├── requirements.txt
│   └── test_app.py        # pytest 测试
├── frontend/
│   ├── index.html
│   ├── app.js             # 交互 + localStorage 配置
│   └── style.css
└── README.md
```

## 测试

```bash
cd backend
./.venv/Scripts/python.exe -m pytest test_app.py -q
```

## API

| 接口 | 说明 |
|------|------|
| `GET /api/feed?urls=rss1,rss2` | 抓取合并多个 RSS，返回按时间排序的条目 |
| `GET /api/suggest?keyword=3d打印` | 按关键词推荐内置源 |
| `POST /api/detect` `{"url": "https://example.com"}` | 探测网站的 RSS 地址 |
| `GET /api/industries` | 列出内置行业 |

交互式 API 文档：http://localhost:8000/docs
