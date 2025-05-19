from llama_index.core import KnowledgeGraphIndex, Document
from llama_index.llms.openai import OpenAI

triplets = [

    # company properties
    ("company", "has_property", "name"),
    ("company", "has_property", "ticker"),
    ("company", "has_property", "revenue"),
    ("company", "has_property", "cost"),
    ("company", "has_property", "profit"),

    # revenue
    ("revenue", "alias_of", "sales"),
    ("revenue", "alias_of", "top line"),
    ("revenue", "alias_of", "turnover"),
    ("revenue", "has_formula", "revenue = units sold * price per unit"),
    ("units sold", "positive_influence_on", "revenue"),
    ("price per unit", "positive_influence_on", "revenue"),

    # cost of goods sold
    ("cost of goods sold", "alias_of", "cogs"),

    # operating expenses
    ("operating expenses", "has_formula", "operating expenses = salaries + rent + utilities + marketing"),
    ("salaries", "positive_influence_on", "operating expenses"),
    ("rent", "positive_influence_on", "operating expenses"),
    ("utilities", "positive_influence_on", "operating expenses"),
    ("marketing", "positive_influence_on", "operating expenses"),

    # total expenses
    ("total expenses", "has_formula", "total expenses = cogs + operating expenses + depreciation + amortization + interest expense + taxes"),
    ("cost of goods sold", "positive_influence_on", "total expenses"),
    ("operating expenses", "positive_influence_on", "total expenses"),
    ("depreciation", "positive_influence_on", "total expenses"),
    ("amortization", "positive_influence_on", "total expenses"),
    ("interest expense", "positive_influence_on", "total expenses"),
    ("taxes", "positive_influence_on", "total expenses"),

    # gross profit
    ("gross profit", "alias_of", "gross margin"),
    ("gross profit", "has_formula", "gross profit = revenue - cogs"),
    ("revenue", "positive_influence_on", "gross profit"),
    ("cost of goods sold", "negative_influence_on", "gross profit"),

    # operating profit (ebit)
    ("operating profit", "alias_of", "ebit"),
    ("operating profit", "has_formula", "operating profit = revenue - cogs - operating expenses"),
    ("revenue", "positive_influence_on", "operating profit"),
    ("cost of goods sold", "negative_influence_on", "operating profit"),
    ("operating expenses", "negative_influence_on", "operating profit"),

    # ebitda
    ("ebitda", "alias_of", "earnings before interest taxes depreciation and amortization"),
    ("ebitda", "has_formula", "ebitda = ebit + depreciation + amortization"),
    ("ebit", "positive_influence_on", "ebitda"),
    ("depreciation", "positive_influence_on", "ebitda"),
    ("amortization", "positive_influence_on", "ebitda"),

    # net profit
    ("net profit", "alias_of", "net income"),
    ("net profit", "alias_of", "bottom line"),
    ("net profit", "has_formula", "net profit = revenue - total expenses"),
    ("revenue", "positive_influence_on", "net profit"),
    ("total expenses", "negative_influence_on", "net profit"),

    # earnings per share
    ("earnings per share", "alias_of", "eps"),
    ("earnings per share", "has_formula", "eps = net profit / weighted average shares outstanding"),
    ("net profit", "positive_influence_on", "earnings per share"),
    ("weighted average shares outstanding", "negative_influence_on", "earnings per share"),

    # operating cash flow
    ("operating cash flow", "alias_of", "ocf"),
    ("operating cash flow", "has_formula", "ocf = net profit + depreciation + amortization - change in working capital"),
    ("net profit", "positive_influence_on", "operating cash flow"),
    ("depreciation", "positive_influence_on", "operating cash flow"),
    ("amortization", "positive_influence_on", "operating cash flow"),
    ("change in working capital", "negative_influence_on", "operating cash flow"),

    # free cash flow
    ("free cash flow", "alias_of", "fcf"),
    ("free cash flow", "has_formula", "fcf = operating cash flow - capital expenditures"),
    ("operating cash flow", "positive_influence_on", "free cash flow"),
    ("capital expenditures", "negative_influence_on", "free cash flow"),

    # return on investment
    ("return on investment", "alias_of", "roi"),
    ("return on investment", "has_formula", "roi = (net profit from investment / investment cost) * 100%"),
    ("net profit from investment", "positive_influence_on", "return on investment"),
    ("investment cost", "negative_influence_on", "return on investment"),

    # return on equity
    ("return on equity", "alias_of", "roe"),
    ("return on equity", "has_formula", "roe = net profit / shareholder's equity"),
    ("net profit", "positive_influence_on", "return on equity"),
    ("shareholder's equity", "negative_influence_on", "return on equity"),

    # return on assets
    ("return on assets", "alias_of", "roa"),
    ("return on assets", "has_formula", "roa = net profit / total assets"),
    ("net profit", "positive_influence_on", "return on assets"),
    ("total assets", "negative_influence_on", "return on assets"),

    # current ratio
    ("current ratio", "has_formula", "current ratio = current assets / current liabilities"),
    ("current assets", "positive_influence_on", "current ratio"),
    ("current liabilities", "negative_influence_on", "current ratio"),

    # quick ratio
    ("quick ratio", "has_formula", "quick ratio = (current assets - inventory) / current liabilities"),
    ("current assets", "positive_influence_on", "quick ratio"),
    ("inventory", "negative_influence_on", "quick ratio"),
    ("current liabilities", "negative_influence_on", "quick ratio"),

    # debt-to-equity ratio
    ("debt-to-equity ratio", "alias_of", "d/e ratio"),
    ("debt-to-equity ratio", "has_formula", "d/e ratio = total liabilities / shareholder's equity"),
    ("total liabilities", "positive_influence_on", "debt-to-equity ratio"),
    ("shareholder's equity", "negative_influence_on", "debt-to-equity ratio"),

    # inventory turnover
    ("inventory turnover", "has_formula", "inventory turnover = cost of goods sold / average inventory"),
    ("cost of goods sold", "positive_influence_on", "inventory turnover"),
    ("average inventory", "negative_influence_on", "inventory turnover"),

    # asset turnover
    ("asset turnover", "has_formula", "asset turnover = revenue / total assets"),
    ("revenue", "positive_influence_on", "asset turnover"),
    ("total assets", "negative_influence_on", "asset turnover"),

    # customer acquisition cost
    ("customer acquisition cost", "alias_of", "cac"),
    ("customer acquisition cost", "has_formula", "cac = sales and marketing spend / new customers"),
    ("sales and marketing spend", "positive_influence_on", "customer acquisition cost"),
    ("new customers", "negative_influence_on", "customer acquisition cost"),

    # customer lifetime value
    ("customer lifetime value", "alias_of", "ltv"),
    ("customer lifetime value", "has_formula", "ltv = average revenue per customer * gross margin * average customer lifespan"),
    ("average revenue per customer", "positive_influence_on", "customer lifetime value"),
    ("gross margin", "positive_influence_on", "customer lifetime value"),
    ("average customer lifespan", "positive_influence_on", "customer lifetime value"),

    # churn rate
    ("churn rate", "has_formula", "churn rate = lost customers / customers at start"),
    ("lost customers", "positive_influence_on", "churn rate"),
    ("customers at start", "negative_influence_on", "churn rate"),

    # net promoter score
    ("net promoter score", "alias_of", "nps"),
    ("net promoter score", "has_formula", "nps = percent promoters - percent detractors"),
    ("percent promoters", "positive_influence_on", "net promoter score"),
    ("percent detractors", "negative_influence_on", "net promoter score"),
]

text = "\n".join([f"{s} {p} {o}." for s, p, o in triplets])
documents = [Document(text=text)]

KPI_KGRAPH = KnowledgeGraphIndex(
    documents,
    llm=OpenAI(model="gpt-3.5-turbo"),
    kg_triplet_extract_fn=lambda x: triplets,
)