def test_occupations_unavailable_before_content_load(client):
    response = client.get("/api/v1/occupations")
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "content_not_loaded"


def test_list_occupations(client, seeded):
    body = client.get("/api/v1/occupations").get_json()
    assert body["content_version"] == seeded.version
    slugs = [o["slug"] for o in body["occupations"]]
    assert slugs == ["test-occupation", "other-occupation"]
    first = body["occupations"][0]
    assert first["exposure"]["gradient"] == "gradient_2"
    assert first["task_count"] == 1
    assert first["pathway_kinds"] == ["adapt", "discover", "transform"]
    assert first["simulation_available"] is True


def test_occupation_detail_contains_tasks_skills_pathways_and_evidence(client, seeded):
    response = client.get("/api/v1/occupations/test-occupation")
    assert response.status_code == 200
    body = response.get_json()
    assert body["occupation"]["exposure"]["measures"].startswith("potential exposure")
    assert body["tasks"][0]["exposure"] == {"level": "medium", "ilo_task_score": 0.6, "basis": "fixture"}
    assert body["tasks"][0]["skills"][0]["slug"] == "skill-a"
    assert body["tasks"][0]["evidence"][0]["key"] == "test-source"
    assert [s["importance"] for s in body["skills"]] == ["core", "emerging"]
    assert {p["kind"] for p in body["pathways"]} == {"adapt", "transform", "discover"}
    assert {e["key"] for e in body["evidence"]} == {"test-source", "kenya-source"}
    kenya = next(e for e in body["evidence"] if e["key"] == "kenya-source")
    assert kenya["is_african_evidence"] is True
    assert body["workforce_events"][0]["slug"] == "test-event"
    assert body["simulation"] == {"available": True, "scenario_count": 3}
    assert {s["key"] for s in body["sources"]} == {"test-source", "kenya-source"}


def test_unknown_or_malformed_occupation_is_404(client, seeded):
    assert client.get("/api/v1/occupations/missing").status_code == 404
    assert client.get("/api/v1/occupations/BAD_SLUG").get_json()["error"]["code"] == "occupation_not_found"


def test_evidence_listing_and_filters(client, seeded):
    assert client.get("/api/v1/evidence").get_json()["count"] == 2
    kenya = client.get("/api/v1/evidence?region=kenya").get_json()
    assert [s["key"] for s in kenya["sources"]] == ["kenya-source"]
    assert client.get("/api/v1/evidence?region=mars").status_code == 422
    assert client.get("/api/v1/evidence?unexpected=1").status_code == 422


def test_evidence_detail_shows_where_it_is_used(client, seeded):
    body = client.get("/api/v1/evidence/test-source").get_json()
    assert body["source"]["findings"][0]["verbatim"] is False
    assert body["source"]["retrieved_on"] == "2026-01-01"
    used_types = {u["type"] for u in body["used_by"]}
    assert used_types == {"occupation", "task", "pathway", "scenario"}
    assert client.get("/api/v1/evidence/nope").status_code == 404


def test_workforce_events_and_methodology(client, seeded):
    events = client.get("/api/v1/workforce-events").get_json()
    assert events["events"][0]["primary_source"]["key"] == "kenya-source"
    assert events["events"][0]["occupations"] == [{"slug": "test-occupation", "name": "Test Occupation"}]
    methodology = client.get("/api/v1/methodology").get_json()
    assert methodology["content_version"] == seeded.version
    assert methodology["methodology"] == {"purpose": "testing"}
