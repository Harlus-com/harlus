import os

from openbb import obb

import pandas as pd
import polars as pl

from pathlib import Path

from config import config


DATA_DIR = Path(__file__).resolve().parent.parent.joinpath("data")


class OpenBBFilingsLoader():
    """
    # ObbFilingsLoader

    Loads polars dataframe with filings from openbb.

    Implements caching.
    """

    def __init__(self):
        self.config = config
        obb.account.login(pat=os.getenv("OPENBB_PAT"))
        obb.user.credentials.fmp_api_key = os.getenv("FMP_API_KEY")


    def _fetch(self,ticker):

        out = obb.equity.fundamental.filings(ticker, provider="fmp", limit=1000).to_polars()

        out = out.with_columns(
        (pl.col("filing_date").dt.strftime("%Y%m%d") + 
        "_Q" + ((pl.col("filing_date").dt.month() - 1) // 3 + 1).cast(pl.String) +
        "_" + pl.col("filing_date").dt.year().cast(pl.String) + 
        "_" + pl.col("symbol") +
        "_" + pl.col("report_type").str.replace_all(" ", "_").str.replace_all("/", "_")
        ).alias("filename_stem")
        )

        out = out.filter(pl.col("report_type").str.contains("|".join(self.config["sec_relevant_filings"])))

        return out 
    

    def _get_folder(self, ticker):
        out = f"{DATA_DIR.joinpath(ticker, self.config['fetch_cache_in_workspace'])}"
        return out
    

    def _get_fetch_datetime_from_df_filename(self, filename):
        out = pd.to_datetime(filename.split("_")[0], format="%Y%m%d%H%M")
        return out
    

    def _get_df_filename(self, ticker):
        out = f"{pd.Timestamp.now().strftime('%Y%m%d%H%M')}_{ticker}_sec_filings"
        return out


    def get(self, ticker):

        # check if file exists and is up to date
        folder = self._get_folder(ticker)
        Path(folder).mkdir(parents=True, exist_ok=True)
        parquet_files = [f for f in os.listdir(folder) if f.endswith('.parquet')]
        latest_datetime = pd.Timestamp.min
        if len(parquet_files) > 0:
            latest_datetime = max([self._get_fetch_datetime_from_df_filename(f) for f in parquet_files])
            
        # file is out of date
        if latest_datetime < pd.Timestamp.now() - pd.Timedelta(minutes=self.config["obb_refetch_interval"]):
            df = self._fetch(ticker)
            filename = self._get_df_filename(ticker)
            df.write_parquet(f"{folder}/{filename}.parquet")
            # todo: delete old files
            return df
        
        # file is up to date
        else:
            latest_file = [f for f in parquet_files if self._get_fetch_datetime_from_df_filename(f) == latest_datetime][0]
            df = pl.read_parquet(f"{folder}/{latest_file}")
            return df