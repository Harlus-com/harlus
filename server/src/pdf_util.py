import asyncio
from pathlib import Path
from fastapi import HTTPException


async def convert_to_pdf(input_path: Path) -> Path:
    """
    Convert any file to PDF via headless LibreOffice.
    - input_path: path to the original file on disk
    Returns the Path to the newly created PDF.
    """
    output_dir = input_path.parent
    # spawn headless conversion
    proc = await asyncio.create_subprocess_exec(
        "soffice",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(output_dir),
        str(input_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        # capture any error text and return a 500
        msg = (
            stderr.decode().strip() or f"LibreOffice exited with code {proc.returncode}"
        )
        raise HTTPException(status_code=500, detail=f"PDF conversion failed: {msg}")

    pdf_path = output_dir / f"{input_path.stem}.pdf"
    if not pdf_path.exists():
        raise HTTPException(
            status_code=500, detail="PDF output not found after conversion"
        )

    return pdf_path
