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


def safe_concat_dataframes(dfs):
    """Safely concatenate DataFrames, handling empty lists."""
    if not dfs:
        return pd.DataFrame(columns=KEEP_COLUMNS)
    return pd.concat(dfs, ignore_index=True)


def fetch_stream_batch(stream_ids, start_time):
    """Fetch data for a batch of streams."""
    try:
        df = get_stream_dataframe(
            stream_ids=stream_ids,
            start_time=start_time,
        )
        if df is not None and not df.empty:
            return df[KEEP_COLUMNS]
        return None
    except Exception as e:
        logger.error(f"Error fetching stream batch: {e}")
        return None


def get_api_data(
    patient_id: str,
    selected_date,
    measurement_type: str = "tremor",
    repull_all: bool = False,
) -> pd.DataFrame:
    """
    Fetch tremor or dyskinesia data for a given patient from the API, returning data only for the
    one-month window ending on the selected_date. Caching is used to avoid redundant API calls.

    Parameters:
      - patient_id (str): The patient identifier.
      - selected_date (datetime.date or datetime.datetime): The end date for the data window.
      - measurement_type (str): Type of measurement to return ('tremor' or 'dyskinesia')
      - repull_all (bool): If True, the cache is ignored and data is re-fetched.

    Returns:
      - pd.DataFrame: DataFrame containing the requested measurement data with columns:
        [time, measurement, severity, percentage, measurement_duration_ns, device_id]
    """
    # Validate measurement type
    if measurement_type not in ["tremor", "dyskinesia"]:
        raise ValueError("measurement_type must be either 'tremor' or 'dyskinesia'")

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

    # Set cache directory.
    out_dir = Path("data/api")
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_path = out_dir / f"{patient_id}.feather"

    # Define the time window: one month ending at selected_date.
    upper_bound = pd.Timestamp(selected_date).tz_localize("UTC")
    lower_bound = upper_bound - pd.Timedelta(days=30)

    # Load cached data if available.
    if cache_path.exists() and not repull_all:
        try:
            cached_df = pd.read_feather(cache_path)
            # Ensure time column is datetime
            cached_df["time"] = pd.to_datetime(cached_df["time"])
            # Now handle timezone
            if cached_df["time"].dt.tz is None:
                cached_df["time"] = cached_df["time"].dt.tz_localize("UTC")
            else:
                cached_df["time"] = cached_df["time"].dt.tz_convert("UTC")
        except Exception as e:
            logger.error(f"Error loading cache for patient {patient_id}: {e}")
            cached_df = pd.DataFrame(columns=KEEP_COLUMNS)
    else:
        cached_df = pd.DataFrame(columns=KEEP_COLUMNS)

    # Filter cached data to the desired window.
    cached_filtered = cached_df[
        (cached_df["time"] >= lower_bound) & (cached_df["time"] <= upper_bound)
    ]

    # Determine the start_time for fetching new data.
    if not repull_all and not cached_df.empty:
        fetch_start_time = max(cached_df["time"].max(), lower_bound)
    else:
        fetch_start_time = lower_bound

    # Get stream metadata using the API.
    metadata = get_patient_stream_metadata(
        patient_id=patient_id,
        algorithm=algorithm,
        device_id=device_id,
        stream_type_id=stream_type_id,
    )
    stream_ids = list(metadata.ids())
    if not stream_ids:
        logger.info(
            f"No streams found for patient {patient_id} with algorithm {algorithm}."
        )
        return cached_filtered

    # Split stream_ids into batches.
    batches = np.array_split(
        np.array(stream_ids), np.ceil(len(stream_ids) / BATCH_SIZE)
    )

    dfs = []
    with ThreadPoolExecutor() as executor:
        future_to_batch = {
            executor.submit(fetch_stream_batch, batch.tolist(), fetch_start_time): batch
            for batch in batches
        }
        for future in future_to_batch:
            try:
                df_batch = future.result()
                if df_batch is not None and not df_batch.empty:
                    # Ensure time column is datetime
                    df_batch["time"] = pd.to_datetime(df_batch["time"])
                    # Now handle timezone
                    if df_batch["time"].dt.tz is None:
                        df_batch["time"] = df_batch["time"].dt.tz_localize("UTC")
                    else:
                        df_batch["time"] = df_batch["time"].dt.tz_convert("UTC")
                    dfs.append(df_batch)
            except Exception as e:
                logger.error(f"Error fetching batch for patient {patient_id}: {e}")

    if dfs:
        new_data_df = safe_concat_dataframes(dfs)
    else:
        new_data_df = pd.DataFrame(columns=KEEP_COLUMNS)

    # Combine cached and new data (dropping duplicates).
    combined_df = pd.concat([cached_df, new_data_df], ignore_index=True)
    combined_df.drop_duplicates(inplace=True)

    # Update the cache.
    try:
        # Convert timezone-aware timestamps to naive UTC before saving
        combined_df_to_save = combined_df.copy()
        combined_df_to_save["time"] = (
            combined_df_to_save["time"].dt.tz_convert("UTC").dt.tz_localize(None)
        )
        combined_df_to_save.to_feather(cache_path)
    except Exception as e:
        logger.error(f"Error updating cache for patient {patient_id}: {e}")

    # Filter the combined data to the desired time window.
    final_df = combined_df[
        (combined_df["time"] >= lower_bound) & (combined_df["time"] <= upper_bound)
    ]

    # Filter for requested measurement type
    if not final_df.empty:
        final_df = final_df[final_df["measurement"] == measurement_type].copy()
        final_df = final_df.reset_index(drop=True)

    return final_df
