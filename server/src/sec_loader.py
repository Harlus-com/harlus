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
from datetime import date, datetime
from typing import Iterator, Dict, Any, List

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

# config["workspace_path"] = "workspace/wood"
# config["agent_cache_in_workspace"] = ".cache/agents"
# config["fetch_cache_in_workspace"] = ".cache/fetches"

# config["dir_internal_reports"] = "internal"
# config["dir_earnings_call"] = "earnings_call"
# config["dir_sec_filings"] = "sec"

config["webdriver_throttle"] = 8  # nb pulls per second
config["webdriver_timeout"] = 10  # nb of seconds
config["obb_refetch_interval"] = 60  # minutes before refetching the same ticker

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


# Default cache directory for sec_loader's internal caching (like OpenBB data)
# This should be outside the FileStore's managed workspace directories.
# DEFAULT_SEC_CACHE_DIR = Path(__file__).parent.parent.joinpath("cache", ".sec_cache")
# DEFAULT_SEC_CACHE_DIR.mkdir(parents=True, exist_ok=True)


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
        # Consider managing the driver lifecycle more explicitly if needed
        # For now, initializing here.
        self.driver = webdriver.Chrome(options=chrome_options)
        self.config = config
        super().__init__()

    def load(self, url: str) -> None:
        try:
            self.driver.get(url)
            WebDriverWait(self.driver, self.config["webdriver_timeout"]).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            sleep(1 / self.config["webdriver_throttle"])
        except Exception as e:  # pragma: no cover - thin wrapper
            raise Exception(f"SeleniumWebLoader: Error accessing {url}: {str(e)}")

    def get_source(self) -> str:
        out = self.driver.page_source
        return out

    def get_pdf(self) -> bytes:
        tmp = self.driver.execute_cdp_cmd("Page.printToPDF", config["pdf_page_settings"])
        out = base64.b64decode(tmp["data"])
        return out

    def __del__(self) -> None:
        # Check if driver is still active before quitting
        try:
            # Ensure the driver is not None before quitting
            if self.driver:
                self.driver.quit()
                self.driver = None # Set to None after quitting
        except Exception as e:
            print(f"Error quitting Selenium driver: {e}")


class RequestWebLoader(WebLoader):
    """Simple requests based loader."""

    def __init__(self) -> None:
        pass

    def fetch(self, url: str) -> bytes:
        out = requests.get(url).content
        return out
    
    def __del__(self) -> None:
        print("RequestWebLoader: Cleaning up resources.")
        # Doesn't have specific cleanup, but a __del__ can be added for consistency or logging


# ---------------------------------------------------------------------------
# OpenBB filings loader
# ---------------------------------------------------------------------------


class OpenBBFilingsLoader:
    """Load filings from OpenBB with basic caching."""

    def __init__(self) -> None:
        self.config = config
        # Ensure OpenBB is logged in - this might need to be handled externally
        # or within a dedicated OpenBB setup function if credentials change.
        # For now, keeping it here as per original code structure.
        try:
            obb.account.login(pat=os.getenv("OPENBB_PAT"))
            obb.user.credentials.fmp_api_key = os.getenv("FMP_API_KEY")
        except Exception as e:
            print(f"Warning: OpenBB login failed: {e}.")

    # TODO: could add start and end dates
    def _fetch(self, ticker: str) -> pl.DataFrame:
        """Fetches the latest filings data from OpenBB."""
        print(f"OpenBBFilingsLoader: Fetching fresh data for {ticker}")
        out = obb.equity.fundamental.filings(
            ticker,
            provider="fmp",
            limit=10, # Limit to 10 as in original code, adjust if needed
            ).to_polars()
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
        print(f"OpenBBFilingsLoader: Successfully fetched data for {ticker}")
        return out

    # def _get_cache_folder(self, ticker: str) -> Path:
    #     # Use the default SEC cache directory for OpenBB data caching
    #     return DEFAULT_SEC_CACHE_DIR.joinpath(ticker, self.config['fetch_cache_in_workspace'])

    # @staticmethod
    # def _get_fetch_datetime_from_df_filename(filename: str) -> datetime:
    #     # Assuming filename format isYYYYMMDDHHMM_ticker_sec_filings.parquet
    #     try:
    #         datetime_str = filename.split("_")[0]
    #         return datetime.strptime(datetime_str, "%Y%m%d%H%M")
    #     except (ValueError, IndexError) as e:
    #         print(f"Warning: Could not parse datetime from filename {filename}: {e}")
    #         # Return a very old datetime to ensure refetch
    #         return datetime.min

    # def _get_df_filename(self, ticker: str) -> str:
    #     return f"{datetime.now().strftime('%Y%m%d%H%M')}_{ticker}_sec_filings"

    # TODO: revert caching to reduce calls to OpenBB
    def get(self, ticker: str) -> pl.DataFrame:
        """
        Gets SEC filings data from OpenBB by fetching fresh data every time.
        """
        return self._fetch(ticker)

    def __del__(self) -> None:
        print("OpenBBFilingsLoader: Cleaning up resources (placeholder for cache cleanup).")
        # Placeholder for future cache cleanup logic


# ---------------------------------------------------------------------------
# SEC source loader
# ---------------------------------------------------------------------------

class SECFileData:
    def __init__(self, filename_stem: str, report_url: str, source_content: str | bytes, pdf_content: bytes | None):
        self.filename_stem = filename_stem
        self.report_url = report_url
        self.source_content = source_content
        self.pdf_content = pdf_content

    def __repr__(self):
        return f"SECFileData(filename_stem='{self.filename_stem}', report_url='{self.report_url}', has_source={self.source_content is not None}, has_pdf={self.pdf_content is not None})"


class SecSourceLoader:
    """Download filings from the SEC website."""

    def __init__(self) -> None:
        self.config = config
        self.selenium_loader = SeleniumWebLoader()
        self.request_loader = RequestWebLoader()
        self.obb_loader = OpenBBFilingsLoader()
        self.webloader_mode = "selenium" # Default mode

    # @property
    # def config(self) -> dict[str, object]:
    #     """Return the configuration dictionary for the SEC source loader."""
    #     return self.config

    def _fetch(self, url: str) -> tuple[str | bytes, bytes | None]:
        """Fetches the source and PDF content for a given URL."""
        if self.webloader_mode == "request":
            # RequestWebLoader only provides source (as bytes)
            source = self.request_loader.fetch(url)
            pdf: bytes | None = None
            # Decode source if it's bytes and we expect string for htm
            if isinstance(source, bytes) and (url.lower().endswith('.htm') or url.lower().endswith('.html')):
                 try:
                     source = source.decode('utf-8', errors='ignore')
                 except Exception as e:
                     print(f"Warning: Could not decode source from {url}: {e}")
                     # Keep as bytes if decoding fails
        else: # Use Selenium by default
            try:
                self.selenium_loader.load(url)
                source = self.selenium_loader.get_source()
                pdf = self.selenium_loader.get_pdf()
            except Exception as e:
                print(f"Error fetching with Selenium from {url}: {e}")
                # TODO: Fallback or raise? For now, return None for content
                source = None
                pdf = None

        return source, pdf


    def get_new_files_to_fetch(self, ticker: str, existing_stems: List[str]) -> Iterator[SECFileData]:
        """
        Retrieves SEC filing metadata for the given ticker, filters out
        filings that already exist based on provided stems, fetches content
        for the new filings, and yields it as an iterator.
        """
        print(f"SecSourceLoader: Getting filing metadata for {ticker} from OpenBB.")
        # OpenBBFilingsLoader is instantiated in SecSourceLoader's __init__
        # Call the non-caching get method
        filings_metadata = self.obb_loader.get(ticker)
        print(f"SecSourceLoader: Retrieved {len(filings_metadata)} potential SEC filings metadata from OpenBB.")

        # Filter out filings that already exist in FileStore
        filings_to_fetch_df = filings_metadata.filter(
            ~pl.col("filename_stem").is_in(existing_stems)
        )
        print(f"SecSourceLoader: Found {len(filings_to_fetch_df)} new filings to fetch.")

        if filings_to_fetch_df.is_empty():
            print("SecSourceLoader: No new filings to fetch.")
            return # Yield nothing if no new files

        print(f"SecSourceLoader: Initiating content fetch for {len(filings_to_fetch_df)} new filings.")

        for row in filings_to_fetch_df.to_dicts():
            filename_stem = row["filename_stem"]
            report_url = row["report_url"]
            print(f"SecSourceLoader: Fetching content for {filename_stem} from {report_url}")
            source, pdf = self._fetch(report_url)

            if source is not None or pdf is not None:
                 yield SECFileData(
                     filename_stem=filename_stem,
                     report_url=report_url,
                     source_content=source,
                     pdf_content=pdf
                 )
            else:
                 print(f"Warning: Could not fetch content for {filename_stem} from {report_url}")

    def __del__(self) -> None:
        print("SecSourceLoader: Cleaning up resources.")
        # Ensure WebLoaders are cleaned up when SecSourceLoader is garbage collected
        if hasattr(self, 'selenium_loader') and self.selenium_loader:
            try:
                del self.selenium_loader
            except Exception as e:
                print(f"Error cleaning up Selenium loader: {e}")

        if hasattr(self, 'request_loader') and self.request_loader:
            try:
                del self.request_loader
            except Exception as e:
                print(f"Error cleaning up Request loader: {e}")

        if hasattr(self, 'obb_loader') and self.obb_loader:
            try:
                del self.obb_loader
            except Exception as e:
                print(f"Error cleaning up OpenBB loader: {e}")

    # @staticmethod
    # def _get_extension(response: str | bytes | None) -> str:
    #     if isinstance(response, str):
    #         extension = "htm"
    #     else:
    #         if response is not None and response.startswith(b"%PDF"):
    #             extension = "pdf"
    #         else:
    #             extension = "htm"
    #     return extension

    # def get_folder(self, ticker: str) -> str:
    #     return f"{self.data_path.joinpath(ticker, self.config['dir_sec_filings'])}"

    # def _save(self, target: str, content: str | bytes | None, binary: bool = False) -> None:
    #     Path(target).parent.mkdir(parents=True, exist_ok=True)
    #     try:
    #         if binary:
    #             with open(target, "wb") as f:
    #                 if content:
    #                     f.write(content)
    #         else:
    #             with open(target, "w") as f:
    #                 if isinstance(content, bytes):
    #                     f.write(content.decode("utf-8", errors="ignore"))
    #                 elif content:
    #                     f.write(content)
    #     except Exception as e:  # pragma: no cover - thin wrapper
    #         print(f"Error writing file {target}: {str(e)}")

    # def _get_filesystem_filings_list(self, ticker: str) -> list[str]:
    #     folder = self._get_folder(ticker)
    #     Path(folder).mkdir(parents=True, exist_ok=True)
    #     return [f for f in os.listdir(folder) if f.endswith(".htm")]

    # def _get_online_filings_list(self, ticker: str) -> list[str]:
    #     df = self.obb_loader.get(ticker)
    #     return df.select("filename_stem").to_series().to_list()

    # def _get_files_to_fetch(self, ticker: str) -> list[str]:
    #     filesystem = self._get_filesystem_filings_list(ticker)
    #     online = self._get_online_filings_list(ticker)
    #     return [f for f in online if f not in filesystem]

    # def download_files(
    #         self, 
    #         ticker: str,
    #         start_date: date | None = None, 
    #         end_date: date | None = None,
    #     ) -> None:
    #     target_filenames = self._get_files_to_fetch(ticker)
    #     df = self.obb_loader.get(ticker)
    #     df = df.filter(pl.col("filename_stem").is_in(target_filenames))
    #     folder = self._get_folder(ticker)
    #     for row in df.to_dicts():
    #         print(f"SecSourceLoader: Downloading {row['filename_stem']}")
    #         source, pdf = self._fetch(row["report_url"])
    #         filename = row["filename_stem"]
    #         extension = self._get_extension(source)
    #         target_source = f"{folder}/{filename}.{extension}"
    #         target_pdf = f"{folder}/{filename}.pdf"
    #         self._save(target_source, source, binary=False)
    #         self._save(target_pdf, pdf, binary=True)




__all__ = ["OpenBBFilingsLoader", "SecSourceLoader", "SECFileData"]