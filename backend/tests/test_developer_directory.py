"""The developer directory (#2): query parsing without a database, then
GET /api/developers/ end to end against real PostgreSQL."""

import pytest

from nextnode.application.accounts.directory import PAGE_SIZE, parse_query
from nextnode.domain.accounts import Account, ClientProfile, DeveloperProfile, Portfolio, Role
from nextnode.domain.errors import ValidationError
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.accounts import DjangoAccountRepository, DjangoSkillRepository
from nextnode.infrastructure.persistence.portfolios import DjangoPortfolioRepository

# --- parsing (no database) ---------------------------------------------------------


def test_an_empty_url_means_everyone_on_page_one():
    query = parse_query(None, None, None, None)
    assert (query.text, query.skill_keys, query.available_only, query.page) == (None, (), False, 1)


def test_skills_are_case_insensitive_deduplicated_and_order_free():
    assert parse_query(None, " React ,django,react,, ", None, None).skill_keys == ("django", "react")
    assert parse_query(None, "Django,React", None, None) == parse_query(None, "react,django", None, None)


def test_search_text_is_trimmed():
    assert parse_query("  ada   love ", None, None, "2").text == "ada love"


@pytest.mark.parametrize(
    ("args", "field"),
    [
        (("x" * 101, None, None, None), "q"),
        ((None, ",".join(f"s{i}" for i in range(11)), None, None), "skills"),
        ((None, None, "yes", None), "available"),
        ((None, None, None, "0"), "page"),
        ((None, None, None, "two"), "page"),
        ((None, None, None, "-1"), "page"),
    ],
)
def test_bad_values_are_refused_on_their_parameter(args, field):
    with pytest.raises(ValidationError) as caught:
        parse_query(*args)
    assert list(caught.value.fields) == [field]


# --- the endpoint -------------------------------------------------------------------


@pytest.fixture
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def get(api, make_token, container):
    def fetch(params: str = "", sub: str = "viewer"):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}
        return api.get(f"/api/developers/{params}", **headers)

    return fetch


def add(
    clerk_id: str,
    name: str,
    *,
    role=Role.DEVELOPER,
    headline="Developer",
    skills=("Python",),
    available=False,
):
    skill_repo, accounts = DjangoSkillRepository(), DjangoAccountRepository()
    if role is Role.CLIENT:
        accounts.add(Account.onboard(clerk_id, role, name, ClientProfile.create("Acme", "Retail")))
        return
    profile = DeveloperProfile.create(headline, "", None, list(skills))
    profile = DeveloperProfile(
        profile.headline, "", None, tuple(skill_repo.upsert_many(list(profile.skills)))
    )
    account = accounts.add(Account.onboard(clerk_id, role, name, profile))
    assert account.id is not None
    if available:
        DjangoPortfolioRepository().save(
            account.id, Portfolio.from_onboarding(profile).with_availability(True)
        )


def names(response) -> list[str]:
    assert response.status_code == 200, response.json()
    return [card["display_name"] for card in response.json()["data"]["results"]]


@pytest.fixture
def people(db):
    add("viewer", "Victor Client", role=Role.CLIENT)
    add("ada", "Ada Lovelace", headline="Full-stack developer", skills=("React", "Django"), available=True)
    add("grace", "Grace Hopper", headline="Compiler engineer", skills=("Rust", "React"))
    add("linus", "Linus", headline="Kernel hacker", skills=("C",))
    add("acme", "Acme Corp", role=Role.CLIENT)


def test_the_directory_needs_a_token(api, db):
    assert api.get("/api/developers/").status_code == 401


def test_someone_who_has_not_onboarded_cannot_browse(get, people):
    assert get(sub="newcomer").status_code == 403


def test_every_developer_is_listed_by_name_and_no_client_ever_is(get, people):
    assert names(get()) == ["Ada Lovelace", "Grace Hopper", "Linus"]
    assert names(get("?q=acme")) == []
    assert names(get("?q=victor")) == []


def test_a_card_has_what_the_directory_shows_and_nothing_verified(get, people):
    card = get("?q=ada").json()["data"]["results"][0]
    assert set(card) == {"account_id", "display_name", "headline", "skills", "is_available", "project_count"}
    assert [s["label"] for s in card["skills"]] == ["Django", "React"]
    assert "verif" not in str(get().json()).lower()


def test_text_search_matches_name_or_headline_ignoring_case(get, people):
    assert names(get("?q=GRACE")) == ["Grace Hopper"]
    assert names(get("?q=kernel")) == ["Linus"]
    assert names(get("?q=nobody")) == []


def test_the_skill_filter_needs_every_selected_skill(get, people):
    assert names(get("?skills=react")) == ["Ada Lovelace", "Grace Hopper"]
    assert names(get("?skills=React,django")) == ["Ada Lovelace"]
    assert names(get("?skills=react,c")) == []


def test_filters_combine(get, people):
    assert names(get("?skills=react&q=compiler")) == ["Grace Hopper"]
    assert names(get("?skills=react&available=true")) == ["Ada Lovelace"]


def test_toggling_availability_changes_the_available_filter(api, get, make_token, people):
    assert names(get("?available=true")) == ["Ada Lovelace"]
    body = {"headline": "Kernel hacker", "skills": ["C"], "projects": [], "is_available": True}
    headers = {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub='linus')}"}
    assert api.put("/api/developers/me/portfolio/", data=body, format="json", **headers).status_code == 200
    assert names(get("?available=true")) == ["Ada Lovelace", "Linus"]
    body["is_available"] = False
    api.put("/api/developers/me/portfolio/", data=body, format="json", **headers)
    assert names(get("?available=true")) == ["Ada Lovelace"]


def test_bad_parameters_answer_400_on_the_field(get, people):
    response = get("?page=abc")
    assert response.status_code == 400
    assert list(response.json()["error"]["fields"]) == ["page"]


def test_pages_split_the_results_without_overlap(get, db):
    add("viewer", "Victor Client", role=Role.CLIENT)
    for i in range(PAGE_SIZE + 3):
        add(f"dev_{i}", f"Dev {i:02d}")
    first, second = get().json()["data"], get("?page=2").json()["data"]
    assert (first["total"], first["total_pages"], first["page_size"]) == (PAGE_SIZE + 3, 2, PAGE_SIZE)
    assert len(first["results"]) == PAGE_SIZE
    assert len(second["results"]) == 3
    ids = [c["account_id"] for c in first["results"] + second["results"]]
    assert len(set(ids)) == PAGE_SIZE + 3
    beyond = get("?page=9").json()["data"]
    assert (beyond["results"], beyond["total"]) == ([], PAGE_SIZE + 3)


def test_the_directory_page_runs_a_fixed_number_of_queries(get, people, django_assert_max_num_queries):
    with django_assert_max_num_queries(8):  # auth + count + page + 2 prefetches, whatever the page holds
        assert get().status_code == 200
