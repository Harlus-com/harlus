export interface ComponentData<ApiData, UiState> {
  apiData: ApiData;
  uiState: UiState;
}

export type ReadonlyComponentData<ApiData, UiState> = Readonly<
  ApiData & UiState
>;
