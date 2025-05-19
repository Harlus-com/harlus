import logging
import requests
import base64
from time import sleep

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from config import config


class WebLoader():
    """
    # WebLoader

    Base class which implements caching. Child classes need to implement fetch. 
    """
    def __init__(self):
        pass 

    def _fetch(self):
        pass 

    def get(self):
        pass 


class SeleniumWebLoader(WebLoader):
    """
    # SeleniumWebLoader

    Get webcontent behind url through selenium.

    Does not implement caching as it is expected that calling class will handle it.
    """
    
    def __init__(self):
        chrome_options = Options()
        chrome_options.add_argument("--headless") 
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument('--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"')        
        driver = webdriver.Chrome(options=chrome_options)
        self.config = config
        self.driver = driver
        super().__init__() 
    
    def load(self, url):    
        try:
            logging.info(f"SeleniumWebLoader: Loading {url}")
            self.driver.get(url)
            WebDriverWait(self.driver, self.config["webdriver_timeout"]).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            sleep(1/self.config["webdriver_throttle"])
            logging.info(f"SeleniumWebLoader: Successfully loaded {url}")

        except Exception as e:
            logging.error(f"SeleniumWebLoader: Error accessing {url}: {str(e)}")
    
    def get_source(self):
        logging.info(f"SeleniumWebLoader: Getting source")
        out = self.driver.page_source
        logging.info(f"SeleniumWebLoader: Successfully got source")
        return out
    
    def get_pdf(self):
        logging.info(f"SeleniumWebLoader: Getting pdf")
        tmp = self.driver.execute_cdp_cmd('Page.printToPDF', self.config["pdf_page_settings"])
        out = base64.b64decode(tmp['data'])
        logging.info(f"SeleniumWebLoader: Successfully got pdf")
        return out
    
    def __del__(self):
        logging.info(f"SeleniumWebLoader: Quitting driver")
        self.driver.quit()


class RequestWebLoader(WebLoader):
    """
    # RequestWebLoader

    Does not implement caching as it is expected that calling class will handle it.
    """
    def __init__(self):
        pass
    def fetch(self, url):
        logging.info(f"RequestWebLoader: Fetching {url}")
        out = requests.get(url).content
        logging.info(f"RequestWebLoader: Successfully fetched {url}")
        return out
