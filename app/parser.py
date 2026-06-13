def parse_raw(text: str) -> tuple[str, list[str], int | None]:
    tokens = text.split()
    tags: list[str] = []
    seen_tags: set[str] = set()
    name_tokens: list[str] = []
    estimate: int | None = None

    for token in tokens:
        if token.startswith("#") and len(token) > 1:
            tag = token[1:]
            if tag and tag not in seen_tags:
                seen_tags.add(tag)
                tags.append(tag)
        elif token.startswith("*"):
            if estimate is None:
                rest = token[1:]
                if rest.isdigit():
                    estimate = int(rest)
                else:
                    name_tokens.append(token)
        else:
            name_tokens.append(token)

    name = " ".join(name_tokens).strip()
    if not name:
        raise ValueError("Task name cannot be empty")

    return name, tags, estimate
