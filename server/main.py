from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import logging
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv

from runeq import initialize
from api_data_utils import get_api_data

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Rune Labs Data API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your Next.js app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PatientDataRequest(BaseModel):
    patient_id: str
    selected_date: str
    measurement_type: str
    repull_all: Optional[bool] = False


class ErrorResponse(BaseModel):
    detail: str


@app.on_event("startup")
async def startup_event():
    """Initialize Rune Labs SDK on startup"""
    try:
        initialize()
        logger.info("Rune Labs SDK initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Rune Labs SDK: {str(e)}")
        raise


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/patient-data", response_model=Dict[str, List[Dict[str, Any]]])
async def get_patient_data_endpoint(request: PatientDataRequest):
    """
    Fetch patient measurement data from Rune Labs API
    """
    try:
        logger.info(f"Fetching data for patient {request.patient_id}")

        # Convert date string to datetime
        selected_date = datetime.fromisoformat(
            request.selected_date.replace("Z", "+00:00")
        )

        # Get data using the existing function
        data = get_api_data(
            patient_id=request.patient_id,
            selected_date=selected_date,
            measurement_type=request.measurement_type,
            repull_all=request.repull_all,
        )

        # Convert DataFrame to dict
        result = {"data": data.to_dict(orient="records")}
        logger.info(f"Successfully fetched {len(result['data'])} records")

        return result

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching patient data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
