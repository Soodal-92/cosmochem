"""
CosmoChem API — Phase B 시작점 (스켈레톤)

동기 경로: 단일 분자 descriptor → 즉시 응답
비동기 경로(Phase C): docking / QSAR batch → 작업 큐
"""
from fastapi import FastAPI
from pydantic import BaseModel

# Phase B에서 활성화:
# from rdkit import Chem
# from rdkit.Chem import Descriptors, Crippen, Lipinski

app = FastAPI(title="CosmoChem API", version="0.1.0")


class MoleculeIn(BaseModel):
    smiles: str


@app.get("/health")
def health():
    return {"status": "ok"}


# ---- 동기 경로: 단일 분자 (수 밀리초, 즉시 응답) ----
@app.post("/analyze")
def analyze(mol: MoleculeIn):
    """SMILES → 정밀 descriptor. Phase B에서 RDKit으로 구현."""
    # m = Chem.MolFromSmiles(mol.smiles)
    # if m is None:
    #     raise HTTPException(400, "유효하지 않은 SMILES")
    # return {
    #     "formula": Chem.rdMolDescriptors.CalcMolFormula(m),
    #     "mw": round(Descriptors.MolWt(m), 2),
    #     "exact_mass": round(Descriptors.ExactMolWt(m), 4),
    #     "logp": round(Crippen.MolLogP(m), 2),       # 정밀 logP (추정값 대체)
    #     "tpsa": round(Descriptors.TPSA(m), 2),
    #     "hbd": Lipinski.NumHDonors(m),
    #     "hba": Lipinski.NumHAcceptors(m),
    #     "rot_bonds": Descriptors.NumRotatableBonds(m),
    # }
    raise NotImplementedError("Phase B: RDKit descriptor 계산 구현 예정")


# ---- 비동기 경로(Phase C): 작업 큐에 등록하고 job_id 반환 ----
# @app.post("/jobs/docking")
# def enqueue_docking(...):
#     job = docking_task.delay(...)   # Celery/RQ
#     return {"job_id": job.id, "status": "queued"}
#
# @app.get("/jobs/{job_id}")
# def job_status(job_id: str):
#     # 진행률 / 결과 조회 (예: 100개 중 34개)
#     ...
