from collections import defaultdict

from app.schemas.github_schemas import AIInput


def create_batches(content: AIInput):
    user = content.user_detail
    context = content.user_context
    readmes = content.readme

    tech_by_repo = defaultdict(list)

    for profile in user:
        for file in profile.tech:
            tech_by_repo[file.repo].append(file.model_dump())

    batches = [[], [], []]
    i = 0

    for readme in readmes:
        data = {
            "repo": readme.repo,
            "readme": readme.readme,
            "tech": tech_by_repo.pop(readme.repo, []),
        }

        batches[i].append(data)
        i = (i + 1) % 3

    # Include remaining projects that have files but no README.
    for repo, files in tech_by_repo.items():
        data = {
            "repo": repo,
            "readme": None,
            "tech": files,
        }

        batches[i].append(data)
        i = (i + 1) % 3

    result = []

    for batch in batches:
        if batch:
            result.append({
                "user_detail": [
                    profile.model_dump(exclude={"tech"})
                    for profile in user
                ],
                "user_context": context.model_dump() if context else None,
                "projects": batch,
            })

    return result
