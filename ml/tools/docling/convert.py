from docling.document_converter import DocumentConverter

file_name = "AMAT_Q2_2024_Earnings_Release"
converter = DocumentConverter()
result = converter.convert(f"{file_name}.pdf")
with open(f"{file_name}.md", "w") as f:
    f.write(result.document.export_to_markdown())
