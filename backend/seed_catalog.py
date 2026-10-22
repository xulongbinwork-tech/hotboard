"""内置行业源目录 + 关键词推荐。

结构：INDUSTRY_SOURCES = {
    "行业名": [
        {"name": "源名称", "url": "RSS地址", "note": "说明"},
        ...
    ],
}
想扩充源，直接往对应行业加条目即可。
"""

INDUSTRY_SOURCES: dict[str, list[dict]] = {
    "AI": [
        {"name": "Hugging Face 博客", "url": "https://huggingface.co/blog/feed.xml", "note": "开源模型与 AI 论文动态"},
        {"name": "OpenAI 博客", "url": "https://openai.com/blog/rss.xml", "note": "OpenAI 官方发布"},
        {"name": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "note": "AI 科技新闻"},
        {"name": "量子位", "url": "https://www.qbitai.com/feed", "note": "中文 AI 资讯"},
        {"name": "InfoQ 中文", "url": "https://www.infoq.cn/feed", "note": "中文技术资讯（含 AI 专栏）"},
    ],
    "3D打印": [
        {"name": "3D Printing Industry", "url": "https://3dprintingindustry.com/feed/", "note": "国际 3D 打印行业媒体"},
        {"name": "All3DP", "url": "https://all3dp.com/feed/", "note": "3D 打印评测与教程"},
        {"name": "Hackaday", "url": "https://hackaday.com/feed/", "note": "硬件创客与制造"},
        {"name": "Make 杂志", "url": "https://makezine.com/feed/", "note": "DIY 制造与创客"},
    ],
    "硬件数码": [
        {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "note": "消费电子与科技"},
        {"name": "Engadget", "url": "https://www.engadget.com/rss.xml", "note": "硬件评测新闻"},
        {"name": "IT之家", "url": "https://www.ithome.com/rss/", "note": "中文数码资讯"},
        {"name": "少数派", "url": "https://sspai.com/feed", "note": "效率工具与数码"},
    ],
    "游戏": [
        {"name": "IGN", "url": "https://feeds.ign.com/ign/all", "note": "游戏新闻与评测"},
        {"name": "GameSpot", "url": "https://www.gamespot.com/feeds/mashup/", "note": "游戏资讯"},
        {"name": "游研社", "url": "https://www.yystv.cn/rss", "note": "中文游戏文化"},
        {"name": "触乐", "url": "https://www.chuapp.com/feed", "note": "中文游戏报道"},
    ],
    "编程": [
        {"name": "Hacker News", "url": "https://news.ycombinator.com/rss", "note": "程序员热榜"},
        {"name": "GitHub 博客", "url": "https://github.blog/feed/", "note": "GitHub 官方动态"},
        {"name": "InfoQ 中文", "url": "https://www.infoq.cn/feed", "note": "中文技术资讯"},
        {"name": "Solidot", "url": "https://www.solidot.org/index.rss", "note": "奇客资讯，科技/开源新闻"},
    ],
    "科技前沿": [
        {"name": "Solidot", "url": "https://www.solidot.org/index.rss", "note": "科技/开源新闻"},
        {"name": "Quanta Magazine", "url": "https://www.quantamagazine.org/feed/", "note": "科学深度报道"},
        {"name": "MIT News", "url": "https://news.mit.edu/rss/topic/artificial-intelligence2", "note": "MIT 科技动态"},
        {"name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index", "note": "硬核科技新闻"},
        {"name": "Wired", "url": "https://www.wired.com/feed/rss", "note": "科技文化与趋势"},
        {"name": "arXiv AI 论文", "url": "http://export.arxiv.org/rss/cs.AI", "note": "每日最新 AI 论文"},
    ],
    "创业与行业": [
        {"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "note": "创业与科技行业"},
        {"name": "Product Hunt", "url": "https://www.producthunt.com/feed", "note": "全球新产品发布"},
        {"name": "华尔街见闻", "url": "https://dedicated.wallstreetcn.com/rss.xml", "note": "宏观与商业资讯"},
        {"name": "FT中文网", "url": "https://www.ftchinese.com/rss/news", "note": "金融时报中文"},
        {"name": "少数派", "url": "https://sspai.com/feed", "note": "效率工具与数字生活"},
        {"name": "V2EX", "url": "https://www.v2ex.com/index.xml", "note": "程序员社区热帖"},
    ],
    "财经": [
        {"name": "华尔街见闻", "url": "https://dedicated.wallstreetcn.com/rss.xml", "note": "中文宏观财经"},
        {"name": "FT中文网", "url": "https://www.ftchinese.com/rss/news", "note": "金融时报中文"},
        {"name": "36氪", "url": "https://36kr.com/feed", "note": "创投与商业"},
    ],
    "汽车": [
        {"name": "汽车之家资讯", "url": "https://www.autohome.com.cn/rss/", "note": "中文汽车资讯"},
        {"name": "Electrek", "url": "https://electrek.co/feed/", "note": "电动车新闻"},
    ],
    "摄影": [
        {"name": "PetaPixel", "url": "https://petapixel.com/feed/", "note": "摄影器材与技巧"},
        {"name": "DPReview", "url": "https://www.dpreview.com/feeds/news.xml", "note": "相机评测"},
    ],
    "科学": [
        {"name": "Nature 新闻", "url": "https://www.nature.com/nature.rss", "note": "顶级期刊动态"},
        {"name": "科学网", "url": "http://news.sciencenet.cn/rss.xml", "note": "中文科研资讯"},
        {"name": "Quanta Magazine", "url": "https://www.quantamagazine.org/feed/", "note": "科普深度报道"},
    ],
    "体育": [
        {"name": "ESPN", "url": "https://www.espn.com/espn/rss/news", "note": "综合体育新闻"},
        {"name": "懂球帝", "url": "https://www.dongqiudi.com/rss", "note": "足球资讯"},
    ],
}

# 常见关键词别名 → 目录行业名
ALIASES = {
    "ai": "AI", "人工智能": "AI", "aigc": "AI", "大模型": "AI", "llm": "AI",
    "3d": "3D打印", "3d打印": "3D打印", "打印机": "3D打印", "打印": "3D打印", "maker": "3D打印", "创客": "3D打印",
    "数码": "硬件数码", "硬件": "硬件数码", "手机": "硬件数码", "电脑": "硬件数码", "tech": "硬件数码",
    "game": "游戏", "games": "游戏", "电竞": "游戏",
    "code": "编程", "coding": "编程", "程序员": "编程", "开发": "编程", "软件": "编程",
    "科技": "科技前沿", "前沿": "科技前沿", "science": "科技前沿", "科研": "科技前沿", "论文": "科技前沿",
    "创业": "创业与行业", "行业": "创业与行业", "投资": "创业与行业", "商业": "创业与行业", "finance": "创业与行业", "股票": "创业与行业", "crypto": "创业与行业", "经济": "创业与行业",
    "car": "汽车", "auto": "汽车", "ev": "汽车", "电动车": "汽车", "新能源": "汽车",
    "photo": "摄影", "camera": "摄影", "拍照": "摄影",
    "science": "科学", "科研": "科学", "space": "科学", "天文": "科学",
    "sport": "体育", "sports": "体育", "soccer": "体育", "足球": "体育", "nba": "体育", "篮球": "体育",
}


def suggest(keyword: str) -> list[dict]:
    """按关键词从目录推荐候选源。"""
    kw = (keyword or "").strip()
    if not kw:
        return []
    kw_lower = kw.lower()

    matched_industries: list[str] = []

    # 1) 别名精确命中
    if kw_lower in ALIASES:
        matched_industries.append(ALIASES[kw_lower])

    # 2) 与目录行业名互相包含
    for name in INDUSTRY_SOURCES:
        if name not in matched_industries and (name in kw or kw in name or name.lower() == kw_lower):
            matched_industries.append(name)

    # 3) 拆分多词再匹配（如 "AI 编程"）
    for token in kw_lower.replace("，", ",").replace(" ", ",").split(","):
        token = token.strip()
        if token and token in ALIASES and ALIASES[token] not in matched_industries:
            matched_industries.append(ALIASES[token])

    seen: set[str] = set()
    results: list[dict] = []
    for ind in matched_industries:
        for src in INDUSTRY_SOURCES[ind]:
            if src["url"] not in seen:
                seen.add(src["url"])
                results.append({**src, "industry": ind})
    return results


def all_industries() -> list[str]:
    return sorted(INDUSTRY_SOURCES.keys())
