import path from "path";
import { getLocalFiles, getLocalFolders } from "./local_file_system";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { LocalFile, LocalFolder } from "./electron_types";

describe("Local File System", () => {
  const testDir = path.join(__dirname, "test_data", "example_workspace");

  // Relies on test_data/example_workspace/
  // ├── file1.txt
  // ├── file2.txt
  // ├── folder1/
  // │   ├── file3.txt
  // │   └── subfolder/
  // │       └── file4.txt
  // └── folder2/
  //     └── file5.txt

  describe("getLocalFiles", () => {
    const filesByName: Record<string, LocalFile> = {};

    beforeEach(async () => {
      const files = await getLocalFiles(testDir);
      for (const file of files) {
        filesByName[file.name] = file;
      }
    });

    it("Reads five files", async () => {
      expect(Object.keys(filesByName).length).toBe(5);
    });

    it("Has correct file names", () => {
      expect(filesByName["file1.txt"]).toBeDefined();
      expect(filesByName["file2.txt"]).toBeDefined();
      expect(filesByName["file3.txt"]).toBeDefined();
      expect(filesByName["file4.txt"]).toBeDefined();
      expect(filesByName["file5.txt"]).toBeDefined();
    });

    it("Has correct relative paths", () => {
      expect(filesByName["file1.txt"].pathRelativeToWorkspace).toEqual([]);
      expect(filesByName["file2.txt"].pathRelativeToWorkspace).toEqual([]);
      expect(filesByName["file3.txt"].pathRelativeToWorkspace).toEqual([
        "folder1",
      ]);
      expect(filesByName["file4.txt"].pathRelativeToWorkspace).toEqual([
        "folder1",
        "subfolder",
      ]);
      expect(filesByName["file5.txt"].pathRelativeToWorkspace).toEqual([
        "folder2",
      ]);
    });

    it("Has correct content hashes", () => {
      expect(filesByName["file1.txt"].contentHash).toBeDefined();
      expect(filesByName["file2.txt"].contentHash).toBeDefined();
      expect(filesByName["file3.txt"].contentHash).toBeDefined();
      expect(filesByName["file4.txt"].contentHash).toBeDefined();
      expect(filesByName["file5.txt"].contentHash).toBeDefined();
    });
  });

  describe("getLocalFolders", () => {
    const foldersByName: Record<string, LocalFolder> = {};

    beforeEach(async () => {
      const folders = await getLocalFolders(testDir);
      for (const folder of folders) {
        foldersByName[folder.pathRelativeToWorkspace.join("/")] = folder;
      }
    });

    it("Reads three folders", async () => {
      expect(Object.keys(foldersByName).length).toBe(3);
    });

    it("Has correct folder names", () => {
      expect(foldersByName["folder1"]).toBeDefined();
      expect(foldersByName["folder2"]).toBeDefined();
      expect(foldersByName["folder1/subfolder"]).toBeDefined();
    });

    it("Has correct relative paths", () => {
      expect(foldersByName["folder1"].pathRelativeToWorkspace).toEqual([
        "folder1",
      ]);
      expect(foldersByName["folder2"].pathRelativeToWorkspace).toEqual([
        "folder2",
      ]);
      expect(
        foldersByName["folder1/subfolder"].pathRelativeToWorkspace
      ).toEqual(["folder1", "subfolder"]);
    });
  });
});
