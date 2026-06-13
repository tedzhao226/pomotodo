import pytest

from app.parser import parse_raw


def test_estimate_present():
    name, tags, estimate = parse_raw("PTE #learn *5")
    assert name == "PTE"
    assert tags == ["learn"]
    assert estimate == 5


def test_estimate_absent():
    name, tags, estimate = parse_raw("write essay #learn #english")
    assert name == "write essay"
    assert tags == ["learn", "english"]
    assert estimate is None


def test_multiple_tags():
    name, tags, estimate = parse_raw("task #a #b #c")
    assert name == "task"
    assert tags == ["a", "b", "c"]
    assert estimate is None


def test_multi_word_name():
    name, tags, estimate = parse_raw("read the big book")
    assert name == "read the big book"
    assert tags == []
    assert estimate is None


def test_no_markers():
    name, tags, estimate = parse_raw("read book")
    assert name == "read book"
    assert tags == []
    assert estimate is None


def test_non_int_star_token_treated_as_name():
    name, tags, estimate = parse_raw("do work *abc today")
    assert name == "do work *abc today"
    assert tags == []
    assert estimate is None


def test_empty_name_raises():
    with pytest.raises(ValueError, match="empty"):
        parse_raw("#learn *5")
    with pytest.raises(ValueError, match="empty"):
        parse_raw("   ")


def test_tag_dedupe_preserves_order():
    name, tags, estimate = parse_raw("task #learn #english #learn")
    assert name == "task"
    assert tags == ["learn", "english"]
    assert estimate is None


def test_first_estimate_wins():
    name, tags, estimate = parse_raw("task *3 *7")
    assert name == "task"
    assert estimate == 3
