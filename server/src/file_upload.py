from src.file_store import FileStore
from fastapi import UploadFile
import os
import tempfile
import threading
import time
import aiofiles


"""
Handles streaming file uploads to the file store.
"""


class FileUploader:
    def __init__(self, file_store: FileStore):
        self.file_store = file_store
        self.lock = threading.Lock()
        self.active_uploads: set[str] = set()

    async def upload_file(
        self,
        workspace_id: str,
        path_relative_to_workspace: list[str],
        content_hash: str,
        upload: UploadFile,
    ):
        start_time = time.time()
        print("Uploading file", content_hash)
        with self.lock:
            if content_hash in self.active_uploads:
                print(f"Already uploading file {content_hash}, skipping")
                return None
            else:
                self.active_uploads.add(content_hash)

        current_files = self.file_store.get_files(workspace_id)
        if content_hash in current_files.keys():
            print(f"File {content_hash} is already fully uploaded, skipping")
            with self.lock:
                self.active_uploads.remove(content_hash)
            return current_files[content_hash]

        file = self.file_store.create_file(
            workspace_id, path_relative_to_workspace, content_hash, upload.filename
        )

        is_pdf = await _is_pdf_stream(upload)
        print("is_pdf", is_pdf)

        tmp_dir = tempfile.mkdtemp()
        tmp_path = os.path.join(tmp_dir, upload.filename)

        async with aiofiles.open(tmp_path, "wb") as out:
            while chunk := await upload.read(8192):
                await out.write(chunk)

        self.file_store.copy_file_content(file, tmp_path)
        with self.lock:
            self.active_uploads.remove(content_hash)
        end_time = time.time()
        print("Uploaded file", content_hash, "in", end_time - start_time, "seconds")
        return file


async def _is_pdf_stream(upload: UploadFile) -> bool:
    header = await upload.read(5)
    # Reset the stream cursor so you can read it again later
    await upload.seek(0)
    return header == b"%PDF-"
