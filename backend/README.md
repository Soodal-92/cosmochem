# backend — CosmoChem API (Python / FastAPI)

Phase B RDKit 정밀 계산 백엔드. 현재 구현된 엔드포인트:

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /health` | 서버 상태 확인 |
| `POST /analyze` | SMILES → RDKit 정밀 descriptor (logP, TPSA, HBD/HBA, 분자량 등) |
| `GET /pubchem/{name}` | 화합물명 → SMILES + 기본 물성 (PubChem REST API 프록시) |

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000/docs
```
