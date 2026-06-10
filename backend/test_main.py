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


def test_structure_svg_valid():
    r = client.post("/structure/svg", json={"smiles": NIACINAMIDE_SMILES})
    assert r.status_code == 200
    assert "image/svg+xml" in r.headers["content-type"]
    assert "<svg" in r.text


def test_generate_candidates_valid():
    r = client.post("/candidates/generate", json={
        "name": "ferulic acid",
        "smiles": "COc1cc(/C=C/C(=O)O)ccc1O",
        "target": "antioxidant",
    })
    assert r.status_code == 200
    d = r.json()
    assert d["input"]["target"] == "antioxidant"
    assert len(d["candidates"]) >= 2
    first = d["candidates"][0]
    # backward-compat fields
    assert "scores" in first
    assert "synthesis" in first
    assert "purification" in first
    assert "analysis" in first
    # new structured fields
    assert "purification_plan" in first
    assert "analysis_plan" in first


def test_purification_plan_structure():
    """purification_plan 구조: compound_types 리스트 + steps (method/reason 필드)."""
    r = client.post("/candidates/generate", json={
        "smiles": "COc1cc(/C=C/C(=O)O)ccc1O",  # ferulic acid: phenolic + carboxylic_acid
        "target": "antioxidant",
    })
    assert r.status_code == 200
    pp = r.json()["candidates"][0]["purification_plan"]
    assert "compound_types" in pp
    assert "steps" in pp
    types = pp["compound_types"]
    assert "phenolic" in types
    assert "carboxylic_acid" in types
    for step in pp["steps"]:
        assert "method" in step, "step에 method 필드 없음"
        assert "reason" in step, "step에 reason 필드 없음"
        assert step["method"], "method가 비어 있음"
        assert step["reason"], "reason이 비어 있음"


def test_analysis_plan_structure():
    """analysis_plan 구조: 5개 카테고리 각각 method/reason 포함."""
    r = client.post("/candidates/generate", json={
        "smiles": "O=C(N)c1cccnc1",  # niacinamide: amide + aromatic
        "target": "brightening",
    })
    assert r.status_code == 200
    ap = r.json()["candidates"][0]["analysis_plan"]
    for section in ["structure_confirmation", "purity", "residual_solvent", "stability", "efficacy_screening"]:
        assert section in ap, f"analysis_plan에 {section} 없음"
        assert len(ap[section]) > 0, f"{section} 항목이 비어 있음"
        for item in ap[section]:
            assert "method" in item
            assert "reason" in item


def test_compound_type_ester():
    """메틸 에스터 유도체는 ester 타입으로 분류."""
    r = client.post("/candidates/generate", json={
        "smiles": "COC(=O)/C=C/c1ccc(O)cc1OC",  # methyl ferulate
        "target": "antioxidant",
    })
    assert r.status_code == 200
    first = r.json()["candidates"][0]
    types = first["purification_plan"]["compound_types"]
    assert "ester" in types


def test_generate_candidates_invalid_smiles():
    r = client.post("/candidates/generate", json={"smiles": "not-a-smiles"})
    assert r.status_code == 400


@pytest.mark.parametrize("name,expected_cid", [
    ("niacinamide", 936),
    ("ascorbic acid", 54670067),
    ("ferulic acid", 445858),
    ("Phenol", 996),
    ("108-95-2", 996),
])
def test_pubchem_known(name, expected_cid):
    r = client.get(f"/pubchem/{name}")
    assert r.status_code == 200
    d = r.json()
    assert d.get("cid") == expected_cid, f"{name}: CID 불일치"
    assert d.get("smiles"), f"{name}: smiles 없음"
    assert d.get("formula"), f"{name}: formula 없음"


def test_pubchem_unknown():
    r = client.get("/pubchem/xyzzy_no_such_compound_12345")
    assert r.status_code == 404
