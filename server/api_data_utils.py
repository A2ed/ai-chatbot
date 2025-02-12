import json
import pandas as pd
import numpy as np
import yaml
from pathlib import Path
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import logging

from runeq import initialize
from runeq.resources.stream_metadata import (
    get_patient_stream_metadata,
    get_stream_dataframe,
)

logger = logging.getLogger("api_data_utils")
logger.setLevel(logging.INFO)

# Constants
KEEP_COLUMNS = [
    "time",
    "measurement",
    "severity",
    "percentage",
    "measurement_duration_ns",
    "device_id",
]
BATCH_SIZE = 10
TMP_DIR = Path("data/api")  # Define the temporary directory path


def safe_concat_dataframes(dfs):
    """Safely concatenate DataFrames, handling empty lists."""
    if not dfs:
        return pd.DataFrame(columns=KEEP_COLUMNS)
    return pd.concat(dfs, ignore_index=True)


def fetch_stream_batch(
    stream_ids, start_time, measurement_type="tremor", severity="all"
):
    """
    Fetch data for a batch of streams and resample to hourly averages.

    Args:
        stream_ids: List of stream IDs to fetch
        start_time: Start time for the data window
        measurement_type: Type of measurement (not used for filtering as handled in metadata)
        severity: Severity level (not used for filtering as handled in metadata)
    """
    try:
        df = get_stream_dataframe(
            stream_ids=stream_ids,
            start_time=start_time,
        )

        if df is not None and not df.empty:
            logger.info(f"Initial data shape: {df.shape}")

            # Convert time to datetime if it isn't already
            df["time"] = pd.to_datetime(df["time"])

            # Keep all required columns
            df = df[["time", "percentage"]]

            # Resample to hourly averages
            df = (
                df.set_index("time")
                .resample("1h")
                .agg(
                    {
                        "percentage": "mean",
                    }
                )
                .reset_index()
            )

            return df
        return None
    except Exception as e:
        logger.error(f"Error fetching stream batch: {e}")
        return None


def get_api_data(
    patient_id: str,
    selected_date,
    measurement_type: str = "tremor",
    repull_all: bool = False,
    severity: str = "all",
) -> pd.DataFrame:
    """
    Fetch tremor or dyskinesia data for a given patient from the API, returning data only for the
    one-month window ending on the selected_date. Caching is used to avoid redundant API calls.

    Parameters:
      - patient_id (str): The patient identifier.
      - selected_date (datetime.date or datetime.datetime): The end date for the data window.
      - measurement_type (str): Type of measurement (used in metadata filtering)
      - repull_all (bool): If True, the cache is ignored and data is re-fetched.
      - severity (str): Severity level (used in metadata filtering)

    Returns:
      - pd.DataFrame: DataFrame containing the requested measurement data with columns:
        [time, percentage]
    """
    # Load API configuration.
    config_path = Path("data_config.yaml")
    if not config_path.exists():
        logger.warning(
            "Configuration file data_config.yaml not found, using default values."
        )
        config = {
            "api": {
                "algorithm": "ingest-strive-applewatch-md.0",
                "device_id": "all",
                "stream_type_id": "percentage",
            }
        }
    else:
        with config_path.open("r") as f:
            config = yaml.safe_load(f)

    api_config = config.get("api", {})
    algorithm = api_config.get("algorithm", "ingest-strive-applewatch-md.0")
    device_id = api_config.get("device_id", "all")
    stream_type_id = api_config.get("stream_type_id", "percentage")

    # Get stream metadata using the API, filtering is handled at metadata level
    metadata = get_patient_stream_metadata(
        patient_id=patient_id,
        algorithm=algorithm,
        device_id=device_id,
        stream_type_id=stream_type_id,
        measurement=measurement_type,
        severity=severity,
    )
    stream_ids = list(metadata.ids())
    if not stream_ids:
        logger.info(
            f"No streams found for patient {patient_id} with measurement type {measurement_type}."
        )
        return pd.DataFrame(columns=["time", "percentage"])

    # Define the time window: one month ending at selected_date.
    upper_bound = pd.Timestamp(selected_date).tz_localize("UTC")
    lower_bound = upper_bound - pd.Timedelta(days=30)

    # Split stream_ids into batches.
    batches = np.array_split(
        np.array(stream_ids), np.ceil(len(stream_ids) / BATCH_SIZE)
    )

    dfs = []
    with ThreadPoolExecutor() as executor:
        future_to_batch = {
            executor.submit(
                fetch_stream_batch,
                batch.tolist(),
                lower_bound,  # Use lower_bound as start_time
                measurement_type,
                severity,
            ): batch
            for batch in batches
        }
        for future in future_to_batch:
            try:
                df_batch = future.result()
                if df_batch is not None and not df_batch.empty:
                    dfs.append(df_batch)
            except Exception as e:
                logger.error(f"Error fetching batch for patient {patient_id}: {e}")

    if not dfs:
        return pd.DataFrame(columns=["time", "percentage"])

    # Combine all dataframes
    final_df = safe_concat_dataframes(dfs)

    # Ensure correct column order
    final_df = final_df[["time", "percentage"]]

    # Drop rows where percentage is NaN
    final_df = final_df[final_df["percentage"].notna()]

    # Save DataFrame as feather file
    if not final_df.empty:
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = (
            TMP_DIR
            / f"tmp_data_{measurement_type}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.feather"
        )
        final_df.to_feather(tmp_path)
        logger.info(f"Saved temporary data to: {tmp_path}")

    return final_df
