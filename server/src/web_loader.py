from __future__ import annotations

import base64
import os
from time import sleep
from datetime import date, timedelta

import polars as pl
from openbb import obb
from pydantic import BaseModel
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ---------------------------------------------------------------------------
# OpenBB filings loader
# ---------------------------------------------------------------------------

OBB_CONFIG = {}
OBB_CONFIG["sec_relevant_filings"] = {"10-Q", "10-K"}

class OpenBBLoader:

    def __init__(self) -> None:
        try:
            obb.account.login(pat=os.getenv("OPENBB_PAT"))
            obb.user.credentials.fmp_api_key = os.getenv("FMP_API_KEY")
        except Exception as e:
            print(f"[OpenBBLoader] Login failed: {e}.")

    @staticmethod
    def get_available_files(ticker: str, start_date: date | None = None) -> list[dict]:
        # TODO: how not to compute the full docsearch twice?

        if start_date is None:
            # can't define time-dependent default value in function definition
            start_date = date.today() - timedelta(days=365)

        try:
            out = obb.equity.fundamental.filings(
                ticker,
                provider="sec", # start_date only works with "sec" provider
                start_date=start_date,
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
                    "|".join(OBB_CONFIG["sec_relevant_filings"])
                )
            )
            return [ # as json
                {
                    "name": row["filename_stem"],
                    "url": row["report_url"],
                }
                for row in out.to_dicts()
            ]
        
        except Exception as e:
            print(f"[OpenBBLoader] Could not fetch data for {ticker}: {e}.")
            return []

# ---------------------------------------------------------------------------
# Web loading helpers
# ---------------------------------------------------------------------------

SELENIUM_CONFIG = {}
SELENIUM_CONFIG["webdriver_throttle"] = 8  # nb pulls per second
SELENIUM_CONFIG["webdriver_timeout"] = 10  # nb of seconds
SELENIUM_CONFIG["pdf_page_settings"] = {
    "landscape": False,
    "printBackground": True,
    "paperWidth": 8.5,
    "paperHeight": 11,
    "marginTop": 0.4,
    "marginBottom": 0.4,
    "marginLeft": 0.4,
    "marginRight": 0.4,
}

class SeleniumLoader():

    @staticmethod
    def load_driver():
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument(
            '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
        )
        return webdriver.Chrome(options=chrome_options)

    @staticmethod
    def get_pdf(url: str) -> bytes:
        driver = SeleniumLoader.load_driver()
        try:
            driver.get(url)
            WebDriverWait(driver, SELENIUM_CONFIG["webdriver_timeout"]).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            sleep(1 / SELENIUM_CONFIG["webdriver_throttle"])
        except Exception as e:
            raise Exception(f"[SeleniumLoader] Error accessing {url}: {str(e)}")

        tmp = driver.execute_cdp_cmd(
            "Page.printToPDF", SELENIUM_CONFIG["pdf_page_settings"]
        )
        out = base64.b64decode(tmp["data"])

        driver.quit()
        return out


__all__ = ["OpenBBLoader", "SeleniumLoader"]
