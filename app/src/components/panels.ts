export enum FileGroupCount {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
}

export enum TopLevelPanelId {
  FILE_EXPLORER = "file-explorer",
  FILE_VIEWER = "file-viewer",
  CHAT = "chat",
}

export class TopLevelPanel {
  constructor(
    readonly id: TopLevelPanelId,
    readonly defaultSize: number,
    readonly minSize: number = 5
  ) {}
}
