import os

import logging
import polars as pl
from pathlib import Path

# from fastapi import APIRouter
 
from config import config
from utils import SeleniumWebLoader, RequestWebLoader
from openbb_loader import OpenBBFilingsLoader


DATA_DIR = Path(__file__).resolve().parent.parent.joinpath("data")


class SecSourceLoader():
    
    def __init__(self):
        self.config = config
        self.selenium_loader = SeleniumWebLoader()
        self.request_loader = RequestWebLoader()
        self.obb_loader = OpenBBFilingsLoader()
        self.webloader_mode = "selenium"
        # self.router = APIRouter()
        # self.router.add_api_route(
        #     "/download/sec/{ticker}", 
        #     self.download_files, methods=["POST"], 
        #     response_model=None, 
        #     status_code=200, 
        #     description="Download files for a given ticker symbol", 
        #     responses={400: {"description": "Invalid ticker symbol"}, 
        #                404: {"description": "Ticker not found"}
        #     }
        # )


    def _fetch(self, url):
        if self.webloader_mode == "request":
            source = self.request_loader.fetch(url)
            pdf = None
        else:
            self.selenium_loader.load(url)
            source = self.selenium_loader.get_source()
            pdf = self.selenium_loader.get_pdf()
        return source, pdf
    

    def _get_extension(self, response):
        if isinstance(response, str):
            extension = 'htm'
            response = response.encode('utf-8')
        else:
            if response is not None and response.startswith(b'%PDF'):
                extension = 'pdf'
            else:
                extension = 'htm'
        return extension
    

    def _get_folder(self, ticker:str):
        out = f"{DATA_DIR.joinpath(ticker, self.config['dir_sec_filings'])}"
        return out


    def _save(self, target, content, binary=False):
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        try:
            if binary:
                with open(target, 'wb') as f:
                    f.write(content)
            else:
                with open(target, 'w') as f:
                    f.write(content)
        except Exception as e:
            print(f"Error writing file {target}: {str(e)}")


    def _get_filesystem_filings_list(self, ticker):
        folder = self._get_folder(ticker)
        print("folder", folder)
        Path(folder).mkdir(parents=True, exist_ok=True)
        out = [f for f in os.listdir(folder) if f.endswith('.htm')]
        return out
    

    def _get_online_filings_list(self, ticker):
        df = self.obb_loader.get(ticker)
        out = df.select("filename_stem").to_series().to_list()
        return out


    def _get_files_to_fetch(self, ticker):
        filesystem = self._get_filesystem_filings_list(ticker)
        online = self._get_online_filings_list(ticker)
        new = [f for f in online if not f in filesystem]
        return new

        
    def download_files(self, ticker):
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
