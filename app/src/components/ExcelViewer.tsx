import React from "react";

const ExcelViewer: React.FC = () => {
  // Excel embed URL
  const excelEmbedUrl = "https://harlusai-my.sharepoint.com/personal/octave_oliviers_harlus_com/_layouts/15/Doc.aspx?sourcedoc={c547898c-6057-4bba-bd97-ee19034b732e}&action=embedview&wdAllowInteractivity=False&AllowTyping=True&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True";

  return (
    <div className="h-full w-full">
      <iframe
        src={excelEmbedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        title="Excel Viewer"
        className="border-none"
      ></iframe>
    </div>
  );
};

export default ExcelViewer; 