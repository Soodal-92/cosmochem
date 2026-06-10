"""
CosmoChem API — Phase B
동기 경로: 단일 분자 descriptor → 즉시 응답
비동기 경로(Phase C): docking / QSAR batch → 작업 큐
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, Crippen, Lipinski, rdMolDescriptors
from urllib.parse import quote
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
import numpy as np
import os
import pyDOE3
import statsmodels.api as sm

app = FastAPI(title="CosmoChem API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MoleculeIn(BaseModel):
    smiles: str


class CompoundSaveIn(BaseModel):
    name: Optional[str] = None
    smiles: str
    result: Dict[str, Any]


class DoeExperimentSaveIn(BaseModel):
    name: Optional[str] = None
    designResult: Dict[str, Any]
    yValues: Optional[List[float]] = None
    regrResult: Optional[Dict[str, Any]] = None


class CandidateGenerateIn(BaseModel):
    smiles: str
    name: Optional[str] = None
    target: str = "brightening"


def load_local_env():
    """Load backend/.env for local development without adding a runtime dependency."""
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()


def supabase_config():
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_KEY")
    )
    if not url or not key:
        raise HTTPException(503, "Supabase 환경변수가 설정되지 않았습니다")
    return url.rstrip("/"), key


async def supabase_request(method: str, table: str, *, payload: Optional[Dict[str, Any]] = None, query: str = ""):
    url, key = supabase_config()
    endpoint = f"{url}/rest/v1/{table}{query}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if method.upper() == "POST":
        headers["Prefer"] = "return=representation"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.request(method, endpoint, headers=headers, json=payload)
    except httpx.TimeoutException:
        raise HTTPException(504, "Supabase API timeout")
    except httpx.RequestError:
        raise HTTPException(502, "Supabase API 요청 실패")

    if resp.status_code >= 400:
        detail = resp.text
        try:
            detail = resp.json().get("message") or detail
        except ValueError:
            pass
        raise HTTPException(resp.status_code, detail)

    return resp.json()


@app.get("/health")
def health():
    return {"status": "ok"}


# ---- 동기 경로: 단일 분자 (수 밀리초, 즉시 응답) ----
@app.post("/analyze")
def analyze(mol: MoleculeIn):
    """SMILES → RDKit 정밀 descriptor."""
    smiles = mol.smiles.strip()
    if not smiles:
        raise HTTPException(400, "SMILES가 비어 있습니다")
    m = Chem.MolFromSmiles(smiles)
    if m is None:
        raise HTTPException(400, "유효하지 않은 SMILES")
    return {
        "formula":     rdMolDescriptors.CalcMolFormula(m),
        "mw":          round(Descriptors.MolWt(m), 2),
        "exact_mass":  round(Descriptors.ExactMolWt(m), 4),
        "logp":        round(Crippen.MolLogP(m), 2),
        "tpsa":        round(Descriptors.TPSA(m), 2),
        "hbd":         Lipinski.NumHDonors(m),
        "hba":         Lipinski.NumHAcceptors(m),
        "rot_bonds":   int(Descriptors.NumRotatableBonds(m)),
        "heavy_atoms": m.GetNumHeavyAtoms(),
        "rings":       rdMolDescriptors.CalcNumRings(m),
    }


# ---- PubChem 프록시: 화합물명 → SMILES + 기본 정보 ----
@app.get("/pubchem/{name}")
async def pubchem_lookup(name: str):
    """PubChem에서 화합물명으로 검색하여 SMILES 및 기본 정보 반환."""
    safe_name = quote(name.strip())
    if not safe_name:
        raise HTTPException(400, "검색어가 비어 있습니다")
    url = (
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
        f"{safe_name}/property/"
        "IsomericSMILES,IUPACName,MolecularFormula,"
        "MolecularWeight,ExactMass,XLogP,TPSA,"
        "HBondDonorCount,HBondAcceptorCount,RotatableBondCount/JSON"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
    except httpx.TimeoutException:
        raise HTTPException(504, "PubChem API timeout")
    except httpx.RequestError:
        raise HTTPException(502, "PubChem API 요청 실패")
    if resp.status_code == 404:
        raise HTTPException(404, f"'{name}'을(를) PubChem에서 찾을 수 없습니다")
    if resp.status_code != 200:
        raise HTTPException(502, "PubChem API 오류")
    props = resp.json().get("PropertyTable", {}).get("Properties", [])
    if not props:
        raise HTTPException(404, f"'{name}'에 대한 결과가 없습니다")
    p = props[0]
    return {
        "cid":        p.get("CID"),
        "iupac_name": p.get("IUPACName"),
        "formula":    p.get("MolecularFormula"),
        "smiles":     p.get("IsomericSMILES"),
        "mw":         p.get("MolecularWeight"),
        "exact_mass": p.get("ExactMass"),
        "logp":       p.get("XLogP"),
        "tpsa":       p.get("TPSA"),
        "hbd":        p.get("HBondDonorCount"),
        "hba":        p.get("HBondAcceptorCount"),
        "rot_bonds":  p.get("RotatableBondCount"),
    }


# ---- DOE: 실험계획 생성 및 수율 회귀 분석 ----

class DOEFactor(BaseModel):
    name: str
    low: float
    high: float

class DOEDesignIn(BaseModel):
    factors: List[DOEFactor]
    design: str = "ccf"     # "ccf" | "bbi" | "full2"

class DOERegressionIn(BaseModel):
    factors: List[str]
    X: List[List[float]]    # 실험 조건 행렬 (각 행이 한 실험)
    y: List[float]          # 수율 측정값


@app.post("/doe/design")
def doe_design(req: DOEDesignIn):
    """실험계획 매트릭스 생성: CCD(CCF/BBI) 또는 2-level full factorial."""
    n = len(req.factors)
    if n < 2 or n > 6:
        raise HTTPException(400, "인자 수는 2~6개여야 합니다")

    if req.design == "ccf":
        coded = pyDOE3.ccdesign(n, center=(2, 2), face="ccf")
    elif req.design == "bbi":
        if n < 3:
            raise HTTPException(400, "BBI 설계는 인자 3개 이상 필요")
        coded = pyDOE3.bbdesign(n, center=2)
    elif req.design == "full2":
        coded = pyDOE3.ff2n(n)
    else:
        raise HTTPException(400, "design은 'ccf', 'bbi', 'full2' 중 하나여야 합니다")

    # 코드값(-1~+1) → 실제 수준 변환
    runs = []
    for row in coded:
        run = {}
        for i, f in enumerate(req.factors):
            mid = (f.high + f.low) / 2
            half = (f.high - f.low) / 2
            run[f.name] = round(mid + row[i] * half, 6)
        runs.append(run)

    return {
        "design": req.design,
        "n_factors": n,
        "n_runs": len(runs),
        "factor_names": [f.name for f in req.factors],
        "runs": runs,
        "coded": coded.tolist(),
    }


@app.post("/doe/regression")
def doe_regression(req: DOERegressionIn):
    """수율 데이터 → OLS 회귀 분석 (주효과 + 2차항 + 교호작용)."""
    X_raw = np.array(req.X)
    y = np.array(req.y)

    if X_raw.shape[0] != len(y):
        raise HTTPException(400, "X 행 수와 y 길이가 다릅니다")
    if X_raw.shape[1] != len(req.factors):
        raise HTTPException(400, "X 열 수와 factors 길이가 다릅니다")

    # 2차 반응표면 모델: 절편 + 주효과 + 제곱항 + 교호작용
    n_f = len(req.factors)
    cols, names = [], ["intercept"]

    for i in range(n_f):
        cols.append(X_raw[:, i])
        names.append(req.factors[i])
    for i in range(n_f):
        cols.append(X_raw[:, i] ** 2)
        names.append(f"{req.factors[i]}²")
    for i in range(n_f):
        for j in range(i + 1, n_f):
            cols.append(X_raw[:, i] * X_raw[:, j])
            names.append(f"{req.factors[i]}×{req.factors[j]}")

    X_model = sm.add_constant(np.column_stack(cols))
    if X_model.shape[0] < X_model.shape[1]:
        raise HTTPException(400, f"실험 수({X_model.shape[0]})가 파라미터 수({X_model.shape[1]})보다 적습니다. 실험을 더 추가하세요.")

    model = sm.OLS(y, X_model).fit()

    coefficients = {names[i]: round(float(model.params[i]), 6) for i in range(len(names))}
    pvalues      = {names[i]: round(float(model.pvalues[i]), 6) for i in range(len(names))}

    return {
        "r2":           round(float(model.rsquared), 4),
        "r2_adj":       round(float(model.rsquared_adj), 4),
        "f_pvalue":     round(float(model.f_pvalue), 6),
        "coefficients": coefficients,
        "pvalues":      pvalues,
        "y_pred":       [round(float(v), 4) for v in model.fittedvalues],
        "residuals":    [round(float(v), 4) for v in model.resid],
        "n_obs":        int(model.nobs),
    }


def descriptor_payload(m: Chem.Mol):
    return {
        "formula":     rdMolDescriptors.CalcMolFormula(m),
        "mw":          round(Descriptors.MolWt(m), 2),
        "exact_mass":  round(Descriptors.ExactMolWt(m), 4),
        "logp":        round(Crippen.MolLogP(m), 2),
        "tpsa":        round(Descriptors.TPSA(m), 2),
        "hbd":         Lipinski.NumHDonors(m),
        "hba":         Lipinski.NumHAcceptors(m),
        "rot_bonds":   int(Descriptors.NumRotatableBonds(m)),
        "heavy_atoms": m.GetNumHeavyAtoms(),
        "rings":       rdMolDescriptors.CalcNumRings(m),
    }


def clamp_score(v: float):
    return round(max(0, min(100, v)), 1)


SMARTS = {
    "phenol": Chem.MolFromSmarts("c[OX2H]"),
    "alcohol": Chem.MolFromSmarts("[CX4][OX2H]"),
    "carboxylic_acid": Chem.MolFromSmarts("C(=O)[OX2H1]"),
    "amide": Chem.MolFromSmarts("C(=O)N"),
    "aromatic": Chem.MolFromSmarts("a"),
    "mixed_anhydride": Chem.MolFromSmarts("C(=O)OC(C)=O"),
}


REACTIONS = {
    "o_acetyl": AllChem.ReactionFromSmarts("[O;H1:1]>>[O:1]C(=O)C"),
    "methyl_ester": AllChem.ReactionFromSmarts("[C:1](=[O:2])[O;H1:3]>>[C:1](=[O:2])OC"),
}


def feature_flags(m: Chem.Mol):
    return {
        name: bool(m.HasSubstructMatch(pattern))
        for name, pattern in SMARTS.items()
        if name != "mixed_anhydride"
    }


def try_reaction(m: Chem.Mol, reaction_name: str):
    rxn = REACTIONS[reaction_name]
    products = []
    try:
        for product_set in rxn.RunReactants((m,)):
            p = product_set[0]
            Chem.SanitizeMol(p)
            if reaction_name == "o_acetyl" and p.HasSubstructMatch(SMARTS["mixed_anhydride"]):
                continue
            smiles = Chem.MolToSmiles(p, canonical=True)
            if smiles not in products:
                products.append(smiles)
    except Exception:
        return []
    return products[:3]


def efficacy_scores(desc: Dict[str, Any], flags: Dict[str, bool], target: str):
    logp = desc["logp"]
    mw = desc["mw"]
    tpsa = desc["tpsa"]
    hbd = desc["hbd"]
    phenol_bonus = 18 if flags["phenol"] else 0
    aromatic_bonus = 10 if flags["aromatic"] else 0
    amide_bonus = 10 if flags["amide"] else 0

    base = {
        "brightening": 38 + phenol_bonus + amide_bonus + (12 if 0 <= logp <= 3 else 0) + (8 if mw < 400 else -8),
        "antioxidant": 35 + phenol_bonus * 1.5 + aromatic_bonus + (8 if hbd >= 1 else 0),
        "anti_inflammatory": 34 + aromatic_bonus + (14 if 1 <= logp <= 4 else 0) + (8 if tpsa < 90 else -8),
        "anti_wrinkle": 32 + phenol_bonus + (12 if 1 <= logp <= 4 else 0) + (8 if mw < 500 else -10),
        "moisturizing": 35 + (18 if tpsa >= 70 else 0) + (12 if hbd >= 2 else 0) + (8 if logp < 2 else -8),
    }.get(target, 40)

    skin = 52 + (18 if 0 <= logp <= 3 else -12) + (12 if mw < 500 else -18) + (8 if tpsa < 90 else -14)
    formulation = 55 + (12 if -1 <= logp <= 4 else -10) + (10 if mw < 600 else -14) + (8 if desc["rot_bonds"] <= 8 else -8)
    synthesis = 58 + (12 if flags["alcohol"] or flags["phenol"] or flags["carboxylic_acid"] else -10) + (8 if mw < 500 else -12)

    return {
        "target": clamp_score(base),
        "skin_permeation": clamp_score(skin),
        "formulation_fit": clamp_score(formulation),
        "synthetic_access": clamp_score(synthesis),
    }


def purification_plan(desc: Dict[str, Any]):
    if desc["logp"] >= 3:
        return [
            "비극성 불순물 제거를 위해 hexane/ethyl acetate 계열 컬럼 조건을 우선 검토",
            "최종 순도 확인은 reverse-phase HPLC로 보완",
        ]
    if desc["tpsa"] >= 90:
        return [
            "극성이 높으므로 reverse-phase C18 또는 prep-HPLC 우선 검토",
            "염/당류성 불순물이 예상되면 물/MeOH 구배와 동결건조를 검토",
        ]
    return [
        "ethyl acetate/MeOH 소량 첨가 조건의 silica 컬럼 또는 재결정 스크리닝",
        "분취 전 TLC/HPLC로 주성분 분리 가능성 확인",
    ]


def analysis_plan(desc: Dict[str, Any]):
    mz = round(desc["exact_mass"] + 1.0073, 4)
    return [
        f"LC-MS: [M+H]+ 예상 m/z {mz}",
        "1H/13C NMR: 도입된 acyl/ester/amide 주변 chemical shift 변화 확인",
        "HPLC/UPLC: 254 nm 및 280 nm 파장 우선, 필요 시 ELSD/CAD 보완",
        "IR: C=O, O-H/N-H, aromatic C=C 등 주요 작용기 피크 확인",
    ]


def synthesis_plan(kind: str, flags: Dict[str, bool]):
    if kind == "acetylated":
        return [
            "출발물질의 phenolic/aliphatic OH를 acetyl 보호 또는 지용성 조절기로 유도체화",
            "Ac2O 또는 acetyl chloride 계열 조건을 소량 스크리닝",
            "염기 조건, 온도, 반응 시간을 DOE 인자로 설정",
        ]
    if kind == "methyl_ester":
        return [
            "carboxylic acid를 methyl ester로 전환하여 지용성/피부 투과 가능성 비교",
            "MeOH 산 촉매 또는 coupling 조건을 소량 스크리닝",
            "가수분해 안정성과 잔류 산 촉매 제거를 확인",
        ]
    if kind == "reference":
        return [
            "입력 물질은 benchmark로 두고 유도체 후보와 물성/효능 점수를 비교",
            "합성 대상이 아니라면 공급원, 순도, 안정성, 제형 compatibility를 우선 확인",
        ]
    if flags["amide"]:
        return [
            "amide 골격은 유지하고 치환기 변경 또는 염 형성으로 용해도/투과성 조절",
            "직접 합성보다 유사체 후보를 문헌/상용 원료에서 먼저 탐색",
        ]
    return [
        "명확한 반응성 작용기가 적으므로 유사체 검색 또는 fragment 치환 전략 우선",
        "반응 template 적용 전 보호기 필요성과 선택성을 먼저 검토",
    ]


def make_candidate(label: str, smiles: str, target: str, kind: str, confidence: str):
    m = Chem.MolFromSmiles(smiles)
    if m is None:
        return None
    desc = descriptor_payload(m)
    flags = feature_flags(m)
    scores = efficacy_scores(desc, flags, target)
    return {
        "label": label,
        "smiles": Chem.MolToSmiles(m, canonical=True),
        "candidate_type": kind,
        "confidence": confidence,
        "descriptors": desc,
        "scores": scores,
        "rationale": [
            "RDKit descriptor와 작용기 규칙 기반의 1차 스크리닝 결과입니다.",
            "점수는 실험 효능이 아니라 후보 우선순위화 지표입니다.",
        ],
        "synthesis": synthesis_plan(kind, flags),
        "purification": purification_plan(desc),
        "analysis": analysis_plan(desc),
    }


@app.post("/candidates/generate")
def generate_candidates(req: CandidateGenerateIn):
    smiles = req.smiles.strip()
    m = Chem.MolFromSmiles(smiles)
    if m is None:
        raise HTTPException(400, "유효하지 않은 SMILES")

    target = req.target.strip() or "brightening"
    flags = feature_flags(m)
    base_smiles = Chem.MolToSmiles(m, canonical=True)
    candidates = []

    base = make_candidate(req.name or "입력 물질", base_smiles, target, "reference", "high")
    if base:
        candidates.append(base)

    if flags["phenol"] or flags["alcohol"]:
        for i, product in enumerate(try_reaction(m, "o_acetyl"), start=1):
            cand = make_candidate(f"O-acetyl 유도체 {i}", product, target, "acetylated", "medium")
            if cand:
                candidates.append(cand)

    if flags["carboxylic_acid"]:
        for i, product in enumerate(try_reaction(m, "methyl_ester"), start=1):
            cand = make_candidate(f"Methyl ester 유도체 {i}", product, target, "methyl_ester", "medium")
            if cand:
                candidates.append(cand)

    if len(candidates) == 1:
        candidates.append({
            **base,
            "label": "유사체 설계 방향",
            "candidate_type": "strategy",
            "confidence": "low",
            "rationale": [
                "자동 변환 가능한 OH/COOH 작용기가 적어 구조 생성 대신 유사체 설계 전략을 제안합니다.",
                "방향족 치환기, 염 형성, prodrug-like ester 도입 가능성을 문헌 기반으로 검토하세요.",
            ],
            "synthesis": synthesis_plan("strategy", flags),
        })

    return {
        "input": {
            "name": req.name,
            "smiles": base_smiles,
            "target": target,
            "features": flags,
        },
        "candidates": candidates[:8],
    }


# ---- 데이터 저장/조회: 프론트는 FastAPI만 바라보고, DB 접근은 API 계층에서 통제 ----

@app.post("/compounds")
async def save_compound(req: CompoundSaveIn):
    smiles = req.smiles.strip()
    if not smiles:
        raise HTTPException(400, "SMILES가 비어 있습니다")
    result = req.result
    row = {
        "name":        req.name or None,
        "smiles":      smiles,
        "formula":     result.get("formula"),
        "mw":          result.get("mw"),
        "exact_mass":  result.get("exact_mass"),
        "logp":        result.get("logp"),
        "tpsa":        result.get("tpsa"),
        "hbd":         result.get("hbd"),
        "hba":         result.get("hba"),
        "rot_bonds":   result.get("rot_bonds"),
        "heavy_atoms": result.get("heavy_atoms"),
        "rings":       result.get("rings"),
    }
    rows = await supabase_request("POST", "compounds", payload=row)
    return rows[0] if rows else None


@app.get("/compounds")
async def list_compounds():
    return await supabase_request("GET", "compounds", query="?select=*&order=created_at.desc&limit=50")


@app.post("/doe-experiments")
async def save_doe_experiment(req: DoeExperimentSaveIn):
    design = req.designResult
    row = {
        "name":              req.name or None,
        "design_type":       design.get("design"),
        "factors":           design.get("factor_names"),
        "runs":              design.get("runs"),
        "coded":             design.get("coded"),
        "n_runs":            design.get("n_runs"),
        "y_values":          req.yValues,
        "regression_result": req.regrResult,
    }
    rows = await supabase_request("POST", "doe_experiments", payload=row)
    return rows[0] if rows else None


@app.get("/doe-experiments")
async def list_doe_experiments():
    return await supabase_request("GET", "doe_experiments", query="?select=*&order=created_at.desc&limit=20")


# ---- 비동기 경로(Phase C): 작업 큐에 등록하고 job_id 반환 ----
# @app.post("/jobs/docking")
# def enqueue_docking(...):
#     job = docking_task.delay(...)   # Celery/RQ
#     return {"job_id": job.id, "status": "queued"}
#
# @app.get("/jobs/{job_id}")
# def job_status(job_id: str):
#     ...
