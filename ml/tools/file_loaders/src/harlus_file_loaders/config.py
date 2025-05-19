config = {}

config["workspace_path"] = "workspace/wood"
config["agent_cache_in_workspace"] = ".cache/agents"
config["fetch_cache_in_workspace"] = ".cache/fetches"

config["dir_internal_reports"] = "internal"
config["dir_earnings_call"] = "earnings_call"
config["dir_sec_filings"] = "sec"

config["webdriver_throttle"] = 8 # nb pulls per second
config["webdriver_timeout"] = 10 # nb of seconds
config["obb_refetch_interval"] = 5 # nb minutes new data for same obb ticker is not refreshed

config["sec_relevant_filings"] = {"10-Q", "10-K", "8-K", "6-K"}

# PDF page settings
config["pdf_page_settings"] = {}
config["pdf_page_settings"]["landscape"] = False
config["pdf_page_settings"]["printBackground"] = True
config["pdf_page_settings"]["paperWidth"] = 8.5
config["pdf_page_settings"]["paperHeight"] = 11
config["pdf_page_settings"]["marginTop"] = 0.4
config["pdf_page_settings"]["marginBottom"] = 0.4
config["pdf_page_settings"]["marginLeft"] = 0.4
config["pdf_page_settings"]["marginRight"] = 0.4