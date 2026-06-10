"""
CosmoChem API 기본 테스트
실행: pytest test_main.py -v
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

NIACINAMIDE_SMILES = "O=C(N)c1cccnc1"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_analyze_valid():
    r = client.post("/analyze", json={"smiles": NIACINAMIDE_SMILES})
    assert r.status_code == 200
    d = r.json()
    assert d["formula"] == "C6H6N2O"
    assert abs(d["mw"] - 122.13) < 0.1
    assert d["hbd"] == 1
    assert d["hba"] == 2


def test_analyze_invalid_smiles():
    r = client.post("/analyze", json={"smiles": "not-a-smiles"})
    assert r.status_code == 400
    assert "유효하지 않은" in r.json()["detail"]


def test_analyze_empty_smiles():
    r = client.post("/analyze", json={"smiles": "   "})
    assert r.status_code == 400
    assert "비어 있습니다" in r.json()["detail"]


def test_analyze_missing_field():
    r = client.post("/analyze", json={})
    assert r.status_code == 422


@pytest.mark.parametrize("name,expected_cid", [
    ("niacinamide", 936),
    ("ascorbic acid", 54670067),
    ("ferulic acid", 445858),
])
def test_pubchem_known(name, expected_cid):
    r = client.get(f"/pubchem/{name}")
    assert r.status_code == 200
    d = r.json()
    assert d.get("cid") == expected_cid, f"{name}: CID 불일치"
    assert d.get("formula"), f"{name}: formula 없음"


def test_pubchem_unknown():
    r = client.get("/pubchem/xyzzy_no_such_compound_12345")
    assert r.status_code == 404
