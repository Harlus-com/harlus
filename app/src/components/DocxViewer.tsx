import React from "react";

const DocxViewer: React.FC = () => {
  // Excel embed URL

  return (
    <div className="h-full w-full">
      <iframe 
        src="https://harlusai-my.sharepoint.com/personal/octave_oliviers_harlus_com/_layouts/15/Doc.aspx?sourcedoc={cc203af2-c6f7-493a-9c5a-da3730f475af}&amp;action=embedview"
        width="100%"
        height="100%"
        frameBorder="0"
        title="Word Viewer"
        className="border-none"
      ></iframe>
    </div>
    //<div className="h-full w-full">
     // <iframe
        //src={wordEmbedUrl}
        //width="100%"
        //height="100%"
        //frameBorder="0"
        //title="Word Viewer"
        //className="border-none"
      //></iframe>
    //</div>
  );
};

export default DocxViewer; 