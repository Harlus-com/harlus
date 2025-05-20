"""Utilities for fetching SEC filings and web content.

This module consolidates the original helpers from
``ml/tools/file_loaders/src/harlus_file_loaders`` into a single
location for use by the server code.
"""

from __future__ import annotations

import base64
import logging
import os
from pathlib import Path
from time import sleep

import pandas as pd
import polars as pl
import requests
from openbb import obb
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

config: dict[str, object] = {}

config["workspace_path"] = "workspace/wood"
config["agent_cache_in_workspace"] = ".cache/agents"
config["fetch_cache_in_workspace"] = ".cache/fetches"

config["dir_internal_reports"] = "internal"
config["dir_earnings_call"] = "earnings_call"
config["dir_sec_filings"] = "sec"

config["webdriver_throttle"] = 8  # nb pulls per second
config["webdriver_timeout"] = 10  # nb of seconds
config["obb_refetch_interval"] = 5  # minutes before refetching the same ticker

config["sec_relevant_filings"] = {"10-Q", "10-K", "8-K", "6-K"}

# PDF page settings used when creating PDFs via selenium
config["pdf_page_settings"] = {
    "landscape": False,
    "printBackground": True,
    "paperWidth": 8.5,
    "paperHeight": 11,
    "marginTop": 0.4,
    "marginBottom": 0.4,
    "marginLeft": 0.4,
    "marginRight": 0.4,
}


DATA_DIR = Path(__file__).resolve().parent.parent.joinpath("data")


# ---------------------------------------------------------------------------
# Web loading helpers
# ---------------------------------------------------------------------------


class WebLoader:
    """Base class for simple web loaders."""

    def __init__(self) -> None:
        pass

    def _fetch(self, url: str):
        raise NotImplementedError

    def get(self, url: str):
        raise NotImplementedError


class SeleniumWebLoader(WebLoader):
    """Retrieve web content using Selenium."""

    def __init__(self) -> None:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument(
            '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
        )
        driver = webdriver.Chrome(options=chrome_options)
        self.config = config
        self.driver = driver
        super().__init__()

    def load(self, url: str) -> None:
        try:
            logging.info(f"SeleniumWebLoader: Loading {url}")
            self.driver.get(url)
            WebDriverWait(self.driver, self.config["webdriver_timeout"]).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            sleep(1 / self.config["webdriver_throttle"])
            logging.info(f"SeleniumWebLoader: Successfully loaded {url}")
        except Exception as e:  # pragma: no cover - thin wrapper
            logging.error(f"SeleniumWebLoader: Error accessing {url}: {str(e)}")

    def get_source(self) -> str:
        logging.info("SeleniumWebLoader: Getting source")
        out = self.driver.page_source
        logging.info("SeleniumWebLoader: Successfully got source")
        return out

    def get_pdf(self) -> bytes:
        logging.info("SeleniumWebLoader: Getting pdf")
        tmp = self.driver.execute_cdp_cmd("Page.printToPDF", config["pdf_page_settings"])
        out = base64.b64decode(tmp["data"])
        logging.info("SeleniumWebLoader: Successfully got pdf")
        return out

    def __del__(self) -> None:
        logging.info("SeleniumWebLoader: Quitting driver")
        self.driver.quit()


class RequestWebLoader(WebLoader):
    """Simple requests based loader."""

    def __init__(self) -> None:
        pass

    def fetch(self, url: str) -> bytes:
        logging.info(f"RequestWebLoader: Fetching {url}")
        out = requests.get(url).content
        logging.info(f"RequestWebLoader: Successfully fetched {url}")
        return out


# ---------------------------------------------------------------------------
# OpenBB filings loader
# ---------------------------------------------------------------------------


class OpenBBFilingsLoader:
    """Load filings from OpenBB with basic caching."""

    def __init__(self) -> None:
        self.config = config
        obb.account.login(pat=os.getenv("OPENBB_PAT"))
        obb.user.credentials.fmp_api_key = os.getenv("FMP_API_KEY")

    def _fetch(self, ticker: str) -> pl.DataFrame:
        out = obb.equity.fundamental.filings(ticker, provider="fmp", limit=1000).to_polars()
        out = out.with_columns(
            (
                pl.col("filing_date").dt.strftime("%Y%m%d")
                + "_Q"
                + ((pl.col("filing_date").dt.month() - 1) // 3 + 1).cast(pl.String)
                + "_"
                + pl.col("filing_date").dt.year().cast(pl.String)
                + "_"
                + pl.col("symbol")
                + "_"
                + pl.col("report_type").str.replace_all(" ", "_").str.replace_all("/", "_")
            ).alias("filename_stem")
        )
        out = out.filter(pl.col("report_type").str.contains("|".join(self.config["sec_relevant_filings"])))
        return out

    def _get_folder(self, ticker: str) -> str:
        return f"{DATA_DIR.joinpath(ticker, self.config['fetch_cache_in_workspace'])}"

    @staticmethod
    def _get_fetch_datetime_from_df_filename(filename: str) -> pd.Timestamp:
        return pd.to_datetime(filename.split("_")[0], format="%Y%m%d%H%M")

    def _get_df_filename(self, ticker: str) -> str:
        return f"{pd.Timestamp.now().strftime('%Y%m%d%H%M')}_{ticker}_sec_filings"

    def get(self, ticker: str) -> pl.DataFrame:
        folder = self._get_folder(ticker)
        Path(folder).mkdir(parents=True, exist_ok=True)
        parquet_files = [f for f in os.listdir(folder) if f.endswith(".parquet")]
        latest_datetime = pd.Timestamp.min
        if parquet_files:
            latest_datetime = max(
                [self._get_fetch_datetime_from_df_filename(f) for f in parquet_files]
            )
        if latest_datetime < pd.Timestamp.now() - pd.Timedelta(minutes=self.config["obb_refetch_interval"]):
            df = self._fetch(ticker)
            filename = self._get_df_filename(ticker)
            df.write_parquet(f"{folder}/{filename}.parquet")
            return df
        latest_file = [
            f for f in parquet_files if self._get_fetch_datetime_from_df_filename(f) == latest_datetime
        ][0]
        df = pl.read_parquet(f"{folder}/{latest_file}")
        return df


# ---------------------------------------------------------------------------
# SEC source loader
# ---------------------------------------------------------------------------


class SecSourceLoader:
    """Download filings from the SEC website."""

    def __init__(self) -> None:
        self.config = config
        self.selenium_loader = SeleniumWebLoader()
        self.request_loader = RequestWebLoader()
        self.obb_loader = OpenBBFilingsLoader()
        self.webloader_mode = "selenium"

    def _fetch(self, url: str) -> tuple[str | bytes, bytes | None]:
        if self.webloader_mode == "request":
            source = self.request_loader.fetch(url)
            pdf: bytes | None = None
        else:
            self.selenium_loader.load(url)
            source = self.selenium_loader.get_source()
            pdf = self.selenium_loader.get_pdf()
        return source, pdf

    @staticmethod
    def _get_extension(response: str | bytes | None) -> str:
        if isinstance(response, str):
            extension = "htm"
        else:
            if response is not None and response.startswith(b"%PDF"):
                extension = "pdf"
            else:
                extension = "htm"
        return extension

    def _get_folder(self, ticker: str) -> str:
        return f"{DATA_DIR.joinpath(ticker, self.config['dir_sec_filings'])}"

    def _save(self, target: str, content: str | bytes | None, binary: bool = False) -> None:
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        try:
            if binary:
                with open(target, "wb") as f:
                    if content:
                        f.write(content)
            else:
                with open(target, "w") as f:
                    if isinstance(content, bytes):
                        f.write(content.decode("utf-8", errors="ignore"))
                    elif content:
                        f.write(content)
        except Exception as e:  # pragma: no cover - thin wrapper
            print(f"Error writing file {target}: {str(e)}")

    def _get_filesystem_filings_list(self, ticker: str) -> list[str]:
        folder = self._get_folder(ticker)
        Path(folder).mkdir(parents=True, exist_ok=True)
        return [f for f in os.listdir(folder) if f.endswith(".htm")]

    def _get_online_filings_list(self, ticker: str) -> list[str]:
        df = self.obb_loader.get(ticker)
        return df.select("filename_stem").to_series().to_list()

    def _get_files_to_fetch(self, ticker: str) -> list[str]:
        filesystem = self._get_filesystem_filings_list(ticker)
        online = self._get_online_filings_list(ticker)
        return [f for f in online if f not in filesystem]

    def download_files(self, ticker: str) -> None:
        target_filenames = self._get_files_to_fetch(ticker)
        df = self.obb_loader.get(ticker)
        df = df.filter(pl.col("filename_stem").is_in(target_filenames))
        folder = self._get_folder(ticker)
        for row in df.to_dicts():
            logging.info(f"SecSourceLoader: Downloading {row['filename_stem']}")
            source, pdf = self._fetch(row["report_url"])
            filename = row["filename_stem"]
            extension = self._get_extension(source)
            target_source = f"{folder}/{filename}.{extension}"
            target_pdf = f"{folder}/{filename}.pdf"
            self._save(target_source, source, binary=False)
            self._save(target_pdf, pdf, binary=True)


__all__ = ["OpenBBFilingsLoader", "SecSourceLoader"]
