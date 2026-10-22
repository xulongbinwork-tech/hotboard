"""RSS 抓取、解析、归一化、内存缓存。"""

import calendar
import hashlib
import time
import threading
import logging
from typing import Any

import feedparser
import httpx

logger = logging.getLogger(__name__)

CACHE_TTL = 15 * 60  # 15 分钟
FETCH_TIMEOUT = 10.0
USER_AGENT = "HotBoard/1.0 (+local RSS reader)"
# 部分站点（如必应新闻 RSS）会拦截非浏览器 UA，对这些站点换用浏览器 UA
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def _ua_for(url: str) -> str:
    return BROWSER_UA if any(h in url for h in ("bing.com",)) else USER_AGENT

_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = threading.Lock()

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=FETCH_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
    return _client


async def http_get(url: str) -> httpx.Response:
    """带自愈的 GET：连接层失败时重建客户端重试一次（应对连接池僵死）。"""
    global _client
    client = get_client()
    headers = {"User-Agent": _ua_for(url)}
    try:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp
    except (httpx.TransportError, httpx.HTTPStatusError):
        try:
            await client.aclose()
        except Exception:  # noqa: BLE001
            pass
        _client = None
        resp = await get_client().get(url, headers=headers)
        resp.raise_for_status()
        return resp


def normalize_entry(entry: Any, feed_title: str, feed_url: str = "") -> dict:
    """把 feedparser 的 entry 归一化成统一结构。"""
    summary = entry.get("summary", "") or ""
    # 有的源 summary 里塞了整段 HTML，去掉标签做个简单截断
    summary = _strip_html(summary)[:300]
    published = (
        entry.get("published_parsed")
        or entry.get("updated_parsed")
        or time.gmtime(0)
    )
    ts = int(calendar.timegm(published)) if published else 0
    return {
        "title": (entry.get("title") or "无标题").strip(),
        "link": entry.get("link", ""),
        "summary": summary,
        "source": feed_title,
        "feed_url": feed_url,
        "published": ts,
    }


def _strip_html(text: str) -> str:
    import re

    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


async def fetch_feed(url: str) -> list[dict]:
    """抓取单个 RSS 源并归一化；失败返回空列表。
    支持 search://关键词 伪协议：聚合多搜索引擎的按关键词订阅。"""
    try:
        if url.startswith("search://"):
            kw = url[len("search://"):]
            return await search_keyword(kw) if kw.strip() else []
        resp = await http_get(url)
        parsed = feedparser.parse(resp.content)
        feed_title = (parsed.feed.get("title") if parsed.feed else None) or url
        entries = [normalize_entry(e, feed_title, url) for e in parsed.entries[:50]]
        return entries
    except Exception as exc:  # noqa: BLE001 - 单个源失败不影响整体
        logger.warning("fetch feed failed %s: %s", url, exc)
        return []


# ===== 多搜索引擎关键词订阅 =====

def _kw_bing_news(kw: str) -> str:
    from urllib.parse import quote
    return f"https://www.bing.com/news/search?q={quote(kw)}&format=rss"


def _kw_bing_web(kw: str) -> str:
    from urllib.parse import quote
    return f"https://www.bing.com/search?q={quote(kw)}&format=rss"


def _kw_google_news(kw: str) -> str:
    from urllib.parse import quote
    return f"https://news.google.com/rss/search?q={quote(kw)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"


async def _search_engine(url: str, source: str, kw: str) -> list[dict]:
    try:
        resp = await http_get(url)
        parsed = feedparser.parse(resp.content)
        items = []
        for e in parsed.entries[:20]:
            item = normalize_entry(e, source, f"search://{kw}")
            items.append(item)
        return items
    except Exception as exc:  # noqa: BLE001 - 单个引擎失败不影响整体
        logger.warning("search engine %s failed for %r: %s", source, kw, exc)
        return []


async def search_keyword(kw: str) -> list[dict]:
    """聚合多个搜索引擎的关键词结果，按链接去重、时间倒序。"""
    import asyncio

    kw = kw.strip()
    results = await asyncio.gather(
        _search_engine(_kw_bing_news(kw), "必应新闻", kw),
        _search_engine(_kw_google_news(kw), "谷歌新闻", kw),
    )
    items: list[dict] = []
    seen: set[str] = set()
    for r in results:
        for it in r:
            link = it.get("link", "")
            if link and link not in seen:
                seen.add(link)
                items.append(it)
    items.sort(key=lambda x: x["published"], reverse=True)
    return items[:60]


async def fetch_feeds(urls: list[str]) -> dict:
    """抓取多个源，返回合并排序后的条目 + 每个源的成功/失败状态。"""
    # 缓存 key：url 排序后哈希
    key = hashlib.md5(",".join(sorted(urls)).encode()).hexdigest()
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_TTL:
            return hit[1]

    import asyncio

    results = await asyncio.gather(*[fetch_feed(u) for u in urls])

    items: list[dict] = []
    sources_status: list[dict] = []
    for url, entries in zip(urls, results):
        sources_status.append({"url": url, "ok": bool(entries), "count": len(entries)})
        items.extend(entries)

    items.sort(key=lambda x: x["published"], reverse=True)
    payload = {"items": items, "sources": sources_status, "updated": int(now)}
    with _cache_lock:
        _cache[key] = (now, payload)
    return payload


COMMON_RSS_PATHS = (
    "/feed",
    "/rss",
    "/feed.xml",
    "/rss.xml",
    "/atom.xml",
    "/index.xml",
    "/feed/",
    "/rss/",
)


async def detect_rss(site_url: str) -> list[str]:
    """探测一个网站常见的 RSS 路径，返回能解析出条目的地址。"""
    site_url = site_url.strip().rstrip("/")
    if not site_url.startswith(("http://", "https://")):
        site_url = "https://" + site_url

    found: list[str] = []
    for path in COMMON_RSS_PATHS:
        candidate = site_url + path
        try:
            resp = await http_get(candidate)
            parsed = feedparser.parse(resp.content)
            if parsed.entries and parsed.version:
                found.append(candidate)
        except Exception:  # noqa: BLE001
            continue
    unique: list[str] = []
    seen: set[str] = set()
    for candidate in found:
        key = candidate.rstrip("/")
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique
