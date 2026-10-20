import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    import os
    os.environ["CACHE_DIR"] = str(tmp_path_factory.mktemp("cache"))
    os.environ["RATE_LIMIT"] = "1000"
    from app import main
    from app.builder import Builder
    main.builder = Builder(os.environ["CACHE_DIR"], timeout=120)
    return TestClient(main.app)


@pytest.fixture(scope="session")
def presets(client):
    return {p["name"]: p for p in client.get("/api/presets").json()}
