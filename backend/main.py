"""
CosmoChem API — Phase B
동기 경로: 단일 분자 descriptor → 즉시 응답
비동기 경로(Phase C): docking / QSAR batch → 작업 큐
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rdkit import Chem
from rdkit.Chem import Descriptors, Crippen, Lipinski, rdMolDescriptors
from urllib.parse import quote
from typing import List, Optional
import httpx
import numpy as np
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


# ---- 비동기 경로(Phase C): 작업 큐에 등록하고 job_id 반환 ----
# @app.post("/jobs/docking")
# def enqueue_docking(...):
#     job = docking_task.delay(...)   # Celery/RQ
#     return {"job_id": job.id, "status": "queued"}
#
# @app.get("/jobs/{job_id}")
# def job_status(job_id: str):
#     ...
