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

config["webdriver_throttle"] = 8  # nb pulls per second
config["webdriver_timeout"] = 10  # nb of seconds

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


# ---------------------------------------------------------------------------
# Web loading helpers
# ---------------------------------------------------------------------------


class WebLoader:

    def __init__(self) -> None:
        pass

    def _fetch(self, url: str):
        raise NotImplementedError

    def get(self, url: str):
        raise NotImplementedError


class SeleniumWebLoader(WebLoader):

    def __init__(self) -> None:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument(
            '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
        )
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
        except Exception as e:
            raise Exception(f"SeleniumWebLoader: Error accessing {url}: {str(e)}")

    def get_source(self) -> str:
        out = self.driver.page_source
        return out

    def get_pdf(self) -> bytes:
        tmp = self.driver.execute_cdp_cmd(
            "Page.printToPDF", config["pdf_page_settings"]
        )
        out = base64.b64decode(tmp["data"])
        return out

    def __del__(self) -> None:
        try:
            if self.driver:
                self.driver.quit()
                self.driver = None
        except Exception as e:
            print(f"Error quitting Selenium driver: {e}")


# ---------------------------------------------------------------------------
# OpenBB filings loader
# ---------------------------------------------------------------------------


class OpenBBFilingsLoader:

    def __init__(self) -> None:
        self.config = config
        try:
            obb.account.login(pat=os.getenv("OPENBB_PAT"))
            obb.user.credentials.fmp_api_key = os.getenv("FMP_API_KEY")
        except Exception as e:
            print(f"Warning: OpenBB login failed: {e}.")

    # TODO: could add start and end dates
    def _fetch(self, ticker: str) -> pl.DataFrame:
        print(f"OpenBBFilingsLoader: Fetching fresh data for {ticker}")
        out = obb.equity.fundamental.filings(
            ticker,
            provider="fmp",
            limit=100,
        ).to_polars()
        out = out.with_columns(
            (
                (pl.col("filing_date").dt.year() % 100).cast(pl.String)
                + "_Q"
                + ((pl.col("filing_date").dt.month() - 1) // 3 + 1).cast(pl.String)
                + "_"
                + pl.col("report_type")
                .str.replace_all(" ", "_")
                .str.replace_all("/", "_")
            ).alias("filename_stem")
        )
        out = out.filter(
            pl.col("report_type").str.contains(
                "|".join(self.config["sec_relevant_filings"])
            )
        )
        print(f"OpenBBFilingsLoader: Successfully fetched data for {ticker}")
        return out

    # TODO: revert caching to reduce calls to OpenBB
    def get(self, ticker: str) -> pl.DataFrame:
        return self._fetch(ticker)

    def __del__(self) -> None:
        print(
            "OpenBBFilingsLoader: Cleaning up resources (placeholder for cache cleanup)."
        )
        # Placeholder for future cache cleanup logic


# ---------------------------------------------------------------------------
# SEC source loader
# ---------------------------------------------------------------------------


class WebFile:
    def __init__(
        self, file_name: str, report_url: str, pdf_content: bytes | None
    ):
        self.file_name = file_name
        self.report_url = report_url
        self.pdf_content = pdf_content

    def __repr__(self):
        return f"SECFileData(filename_stem='{self.file_name}', report_url='{self.report_url}', has_pdf={self.pdf_content is not None})"


class SecSourceLoader:
    """Download filings through OpenBloomberg."""

    def __init__(self) -> None:
        self.config = config
        self.selenium_loader = SeleniumWebLoader()
        self.obb_loader = OpenBBFilingsLoader()

    def _fetch_pdf(self, url: str) -> tuple[str | bytes, bytes | None]:
        try:
            self.selenium_loader.load(url)
            pdf = self.selenium_loader.get_pdf()
        except Exception as e:
            print(f"Error fetching with Selenium from {url}: {e}")
            pdf = None

        return pdf

    def download_files(self, ticker: str) -> list[WebFile]:
        files_to_fetch_df = self.obb_loader.get(ticker)
        print(f"SecSourceLoader: Found {len(files_to_fetch_df)} files to fetch.")

        if files_to_fetch_df.is_empty():
            return []

        files: list[WebFile] = []
        for row in files_to_fetch_df.to_dicts():
            file_name_no_ext = row["filename_stem"]
            report_url = row["report_url"]
            pdf = self._fetch_pdf(report_url)

            if pdf is not None:
                files.append(WebFile(
                    file_name=f"{file_name_no_ext}.pdf",
                    report_url=report_url,
                    pdf_content=pdf,
                ))
            else:
                print(
                    f"Warning: Could not fetch content for {file_name_no_ext} from {report_url}"
                )

        return files

    def __del__(self) -> None:
        print("SecSourceLoader: Cleaning up resources.")
        if hasattr(self, "selenium_loader") and self.selenium_loader:
            try:
                del self.selenium_loader
            except Exception as e:
                print(f"Error cleaning up Selenium loader: {e}")

        if hasattr(self, "obb_loader") and self.obb_loader:
            try:
                del self.obb_loader
            except Exception as e:
                print(f"Error cleaning up OpenBB loader: {e}")


__all__ = ["OpenBBFilingsLoader", "SecSourceLoader", "WebFile"]
