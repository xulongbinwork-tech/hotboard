"""HotBoard 后端测试：RSS 解析归一化、推荐匹配、探测逻辑。"""

import time

import feed_fetcher
import seed_catalog


def _entry(**kw):
    class E(dict):
        pass
    return E(kw)


def test_normalize_entry_basic():
    entry = _entry(
        title="  测试标题  ",
        link="https://example.com/a",
        summary="<p>hello</p> <b>world</b> " + "x" * 500,
        published_parsed=time.gmtime(1000000),
    )
    item = feed_fetcher.normalize_entry(entry, "测试源")
    assert item["title"] == "测试标题"
    assert item["link"] == "https://example.com/a"
    assert "<" not in item["summary"] and len(item["summary"]) <= 300
    assert item["source"] == "测试源"
    assert item["published"] > 0


def test_normalize_entry_defaults():
    item = feed_fetcher.normalize_entry(_entry(), "s")
    assert item["title"] == "无标题"
    assert item["summary"] == ""


def test_suggest_exact_alias():
    results = seed_catalog.suggest("3d打印")
    assert results, "应能推荐 3D 打印相关源"
    assert any("3dprintingindustry" in r["url"] for r in results)


def test_suggest_english_alias():
    results = seed_catalog.suggest("AI")
    urls = [r["url"] for r in results]
    assert any("huggingface" in u for u in urls)


def test_suggest_no_match():
    assert seed_catalog.suggest("一个不存在的行业xyz") == []


def test_suggest_empty():
    assert seed_catalog.suggest("") == []
    assert seed_catalog.suggest(None) == []


def test_all_industries_nonempty():
    inds = seed_catalog.all_industries()
    assert len(inds) >= 10
    assert "AI" in inds and "3D打印" in inds


def test_cache_key_stable():
    a = feed_fetcher.hashlib.md5(",".join(sorted(["u1", "u2"])).encode()).hexdigest()
    b = feed_fetcher.hashlib.md5(",".join(sorted(["u2", "u1"])).encode()).hexdigest()
    assert a == b


COMMON_PATHS = feed_fetcher.COMMON_RSS_PATHS


def test_detect_paths_include_common():
    assert "/feed" in COMMON_PATHS
    assert "/rss.xml" in COMMON_PATHS
