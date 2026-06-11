"""
CosmoChem API — Phase B
동기 경로: 단일 분자 descriptor → 즉시 응답
비동기 경로(Phase C): docking / QSAR batch → 작업 큐
"""
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, Crippen, Lipinski, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D
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


class CandidateSaveIn(BaseModel):
    input_smiles: str
    input_name: Optional[str] = None
    target: str
    label: str
    smiles: str
    candidate_type: str
    confidence: str
    descriptors: Dict[str, Any]
    scores: Dict[str, Any]
    compound_types: List[str] = []
    synthesis: List[str] = []
    purification_plan: Optional[Dict[str, Any]] = None
    analysis_plan: Optional[Dict[str, Any]] = None
    rationale: List[str] = []


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


PUBCHEM_PROPERTIES = (
    "CanonicalSMILES,IsomericSMILES,IUPACName,MolecularFormula,"
    "MolecularWeight,ExactMass,XLogP,TPSA,"
    "HBondDonorCount,HBondAcceptorCount,RotatableBondCount"
)


def pubchem_smiles(props: Dict[str, Any]):
    smiles = (
        props.get("IsomericSMILES")
        or props.get("CanonicalSMILES")
        or props.get("SMILES")
        or props.get("ConnectivitySMILES")
    )
    if not smiles:
        return None
    mol = Chem.MolFromSmiles(smiles)
    return Chem.MolToSmiles(mol, canonical=True) if mol is not None else smiles


# ---- PubChem 프록시: 화합물명/CAS No./CID → SMILES + 기본 정보 ----
@app.get("/pubchem/{query}")
async def pubchem_lookup(query: str):
    """PubChem에서 화합물명, CAS No., CID로 검색하여 SMILES 및 기본 정보 반환."""
    term = query.strip()
    safe_query = quote(term)
    if not safe_query:
        raise HTTPException(400, "검색어가 비어 있습니다")
    namespace = "cid" if term.isdigit() else "name"
    url = (
        f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/{namespace}/"
        f"{safe_query}/property/{PUBCHEM_PROPERTIES}/JSON"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
    except httpx.TimeoutException:
        raise HTTPException(504, "PubChem API timeout")
    except httpx.RequestError:
        raise HTTPException(502, "PubChem API 요청 실패")
    if resp.status_code == 404:
        raise HTTPException(404, f"'{query}'을(를) PubChem에서 찾을 수 없습니다")
    if resp.status_code != 200:
        raise HTTPException(502, "PubChem API 오류")
    props = resp.json().get("PropertyTable", {}).get("Properties", [])
    if not props:
        raise HTTPException(404, f"'{query}'에 대한 결과가 없습니다")
    p = props[0]
    smiles = pubchem_smiles(p)
    return {
        "cid":        p.get("CID"),
        "iupac_name": p.get("IUPACName"),
        "formula":    p.get("MolecularFormula"),
        "smiles":     smiles,
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


@app.post("/structure/svg")
def structure_svg(mol: MoleculeIn):
    """SMILES -> RDKit 2D SVG depiction."""
    smiles = mol.smiles.strip()
    if not smiles:
        raise HTTPException(400, "SMILES가 비어 있습니다")
    m = Chem.MolFromSmiles(smiles)
    if m is None:
        raise HTTPException(400, "유효하지 않은 SMILES")

    rdMolDescriptors.CalcMolFormula(m)
    AllChem.Compute2DCoords(m)
    drawer = rdMolDraw2D.MolDraw2DSVG(520, 260)
    opts = drawer.drawOptions()
    opts.clearBackground = False
    opts.bondLineWidth = 1.4
    drawer.DrawMolecule(m)
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()
    return Response(content=svg, media_type="image/svg+xml")


def clamp_score(v: float):
    return round(max(0, min(100, v)), 1)


SMARTS = {
    "phenol":          Chem.MolFromSmarts("c[OX2H]"),
    "alcohol":         Chem.MolFromSmarts("[CX4][OX2H]"),
    "carboxylic_acid": Chem.MolFromSmarts("C(=O)[OX2H1]"),
    "ester":           Chem.MolFromSmarts("[CX3](=[OX1])[OX2;H0][C,c]"),
    "amide":           Chem.MolFromSmarts("C(=O)N"),
    "aromatic":        Chem.MolFromSmarts("a"),
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


def purification_plan(desc: Dict[str, Any]) -> List[str]:
    """Flat list kept for backward compatibility."""
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


def analysis_plan(desc: Dict[str, Any]) -> List[str]:
    """Flat list kept for backward compatibility."""
    mz = round(desc["exact_mass"] + 1.0073, 4)
    return [
        f"LC-MS: [M+H]+ 예상 m/z {mz}",
        "1H/13C NMR: 도입된 acyl/ester/amide 주변 chemical shift 변화 확인",
        "HPLC/UPLC: 254 nm 및 280 nm 파장 우선, 필요 시 ELSD/CAD 보완",
        "IR: C=O, O-H/N-H, aromatic C=C 등 주요 작용기 피크 확인",
    ]


# ---- 고도화된 정제/분석 추천 (structured, with reason) ----

def classify_compound(flags: Dict[str, bool], desc: Dict[str, Any]) -> List[str]:
    """RDKit descriptor + SMARTS 작용기 정보로 물질 유형 분류."""
    types: List[str] = []
    if flags["phenol"]:
        types.append("phenolic")
    if flags["carboxylic_acid"]:
        types.append("carboxylic_acid")
    if flags.get("ester"):
        types.append("ester")
    if flags["amide"]:
        types.append("amide")
    if desc["logp"] >= 3.5:
        types.append("high_logP")
    if desc["tpsa"] >= 90:
        types.append("high_TPSA")
    if not types:
        if desc["heavy_atoms"] < 6 and desc["rings"] == 0:
            types.append("inorganic_placeholder")
        else:
            types.append("general")
    return types


def purification_plan_structured(flags: Dict[str, bool], desc: Dict[str, Any]) -> Dict[str, Any]:
    """물질 유형별 세분화된 정제 추천 (method + reason)."""
    types = classify_compound(flags, desc)
    steps: List[Dict[str, str]] = []

    if "phenolic" in types:
        steps.append({
            "method": "Silica gel column (EtOAc/hexane 구배, Rf 0.3–0.5 목표)",
            "reason": "phenolic OH 극성 차이를 활용해 비극성 불순물과 분리 — Rf 낮으면 MeOH 소량 첨가",
        })
        steps.append({
            "method": "EtOAc/hexane 또는 EtOH/water 재결정 스크리닝",
            "reason": "phenol류는 결정성이 있는 경우 재결정이 컬럼 대비 수율·순도 면에서 유리",
        })

    if "carboxylic_acid" in types:
        steps.append({
            "method": "RP-HPLC (C18, 0.1% formic acid/MeCN 구배)",
            "reason": "COOH 이온화 억제를 위해 산성 이동상 필수 — pH 미조절 시 피크 테일링 발생",
        })
        steps.append({
            "method": "산-염기 추출 (pH 2 이하 중성화 → EtOAc 파티셔닝)",
            "reason": "비산성 불순물을 EtOAc 층으로 제거하고 수층에서 목표 산을 회수",
        })

    if "ester" in types:
        steps.append({
            "method": "Silica gel column (EtOAc/hexane 저극성 구배)",
            "reason": "에스터는 중간 극성 — 비극성 계열 컬럼으로 충분히 분리 가능",
        })
        steps.append({
            "method": "정제 후 가수분해 안정성 확인 (pH 4·7·9, 40°C 24 h)",
            "reason": "에스터 결합은 수분·pH에 민감 — 정제 중·보관 시 분해 모니터링 필수",
        })

    if "amide" in types:
        steps.append({
            "method": "RP-HPLC (C18 또는 C8) 또는 MeOH/water prep-HPLC",
            "reason": "amide는 실리카 강흡착 우려 — 역상계가 재현성 높고 안전",
        })
        steps.append({
            "method": "DMF/water 또는 EtOH/water 재결정 시도",
            "reason": "amide 화합물은 수소결합 특성으로 극성 혼합용매에서 결정화 잘 됨",
        })

    if "high_logP" in types:
        steps.append({
            "method": f"Hexane/EtOAc 고비율 normal-phase column (logP {desc['logp']:.1f})",
            "reason": "고지용성 — 지질성 불순물 분리에 비극성 이동상 필요, 용해 시 DCM/CHCl3 권장",
        })
        steps.append({
            "method": "최종 순도 확인: analytical RP-HPLC (MeCN/water 고비율)",
            "reason": "고지용성은 역상에서 긴 체류시간·날카로운 피크 → 순도 정량에 유리",
        })

    if "high_TPSA" in types:
        steps.append({
            "method": f"RP prep-HPLC (C18, 낮은 유기용매 비율 시작, TPSA {desc['tpsa']:.0f} Å²)",
            "reason": "극성 면적이 커서 역상 강보유 예상 — 구배 최적화 필수, 등용매 이동상 사용 금지",
        })
        steps.append({
            "method": "동결건조 (lyophilization) 로 건조·보관",
            "reason": "고극성 화합물은 가열 농축 시 분해 가능 — 동결건조가 안전한 건조법",
        })

    if "inorganic_placeholder" in types:
        steps.append({
            "method": "물 또는 MeOH/water 계열 재결정",
            "reason": "무기/미네랄류 성분은 수계 재결정이 기본 정제법 — 유기 용매 반응성 사전 확인",
        })

    if not steps:
        steps.append({
            "method": "TLC 스크리닝 후 silica column 또는 prep-HPLC 조건 결정",
            "reason": "뚜렷한 반응 작용기가 없어 경험적 TLC 탐색 후 규모 확대 권장",
        })

    steps.append({
        "method": "Analytical RP-HPLC (254 nm / ELSD) 로 최종 순도 수치화",
        "reason": "분취 후 반드시 분석용 HPLC로 순도 정량 — 화장품 원료 기준 98% 이상 목표",
    })

    return {"compound_types": types, "steps": steps}


def analysis_plan_structured(flags: Dict[str, bool], desc: Dict[str, Any]) -> Dict[str, Any]:
    """목적별 분석 추천 (structure_confirmation / purity / residual_solvent / stability / efficacy_screening)."""
    mz_pos = round(desc["exact_mass"] + 1.0073, 4)
    mz_neg = round(desc["exact_mass"] - 1.0073, 4)
    types = classify_compound(flags, desc)

    # 1. 구조 확인
    ionization = (
        f"ESI+ [M+H]⁺ {mz_pos} / ESI− [M−H]⁻ {mz_neg}"
        if ("carboxylic_acid" in types or "phenolic" in types)
        else f"ESI+ [M+H]⁺ {mz_pos}"
    )
    structure_confirmation = [
        {
            "method": f"LC-MS ({ionization})",
            "reason": "분자량으로 구조 가설 검증 — 이온화 모드는 작용기에 따라 선택",
        },
        {
            "method": f"HR-MS: exact mass {desc['exact_mass']} Da 확인",
            "reason": "측정값과 이론값 5 ppm 이내 일치 시 분자식 확정",
        },
    ]
    if flags["aromatic"] or flags["phenol"]:
        structure_confirmation.append({
            "method": "1H NMR (CDCl3 또는 DMSO-d6): 방향족 영역 6–9 ppm",
            "reason": "방향족 proton coupling pattern(J값)으로 치환 위치·개수 확인",
        })
    else:
        structure_confirmation.append({
            "method": "1H NMR: 지방족 영역 (0–5 ppm) 중심",
            "reason": "방향족 proton 없으므로 CH/CH2/CH3 pattern으로 골격 확인",
        })
    structure_confirmation.append({
        "method": "13C NMR (DEPT-135 포함)",
        "reason": "탄소 종류(CH·CH2·CH3·C) 구분으로 골격 확정 — HSQC/HMBC로 후속 상관",
    })
    if flags["amide"]:
        structure_confirmation.append({
            "method": "IR: amide C=O (~1650 cm⁻¹), N-H 굽힘 (~1550 cm⁻¹)",
            "reason": "amide carbonyl은 ester(~1735)·acid(~1710)와 위치 달라 도입 여부 1차 확인",
        })
    if flags.get("ester"):
        structure_confirmation.append({
            "method": "IR: ester C=O (~1735 cm⁻¹), C-O 신축 (1000–1300 cm⁻¹)",
            "reason": "에스터 특성 흡수대로 amide·acid와 구별 — 가수분해 후 피크 소실로 검증 가능",
        })

    # 2. 순도
    if flags["aromatic"] or flags["phenol"]:
        purity = [
            {
                "method": "RP-HPLC (C18, 254 nm + 280 nm UV, 0.1% formic acid/MeCN)",
                "reason": "방향족 chromophore — dual wavelength로 불순물 프로파일 강화, 감도 우수",
            },
        ]
    else:
        purity = [
            {
                "method": "RP-HPLC (C18, ELSD 또는 CAD 검출기)",
                "reason": "UV chromophore 약할 경우 ELSD/CAD로 발색단 없는 화합물도 범용 검출",
            },
        ]
    purity.append({
        "method": "qNMR: 내부표준 (말레산 또는 다이메틸술폰) 사용",
        "reason": "표준품 없이 절대 순도 측정 가능 — HPLC와 상호 검증으로 신뢰도 향상",
    })

    # 3. 잔류 용매
    residual_solvent = [
        {
            "method": "1H NMR 잔류 용매 피크 스크리닝 (EtOAc 1.99 ppm, hexane 0.88 ppm, DCM 5.30 ppm)",
            "reason": "정제 직후 잔류 유기용매를 NMR로 빠르게 1차 확인 — 건조 불충분 시 쉽게 판별",
        },
        {
            "method": "GC headspace analysis (ICH Q3C Class 2/3 기준)",
            "reason": "ICH 가이드라인 준수를 위한 잔류 용매 정량 — 화장품 원료 규격 요건 충족",
        },
    ]

    # 4. 안정성
    stability: List[Dict[str, str]] = []
    if "phenolic" in types:
        stability.append({
            "method": "가속 안정성 (40°C/75% RH, 2주) + 광안정성 (ICH Q1B, D65 200 W·h/m²)",
            "reason": "phenol류는 산화·광분해 취약 — quinone계 분해물 생성 및 변색 여부 확인",
        })
    if "ester" in types:
        stability.append({
            "method": "pH-stability profile (pH 4·7·9 완충액, 60°C 24 h → HPLC 분석)",
            "reason": "에스터 결합은 산·염기 가수분해에 민감 — 제형 pH 범위(4–7)에서 안정성 필수 확인",
        })
    if "high_logP" in types:
        stability.append({
            "method": "산화 안정성 (0.3% H2O2 또는 AIBN, 25°C 24 h)",
            "reason": f"logP {desc['logp']:.1f} — 지질성 화합물 자동산화 취약 가능성, LC-MS 분해물 프로파일링",
        })
    if "amide" in types:
        stability.append({
            "method": "강산·강염기 가수분해 (1 N HCl / 1 N NaOH, 60°C 6 h)",
            "reason": "amide 결합은 극단적 pH에서 COOH/amine으로 가수분해 — 내성 범위 파악",
        })
    if not stability:
        stability.append({
            "method": "가속 안정성 기본 프로토콜 (40°C/75% RH, 4주)",
            "reason": "화장품 원료 ICH 기반 기본 스크리닝 — 외관·HPLC 순도 주기적 모니터링",
        })
    stability.append({
        "method": "분해물 LC-MS 프로파일링 (시험 전·후 비교)",
        "reason": "분해 경로 확인 및 주요 분해물 구조 파악 — 이후 배합 조건·포장재 선정에 활용",
    })

    # 5. 효능 스크리닝
    efficacy_screening: List[Dict[str, str]] = []
    if "phenolic" in types or flags["aromatic"]:
        efficacy_screening.append({
            "method": "DPPH radical 소거능 (IC50, MeOH, 517 nm)",
            "reason": "phenolic 화합물의 라디칼 공여 능력 — 항산화 지표 1차 스크리닝으로 가장 신속",
        })
        efficacy_screening.append({
            "method": "ABTS radical 소거능 (Trolox 대비 TEAC 값)",
            "reason": "DPPH 보완 — 수용성 환경 항산화 측정, 화장품 수상 배합 조건과 유사",
        })
    if desc["tpsa"] < 90 and desc["mw"] < 500:
        efficacy_screening.append({
            "method": "PAMPA (Parallel Artificial Membrane Permeability Assay): Peff 측정",
            "reason": f"TPSA {desc['tpsa']:.0f} Å², MW {desc['mw']:.0f} — 피부 투과 가능성 in vitro 1차 평가",
        })
    efficacy_screening.append({
        "method": "세포 안전성 (MTT assay, HaCaT keratinocyte, 24 h)",
        "reason": "화장품 원료 필수 안전성 확인 — IC50 > 100 μM 기준, 피부 자극 평가로 연결",
    })

    return {
        "structure_confirmation": structure_confirmation,
        "purity": purity,
        "residual_solvent": residual_solvent,
        "stability": stability,
        "efficacy_screening": efficacy_screening,
    }


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
        "purification_plan": purification_plan_structured(flags, desc),
        "analysis_plan": analysis_plan_structured(flags, desc),
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


@app.post("/candidates")
async def save_candidate(req: CandidateSaveIn):
    row = {
        "input_smiles":    req.input_smiles.strip(),
        "input_name":      req.input_name or None,
        "target":          req.target,
        "label":           req.label,
        "smiles":          req.smiles.strip(),
        "candidate_type":  req.candidate_type,
        "confidence":      req.confidence,
        "descriptors":     req.descriptors,
        "scores":          req.scores,
        "compound_types":  req.compound_types,
        "synthesis":       req.synthesis,
        "purification_plan": req.purification_plan,
        "analysis_plan":   req.analysis_plan,
        "rationale":       req.rationale,
    }
    rows = await supabase_request("POST", "candidates", payload=row)
    return rows[0] if rows else None


@app.get("/candidates")
async def list_candidates():
    return await supabase_request("GET", "candidates", query="?select=*&order=created_at.desc&limit=30")


# ---- 비동기 경로(Phase C): 작업 큐에 등록하고 job_id 반환 ----
# @app.post("/jobs/docking")
# def enqueue_docking(...):
#     job = docking_task.delay(...)   # Celery/RQ
#     return {"job_id": job.id, "status": "queued"}
#
# @app.get("/jobs/{job_id}")
# def job_status(job_id: str):
#     ...
