
/**
 * Helper functions for Electron integration
 */

// Check if app is running in Electron
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined';
};

// Wrapper for Electron API calls
export const electronAPI = {
  // Demo function
  runDemo: async (): Promise<void> => {
    if (isElectron() && window.electron.demoFunction) {
      window.electron.demoFunction();
    } else {
      console.log('Not running in Electron or API not available');
    }
  },
  
  // This would be expanded with actual API calls in the full implementation
  // These are placeholders for the real functionality
  
  // Open file dialog
  openFileDialog: async (): Promise<string[]> => {
    if (isElectron() && window.electron.openFileDialog) {
      return window.electron.openFileDialog();
    }
    // Mock implementation for web preview
    console.log('Opening file dialog (mock)');
    return ['/mock/sample-file.pdf'];
  },
  
  // Get file content
  getFileContent: async (path: string): Promise<ArrayBuffer | null> => {
    if (isElectron() && window.electron.getFileContent) {
      return window.electron.getFileContent(path);
    }
    // Mock implementation for web preview
    console.log(`Getting file content for ${path} (mock)`);
    return null;
  },
};
