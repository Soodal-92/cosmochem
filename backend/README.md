# backend — CosmoChem API (Python / FastAPI)

Phase B에서 RDKit 정밀 계산을 담당.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000/docs
```

`main.py`의 `/analyze`에 RDKit descriptor 계산을 구현하는 것이 Phase B 첫 작업.
