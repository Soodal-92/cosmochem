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
import httpx

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
    m = Chem.MolFromSmiles(mol.smiles)
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
    url = (
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
        f"{name}/property/"
        "IsomericSMILES,IUPACName,MolecularFormula,"
        "MolecularWeight,ExactMass,XLogP,TPSA,"
        "HBondDonorCount,HBondAcceptorCount,RotatableBondCount/JSON"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
    if resp.status_code == 404:
        raise HTTPException(404, f"'{name}'을(를) PubChem에서 찾을 수 없습니다")
    if resp.status_code != 200:
        raise HTTPException(502, "PubChem API 오류")
    props = resp.json()["PropertyTable"]["Properties"][0]
    return {
        "cid":        props.get("CID"),
        "iupac_name": props.get("IUPACName"),
        "formula":    props.get("MolecularFormula"),
        "smiles":     props.get("IsomericSMILES"),
        "mw":         props.get("MolecularWeight"),
        "exact_mass": props.get("ExactMass"),
        "logp":       props.get("XLogP"),
        "tpsa":       props.get("TPSA"),
        "hbd":        props.get("HBondDonorCount"),
        "hba":        props.get("HBondAcceptorCount"),
        "rot_bonds":  props.get("RotatableBondCount"),
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
