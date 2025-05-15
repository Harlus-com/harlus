# Equity AI Navigator

An AI-powered equity analysis tool built with Electron and React.

## Features

- Drag and drop PDF files into a workspace
- View files in a left-hand navigation panel
- View PDF documents directly within the application
- Ask questions about your documents in a chat interface
- Run contrast analysis between documents to identify similarities and differences

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

### Development

To run the app in development mode:

```bash
# Start the Vite dev server within the electron app
npm run electron
```

This will start an electron server that expects a backend to be running on port 8000 already.

For instructions on how to start the backend server, see server/README

You can also use

```bash
npm run electron -- --server_host=<remote-host>
```

This allows the app to talk to a remote host running the server.

```bash
# Just run the app as web app without electron wrapper
npm run dev
```

#### With prod packaging

You can also test starting the app without `electron-start.js` and instead using the prod distribution.

With this setup instead of opening a window pointed to localhost:8080, electron opens a window that directly reads from dist.

This apporach also has the benefit of letting you exercise the files `electron/main.ts` which are what get run in production.

### Building for Production

**Important**: Packaging the app also pulls in the backend api from the `server` directory.

In that directory you must first run `pyinstaller main.py --name fastapi-server --onefile`. This will either make a fastapi-server executable for mac or fastapi-server.exe for windows. Note: To generate the fastapi-server.exe you must be on windows machine. Therefore to package for windows, we need windows.

To build the app for production:

```bash
npm run package:mac
```

Note: To bypass mac security when downloading on another device, you might need to run `xattr -c <path/to/application.app>`

or

```bash
npm run package:win
```

## Project Structure

- `electron/` - Electron main process code
- `src/` - React application code
  - `api/` - API client and services
  - `components/` - React components
  - `pages/` - Page components

## Integrating with Your API

This application is designed to connect to your existing API. To integrate:

1. Update the `fileService.ts` file to make real API calls to your backend
2. Configure the Electron main process to start your API server
3. Update the preload script to expose any required Node.js functionality

## Packaging

This project uses electron-builder for packaging. Configuration can be found in `electron-builder.yml`.

To package for different platforms:

```bash
# For macOS
npx electron-builder --mac

# For Windows
npx electron-builder --win

# For Linux
npx electron-builder --linux
```

## License

[MIT](LICENSE)
