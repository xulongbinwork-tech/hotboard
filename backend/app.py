"""HotBoard 后端：FastAPI 主程序。"""

import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import feed_fetcher
import seed_catalog

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="HotBoard", version="1.0")

# 本地服务，放开 CORS 方便调试
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_static(request, call_next):
    """静态资源不缓存，避免浏览器拿到旧版 JS/CSS。"""
    resp = await call_next(request)
    if request.url.path.endswith((".js", ".css", ".html")):
        resp.headers["Cache-Control"] = "no-store"
    return resp

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/api/feed")
async def get_feed(urls: str = Query(..., description="逗号分隔的 RSS 地址")):
    """抓取并合并多个 RSS 源。"""
    url_list = [u.strip() for u in urls.split(",") if u.strip()]
    if not url_list:
        raise HTTPException(status_code=400, detail="urls 不能为空")
    if len(url_list) > 50:
        raise HTTPException(status_code=400, detail="一次最多 50 个源")
    return await feed_fetcher.fetch_feeds(url_list)


@app.get("/api/suggest")
async def get_suggest(keyword: str = Query(..., description="行业关键词")):
    """按关键词推荐内置源。"""
    return {"sources": seed_catalog.suggest(keyword)}


class DetectRequest(BaseModel):
    url: str


@app.post("/api/detect")
async def post_detect(body: DetectRequest):
    """探测网站的 RSS 地址。"""
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="url 不能为空")
    found = await feed_fetcher.detect_rss(body.url)
    return {"rss": found}


class AISuggestRequest(BaseModel):
    keyword: str
    base_url: str
    api_key: str
    model: str = "deepseek-chat"


class TranslateRequest(BaseModel):
    items: list[dict]  # [{title, summary}]
    base_url: str
    api_key: str
    model: str = "deepseek-chat"
    lang: str = "中文"


TRANSLATE_PROMPT = """把下面的 RSS 条目翻译成{lang}。要求：
1. 标题和摘要都要翻译，保留专有名词原文（如 GPT、Claude、Kubernetes）。
2. 摘要为空的条目，summary 输出空字符串。
3. 只输出 JSON 数组，不要输出任何其他文字、不要 markdown 代码块。
4. 输出数组长度和输入必须一致、顺序一致，格式：[{{"title":"...","summary":"..."}}]

输入：
{texts}"""


@app.post("/api/translate")
async def translate(body: TranslateRequest):
    """调用用户配置的 AI 接口，批量把标题/摘要翻译成中文。"""
    if not body.api_key.strip():
        raise HTTPException(status_code=400, detail="请先在「AI 接口设置」里填写 API Key")
    items = body.items[:25]
    if not items:
        raise HTTPException(status_code=400, detail="items 不能为空")

    texts = json.dumps(
        [{"title": str(it.get("title", "")), "summary": str(it.get("summary", ""))} for it in items],
        ensure_ascii=False,
    )
    base = body.base_url.strip().rstrip("/")
    if not base.startswith("http"):
        base = "https://" + base
    try:
        client = feed_fetcher.get_client()
        resp = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {body.api_key.strip()}"},
            json={
                "model": body.model.strip() or "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "你是翻译引擎，只输出 JSON，不输出其他内容。"},
                    {"role": "user", "content": TRANSLATE_PROMPT.format(texts=texts, lang=body.lang or "中文")},
                ],
                "temperature": 0.1,
            },
            timeout=90,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        data = _parse_ai_json(content)
        if not isinstance(data, list):
            raise ValueError("AI 返回的不是数组")
        results = []
        for i, it in enumerate(items):
            tr = data[i] if i < len(data) else {}
            results.append({
                "title": str(tr.get("title", it.get("title", ""))).strip() or it.get("title", ""),
                "summary": str(tr.get("summary", "")).strip(),
            })
        return {"translations": results}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"翻译失败：{exc}") from exc


AI_PROMPT = """为用户关注的领域「{keyword}」推荐 6-10 个【直接相关】的垂直网站/博客/社区（给出网站首页地址，不要给 RSS 地址）。
要求（非常重要）：
1. 每个网站必须与该领域直接相关，例如领域是「儿童智能硬件」就应推荐儿童手表、教育机器人、智能玩具等垂直站点，不要用泛科技大站充数。
2. 必须是真实存在的网站，不要编造域名；不确定的不要列。
3. 中英文皆可，优先该领域活跃、有资讯/博客板块的站点（更可能有 RSS 订阅）。
4. 只输出 JSON，不要输出任何其他文字、不要 markdown 代码块，格式如下：
{{"industry_name":"合适的行业名","sites":[{{"name":"网站名","url":"https://网站首页地址","note":"一句话说明它与该领域的关系"}}]}}"""


def _parse_ai_json(content: str):
    """从模型输出中提取第一个 JSON 值（忽略前后的杂讯文字）。"""
    import json
    import re

    text = content.strip()
    # 去掉 markdown 代码块包裹
    text = re.sub(r"^```(json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip())
    # 找到第一个 JSON 起点（对象或数组）
    starts = [i for i in (text.find("{"), text.find("[")) if i != -1]
    if not starts:
        raise ValueError("AI 返回中没有 JSON")
    start = min(starts)
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(text[start:])  # 只取第一个 JSON 值，忽略后面的多余内容
    return obj


@app.post("/api/ai-suggest")
async def ai_suggest(body: AISuggestRequest):
    """调用用户配置的 AI 接口，为关键词推荐行业名和信息源。"""
    if not body.keyword.strip():
        raise HTTPException(status_code=400, detail="keyword 不能为空")
    if not body.api_key.strip():
        raise HTTPException(status_code=400, detail="请先在「AI 接口设置」里填写 API Key")

    base = body.base_url.strip().rstrip("/")
    if not base.startswith("http"):
        base = "https://" + base
    try:
        client = feed_fetcher.get_client()
        resp = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {body.api_key.strip()}"},
            json={
                "model": body.model.strip() or "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "你只输出 JSON，不输出其他内容。"},
                    {"role": "user", "content": AI_PROMPT.format(keyword=body.keyword.strip())},
                ],
                "temperature": 0.3,
            },
            timeout=60,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        data = _parse_ai_json(content)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI 接口调用失败：{exc}") from exc

    # 清洗结果：只要真实网站首页地址
    sites = []
    for s in data.get("sites", [])[:12]:
        url = str(s.get("url", "")).strip()
        if url.startswith("http"):
            sites.append({
                "name": str(s.get("name", url)).strip()[:50] or url,
                "url": url,
                "note": str(s.get("note", "")).strip()[:100],
            })
    if not sites:
        raise HTTPException(status_code=502, detail="AI 没有返回有效网站，请重试或手动添加")

    # 两段式验证：AI 推荐网站 → 自动探测 RSS → 只保留能抓到真实文章的
    import asyncio

    async def _probe(site):
        rss = await feed_fetcher.detect_rss(site["url"])
        if not rss:
            # 兜底：主域名探测不到时试 www 子域
            from urllib.parse import urlparse
            u = urlparse(site["url"])
            host = u.netloc or u.path
            if host and not host.startswith("www."):
                rss = await feed_fetcher.detect_rss(f"https://www.{host}")
        return {**site, "rss": rss}

    try:
        probed = await asyncio.wait_for(
            asyncio.gather(*[_probe(s) for s in sites], return_exceptions=True),
            timeout=45,
        )
    except asyncio.TimeoutError:
        probed = []

    sources = []
    for p in probed:
        if isinstance(p, dict) and p.get("rss"):
            sources.append({
                "name": p["name"],
                "url": p["rss"][0],  # detect_rss 已按路径去重，取第一个
                "cat": "新闻",
                "note": p.get("note", ""),
            })
    dropped = sum(1 for p in probed if not (isinstance(p, dict) and p.get("rss")))
    dropped += max(0, len(sites) - len(probed))  # 超时被跳过的
    if not sources:
        raise HTTPException(
            status_code=502,
            detail="AI 推荐的网站都没发现可用 RSS 订阅。可换关键词重试，或直接粘贴你知道的垂直网站地址用「⚡ 探测」发现订阅。",
        )
    return {
        "industry_name": str(data.get("industry_name", body.keyword.strip()))[:20],
        "sources": sources,
        "dropped": dropped,
    }


@app.get("/api/industries")
async def get_industries():
    """列出内置目录的所有行业。"""
    return {"industries": seed_catalog.all_industries()}


@app.get("/api/directory")
async def get_directory():
    """AI 目录：工具 / 模型 / Agent 静态清单。"""
    import json

    data_file = FRONTEND_DIR / "directory.json"
    return json.loads(data_file.read_text(encoding="utf-8"))


@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
